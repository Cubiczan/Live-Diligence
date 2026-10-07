# Live Diligence — Build Plan

An agentic diligence workspace: enter a ticker or company, get a streaming research memo synthesized from SEC EDGAR filings + live web (Exa) + LLM reasoning, gated by a Stripe paywall. Repo also ships an AWS CDK stack (Bedrock + Lambda) as the Top-5 deployment path.

## 1. Database (Lovable Cloud)
- `profiles` (id, display_name, plan: free|pro)
- `reports` (id, user_id, query, ticker, status: queued|running|done|error, memo_md, sources jsonb, created_at)
- `report_events` (id, report_id, step, payload jsonb, ts) — streaming trace
- `usage` (user_id, month, reports_run) for free-tier limit (3/mo free, unlimited pro)
- RLS scoped to `auth.uid()`; user_roles table for admin.

## 2. Auth
- Email/password + Google (broker). `_authenticated/` layout gates `/app/*`.

## 3. Agent server functions (`src/lib/agent.functions.ts`)
- `startReport({ query })` → inserts row, kicks `runAgent` (fire-and-forget via server fn, writes events as it goes).
- `runAgent` pipeline:
  1. **Planner** (Lovable AI / google/gemini-2.5-flash) → resolves ticker + sub-questions.
  2. **SEC EDGAR fetch** — latest 10-K/10-Q/8-K via `data.sec.gov` (no key, set User-Agent).
  3. **Exa search** — `/search` + `/contents` for live web signals (news, competitors, risks).
  4. **Synthesizer** (gemini-2.5-pro) → streams a structured memo: Thesis · Financials · Risks · Catalysts · Sources.
  5. Persist memo + sources.
- `getReport`, `listReports`, `streamReportEvents` (poll every 1.5s on client).

## 4. Stripe (BYOK with provided test key)
- Server fn `createCheckoutSession` → Stripe Checkout (Pro $19/mo subscription).
- Public route `/api/public/stripe-webhook` → verifies signature, upgrades `profiles.plan`.
- Free users: 3 reports/mo; Pro: unlimited.

## 5. UI (editorial dark theme, mono+serif)
- `/` marketing landing: hero, how-it-works, pricing, CTA.
- `/auth` sign in / up.
- `/app` dashboard: new-report input + recent reports list.
- `/app/reports/$id` live trace (steps stream) + final memo with citations.
- Design: deep slate bg, electric-amber accent, IBM Plex Serif headings + Plex Mono labels + Inter body. Framer-motion for step reveal.

## 6. AWS deployment path (repo only, not run here)
- `aws/` folder with CDK TypeScript stack:
  - Lambda (Node 20) running the same agent pipeline (shared TS in `packages/agent-core`).
  - Bedrock Amazon Nova Lite (`us.amazon.nova-lite-v1:0`) as the synthesizer.
  - API Gateway HTTP API + DynamoDB (reports) + Secrets Manager (EXA/STRIPE).
  - `cdk deploy` instructions in README.

## 7. README / submission
- Architecture diagram (ASCII), partner-stack mapping (AWS + Vercel + Exa + Stripe), demo video script, local + AWS deploy steps, link to live Lovable preview for judges.

## Technical notes
- `attachSupabaseAuth` already wired in `src/start.ts`.
- Agent steps emit to `report_events`; UI polls via `useQuery` with `refetchInterval` while status != done.
- All Exa/Stripe/SEC calls inside `createServerFn` handlers (never client). Lovable AI via `LOVABLE_API_KEY`.
- AWS stack is *additive* — Lovable preview stays the canonical demo URL.

## Order of execution
1. Migration (profiles, reports, report_events, usage, user_roles, has_role).
2. Design tokens in `src/styles.css` + landing page.
3. Auth route + `_authenticated` children.
4. Agent server fns + Exa/SEC/LLM helpers.
5. Report detail page with live trace.
6. Stripe checkout + webhook + paywall.
7. AWS CDK scaffold + README.
