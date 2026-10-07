# Switch AWS template LLM from Claude to Amazon Nova Lite

## Why

The owner's AWS promo credits do not cover Anthropic Claude on Amazon Bedrock. Claude is billed through AWS Marketplace and is IAM-denied on the account. This CDK/Lambda template will be reused for a scheduled SEC EDGAR monitor, so it has to default to a credit-eligible model before any deploy.

## What changes

- Default the AWS runner and CDK stack to Amazon Nova Lite `us.amazon.nova-lite-v1:0` in `us-east-1`.
- Call Bedrock with the Converse API (`ConverseCommand`) instead of `InvokeModel` Anthropic Messages bodies.
- Scope the Lambda role to `foundation-model/amazon.nova-*` and `inference-profile/us.amazon.nova-*`.
- Reject `anthropic.*` model overrides (on-demand ids, geo inference profiles, and ARNs) with a clear error at synth time and at runtime.
- Document the default. Leave the Lovable/Supabase app on Gemini; it does not call Claude.

## Capabilities

### New Capabilities

- `aws-bedrock-synthesis`: Amazon Nova Lite via the Bedrock Converse API is the AWS template's synthesizer, with Anthropic overrides refused.

### Modified Capabilities

- None. There is no existing OpenSpec baseline.

## Impact

- `aws/cdk-app.ts`, `aws/lambda/runner.ts`, new `aws/lambda/model.ts`
- `aws/README.md`, root `README.md`, `.lovable/plan.md`
- Unit tests under `aws/lambda/model.test.ts`
- No deploy. The Lovable AI Gateway path (`src/lib/agent-runtime.server.ts`, Gemini) stays as it is.
