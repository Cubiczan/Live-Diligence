// Live Diligence — AWS Lambda runner.
// Receives { reportId, query, isPro } and runs the agent loop against
// SEC EDGAR (direct) + Exa (Airbyte CLI), synthesizing the memo with
// Amazon Nova on Bedrock (Converse API). Defaults to Nova Lite.
// Persists reports + events to DynamoDB.

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { exaSearch } from "../../src/lib/exa.server";
import { DEFAULT_BEDROCK_REGION, buildConverseInput, resolveBedrockModelId, textFromConverseResponse } from "./model";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || DEFAULT_BEDROCK_REGION });
const sm = new SecretsManagerClient({});

const REPORTS = process.env.REPORTS_TABLE!;
const EVENTS = process.env.EVENTS_TABLE!;

let exaKeyBootstrapped = false;
async function bootstrapExaFallback() {
  if (exaKeyBootstrapped || process.env.EXA_API_KEY || !process.env.EXA_SECRET_ARN) return;
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: process.env.EXA_SECRET_ARN }));
  process.env.EXA_API_KEY = secret.SecretString || "";
  exaKeyBootstrapped = true;
}

async function emit(reportId: string, step: string, payload: any, status = "info") {
  await ddb.send(new PutCommand({
    TableName: EVENTS,
    Item: { report_id: reportId, created_at: new Date().toISOString(), step, status, payload },
  }));
}

async function patchReport(reportId: string, patch: Record<string, any>) {
  const exprs: string[] = []; const names: Record<string, string> = {}; const values: Record<string, any> = {};
  Object.entries(patch).forEach(([k, v], i) => {
    exprs.push(`#k${i} = :v${i}`); names[`#k${i}`] = k; values[`:v${i}`] = v;
  });
  await ddb.send(new UpdateCommand({
    TableName: REPORTS, Key: { id: reportId },
    UpdateExpression: "SET " + exprs.join(", "),
    ExpressionAttributeNames: names, ExpressionAttributeValues: values,
  }));
}

async function bedrockChat(modelId: string, system: string, user: string, maxTokens = 2000) {
  const cmd = new ConverseCommand(buildConverseInput(modelId, system, user, maxTokens));
  const res = await bedrock.send(cmd);
  return textFromConverseResponse(res);
}

async function tickerToCik(ticker: string) {
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "user-agent": "Live Diligence AWS runner (contact@livediligence.app)" },
  });
  const map = await res.json();
  for (const k in map) if (map[k].ticker?.toUpperCase() === ticker.toUpperCase()) return String(map[k].cik_str).padStart(10, "0");
  return null;
}

async function recentFilings(ticker: string) {
  const cik = await tickerToCik(ticker); if (!cik) return [];
  const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { "user-agent": "Live Diligence AWS runner" } });
  const j = await r.json();
  const f = j.filings?.recent; if (!f) return [];
  const want = new Set(["10-K", "10-Q", "8-K"]); const out: any[] = []; const seen: Record<string, number> = {};
  for (let i = 0; i < (f.form?.length || 0); i++) {
    const form = f.form[i]; if (!want.has(form)) continue;
    if ((seen[form] || 0) >= (form === "8-K" ? 3 : 1)) continue;
    seen[form] = (seen[form] || 0) + 1;
    const acc = (f.accessionNumber[i] as string).replace(/-/g, "");
    out.push({ form, filed: f.filingDate[i], url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${f.primaryDocument[i]}` });
    if (out.length >= 5) break;
  }
  return out;
}

export const handler = async (event: any) => {
  const body = JSON.parse(event.body || "{}");
  const reportId: string = body.reportId;
  const query: string = body.query;
  if (!reportId || !query) return { statusCode: 400, body: "missing fields" };

  try {
    const modelId = resolveBedrockModelId(process.env.BEDROCK_MODEL_ID);
    await bootstrapExaFallback();
    await patchReport(reportId, { status: "running", query, updated_at: new Date().toISOString() });
    await emit(reportId, "plan", { msg: "Planning..." }, "running");

    const planRaw = await bedrockChat(
      modelId,
      "You output STRICT JSON. Given an investing query, return {ticker, company_name, sub_questions[4], web_queries[4]}.",
      query, 600,
    );
    const plan = JSON.parse(planRaw.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const ticker: string | null = plan.ticker ? String(plan.ticker).toUpperCase() : null;
    await patchReport(reportId, { ticker, company_name: plan.company_name });
    await emit(reportId, "plan", plan, "done");

    let filings: any[] = [];
    if (ticker) { filings = await recentFilings(ticker); await emit(reportId, "edgar", { count: filings.length, filings }, "done"); }

    const web: any[] = [];
    for (const q of (plan.web_queries || [query]).slice(0, 3)) web.push(...(await exaSearch(q, 4)));
    const seen = new Set<string>(); const dedup = web.filter((r) => seen.has(r.url) ? false : (seen.add(r.url), true)).slice(0, 12);
    await emit(reportId, "exa", { count: dedup.length, sources: dedup.map((r) => ({ title: r.title, url: r.url })) }, "done");

    await emit(reportId, "synth", { msg: `Synthesizing with Amazon Bedrock (${modelId})...` }, "running");
    const memo = await bedrockChat(
      modelId,
      `You are a senior equity-research analyst writing a Markdown diligence memo with sections: ## Executive Summary / ## Thesis / ## Financials & KPIs / ## Risks / ## Catalysts / ## Sources. Inline-cite web sources [n].`,
      [
        `Query: ${query}`,
        `Company: ${plan.company_name} (${ticker ?? "N/A"})`,
        `Filings:\n${filings.map((f) => `- ${f.form} ${f.filed} ${f.url}`).join("\n")}`,
        `Web:\n${dedup.map((r, i) => `[${i + 1}] ${r.title} ${r.url}\n${(r.text || "").slice(0, 600)}`).join("\n\n")}`,
      ].join("\n\n"),
      2400,
    );

    const sources = [
      ...filings.map((f) => ({ kind: "sec", title: `${f.form} · ${f.filed}`, url: f.url })),
      ...dedup.map((r) => ({ kind: "web", title: r.title, url: r.url })),
    ];

    await patchReport(reportId, { status: "done", memo_md: memo, sources, updated_at: new Date().toISOString() });
    await emit(reportId, "done", { tokens: memo.length, sources: sources.length }, "done");
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    await patchReport(reportId, { status: "error", error: String(err?.message || err) });
    await emit(reportId, "error", { message: String(err?.message || err) }, "error");
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(err?.message || err) }) };
  }
};
