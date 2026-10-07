# AWS deployment (Bedrock + Lambda)

This stack mirrors the agent runtime on AWS as the SuperAI NEXT "Top-5" qualifying deployment path.

## What it provisions

- **Lambda** (`runner.ts`) — Node 20, runs the agent loop end-to-end.
- **API Gateway HTTP API** — POST `/run-report`.
- **DynamoDB** — `Reports` + `Events` tables.
- **Bedrock** — Amazon Nova Lite (`us.amazon.nova-lite-v1:0`, us-east-1) as the synthesizer, via the Converse API. Nova is credit-eligible. Anthropic Claude on Bedrock is not used: it is billed through AWS Marketplace, is not covered by the owner's promo credits, and is IAM-denied on that account.
- **Secrets Manager** — `live-diligence/exa-api-key`, `live-diligence/stripe-secret`.

## Deploy

```bash
cd aws
bun install

# one-time
bunx cdk bootstrap

# put your keys in secrets manager
aws secretsmanager put-secret-value --secret-id live-diligence/exa-api-key --secret-string "$EXA_API_KEY"
aws secretsmanager put-secret-value --secret-id live-diligence/stripe-secret --secret-string "$STRIPE_SECRET_KEY"

bunx cdk deploy
```

The stack defaults to Amazon Nova Lite. Leave `BEDROCK_MODEL_ID` unset. To pin another Nova model, export `BEDROCK_MODEL_ID` (for example `us.amazon.nova-pro-v1:0`) before `cdk synth` / `cdk deploy`. Values matching `anthropic.*` — including `us.anthropic.*` inference profiles — fail synth and fail the Lambda at runtime with an error that points back to `us.amazon.nova-lite-v1:0`.

The Lambda role may call `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` only on:

- `arn:aws:bedrock:*::foundation-model/amazon.nova-*`
- `arn:aws:bedrock:*:*:inference-profile/us.amazon.nova-*`

Invoke the US inference profile from `us-east-1` (the stack's default Region).

## Invoke

```bash
curl -X POST "$API_URL/run-report" \
  -H 'content-type: application/json' \
  -d '{"reportId":"<uuid>", "query":"NVDA latest 10-Q analysis"}'
```

Poll DynamoDB or wire the AWS path into the Lovable frontend by pointing `PUBLIC_APP_URL` at the API Gateway URL.
