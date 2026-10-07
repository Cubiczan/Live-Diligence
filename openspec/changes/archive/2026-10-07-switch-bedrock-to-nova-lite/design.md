# Design: Amazon Nova Lite on Bedrock

## Context

`aws/` is a CDK template (Lambda + HTTP API + DynamoDB + Secrets Manager) that mirrors the diligence agent. It previously called `anthropic.claude-3-5-sonnet-20241022-v2:0` with an Anthropic Messages body (`anthropic_version`, `InvokeModel`). The main app synthesizes with Gemini through the Lovable AI Gateway and does not call Bedrock.

Amazon Nova Lite is available as the US cross-region inference profile `us.amazon.nova-lite-v1:0`. That profile is invoked with the Bedrock Converse API from a US source Region. This stack already targets `us-east-1`.

## Goals / Non-Goals

**Goals:**

- Default model id is `us.amazon.nova-lite-v1:0` before any deploy.
- Requests use Converse (`system`, `messages`, `inferenceConfig.maxTokens`).
- IAM allows Nova foundation models and US Nova inference profiles, and does not grant Anthropic.
- `anthropic.*` overrides fail with an error that names Nova Lite as the replacement.
- Pure helpers are unit-tested without calling AWS.

**Non-Goals:**

- Deploying the stack or enabling models in an AWS account.
- Changing the Lovable/Gemini runtime.
- Adding streaming (`ConverseStream`) or tool use. The runner still buffers the full memo.

## Decisions

1. **Converse API, not InvokeModel.** Nova's portable request shape is Converse. Anthropic Messages fields are not sent.
2. **Shared resolver in `aws/lambda/model.ts`.** CDK and the Lambda both call `resolveBedrockModelId`. Unset or blank overrides become Nova Lite. Ids that match `anthropic.` after a start or `/` (including `us.anthropic.` geo profiles and ARNs) throw. Other ids, including `us.amazon.nova-pro-v1:0`, pass through so a Nova override still works.
3. **IAM resources are two wildcards.** `arn:aws:bedrock:*::foundation-model/amazon.nova-*` covers on-demand Nova ids in every destination Region the US profile can route to. `arn:aws:bedrock:*:*:inference-profile/us.amazon.nova-*` covers the system inference profile. The previous `Resource: "*"` is removed.
4. **Region stays `us-east-1`.** The stack env and the Bedrock client default to `us-east-1` when `AWS_REGION` is unset, which is a valid source Region for the `us.` profile.
5. **Fail before the agent loop.** The handler resolves the model id before DynamoDB writes. CDK resolves it while building the Lambda environment, so `cdk synth` fails on an Anthropic override and never bakes one in.

## Risks / Trade-offs

- Nova Lite is a smaller model than Claude 3.5 Sonnet. Memo quality may differ. Acceptable: credits and IAM make Claude unusable on this account.
- A non-Nova override (for example another Bedrock provider) is not rejected by code, but the IAM policy will deny the invoke. That is intentional; only Anthropic is a known credit/IAM trap and is rejected up front.
- Cross-region inference can route to other US destination Regions. The foundation-model ARN uses a region wildcard so those routes stay allowed.

## Migration Plan

No production deploy in this change. The next `cdk deploy` picks up Nova Lite with no model-access step for Marketplace Claude. Rollback is reverting this commit; do not point `BEDROCK_MODEL_ID` back at `anthropic.*`.

## Open Questions

None. The model id, Region, API, and IAM patterns are specified.
