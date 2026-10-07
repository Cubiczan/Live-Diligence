# Live Diligence

> Autonomous diligence memos. SEC filings + the live web, synthesized by an agent in under a minute.
> Submission to the **SuperAI · NEXT Hackathon** (AWS + Vercel + Exa + Stripe stack).

![Live Diligence](https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80)

## What it is

Live Diligence is an agentic research workspace for retail and emerging-manager investors. Type a question about any US public company, and an autonomous agent:

1. **Plans** — decomposes the prompt into a ticker + sub-questions.
2. **Reads filings** — pulls the latest 10-K / 10-Q / 8-Ks directly from **SEC EDGAR**.
3. **Scans the live web** — uses **Exa** (via Airbyte CLI) for current news, expert posts, competitor signals.
4. **Synthesizes** — a reasoning model writes a cited markdown memo: Thesis · Financials · Risks · Catalysts · Sources.

Free users get 3 memos/month; **Pro is $19/mo via Stripe** for unlimited memos and a stronger synthesis model.

## Why the NEXT partner stack

| Partner | Role in Live Diligence |
| --- | --- |
| **AWS** | Bedrock + Lambda agent runtime (alt deployment path in `aws/`) |
| **Vercel / Edge** | The Lovable Cloud preview runs on edge serverless; the AWS path mirrors it. |
| **Exa** | Real-time web search & contents for live-signal retrieval |
| **Stripe** | Subscription billing (`Pro` plan), test mode wired |

## Architecture

```text
                    ┌──────────────────────┐
   User ──prompt──▶ │  React (TanStack)    │
                    │  Edge-rendered       │
                    └──────────┬───────────┘
                               │ createServerFn
                    ┌──────────▼───────────┐
                    │  startReport()       │──insert──▶  Postgres (reports, events, profiles)
                    └──────────┬───────────┘
                               │ fire-and-forget HTTP
                    ┌──────────▼───────────┐
                    │  /api/public/        │
                    │  run-report          │
                    │  (the agent loop)    │
                    └──┬─────┬───────┬─────┘
                       │     │       │
              ┌────────▼─┐ ┌─▼────┐ ┌▼───────────────┐
              │ Planner  │ │ SEC  │ │ Exa (Airbyte   │
              │ Gemini   │ │ EDGAR│ │ CLI)           │
              └────┬─────┘ └──┬───┘ └──┬─────────────┘
                   └──────────┴────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Synthesizer        │──memo──▶  reports.memo_md
                    │ Gemini 2.5 Pro     │
                    └────────────────────┘
```

Live status streams to the UI via `report_events` rows the agent emits per step.

## Tech stack

- **Frontend**: TanStack Start (React 19, Vite 7), Tailwind 4, framer-motion, react-markdown.
- **Backend**: TanStack server functions + public server routes (`/api/public/*`).
- **Data**: Supabase (Postgres + Auth + RLS) — managed via Lovable Cloud.
- **AI Gateway**: Lovable AI Gateway → Google Gemini 2.5 Flash / Pro.
- **Web retrieval**: Exa via Airbyte Agent CLI (`search_results.list`); `EXA_API_KEY` fallback.
- **Filings**: SEC EDGAR JSON submissions API (no key, just User-Agent).
- **Payments**: Stripe REST (Checkout Sessions + webhook).
- **Alt deployment**: AWS CDK stack scaffolded under `aws/` (Lambda + API Gateway + Bedrock).

## Live demo

- Preview (Lovable Cloud, edge): _add the preview URL after publish_
- Production: _add after publish_

Stripe is in test mode — use card `4242 4242 4242 4242` with any future expiry & CVC.

## Repositories

| Mirror | URL |
| --- | --- |
| **GitHub** | https://github.com/icohangar-ops/Live-Diligence |
| **Codeberg** | https://codeberg.org/cubiczan/live-diligence |

## Local development

```bash
bun install
bun run dev
```

### Environment variables

Runtime (read inside server functions only):

| Name | Source | Purpose |
| --- | --- | --- |
| `LOVABLE_API_KEY` | auto-provisioned | Lovable AI Gateway (Gemini) |
| `AIRBYTE_CLIENT_ID`, `AIRBYTE_CLIENT_SECRET`, `AIRBYTE_ORGANIZATION_ID` | app.airbyte.ai | Exa web search via `airbyte-agent` CLI |
| `AIRBYTE_WORKSPACE` | default | Airbyte workspace name (usually `default`) |
| `AIRBYTE_USE_CLI` | `true` | Route Exa through Airbyte CLI |
| `EXA_API_KEY` | dashboard.exa.ai | Fallback if Airbyte CLI unavailable |
| `STRIPE_SECRET_KEY` | Stripe → API keys | Checkout sessions (direct API) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks | Signature verification |
| `AGENT_RUNNER_SECRET` | self-generated | Shared secret for the internal kickoff route |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Lovable Cloud | DB/auth |

Client (`VITE_*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Airbyte (Exa connector)

```bash
bash scripts/setup-airbyte-connectors.sh
```

Requires `airbyte-agent` on `PATH` and `AIRBYTE_*` creds in `.env`. See `.env.example`.

## AWS deployment path

The `aws/` directory contains a CDK app that mirrors the Lovable runtime on:

- **Lambda** (Node 20) running the same agent loop (`agent-runtime.server.ts` reused).
- **API Gateway HTTP API** for the public runner endpoint.
- **Bedrock** Amazon Nova Lite (`us.amazon.nova-lite-v1:0` in us-east-1, Converse API) as the synthesizer. Anthropic Claude is not used on this path.
- **DynamoDB** for reports + events.
- **Secrets Manager** for `EXA_API_KEY` / `STRIPE_SECRET_KEY`.

```bash
cd aws
bun install
bunx cdk bootstrap
bunx cdk deploy
```

## Submission

- Built for the [SuperAI · NEXT Hackathon](https://dorahacks.io/hackathon/next-hackathon/detail).
- Track: **Agentic Finance / AI Diligence**.
- Author: [@icohangar-ops](https://github.com/icohangar-ops).

## License

MIT — see `LICENSE`.

> Not investment advice. Output is generated by an AI agent and may contain inaccuracies.
