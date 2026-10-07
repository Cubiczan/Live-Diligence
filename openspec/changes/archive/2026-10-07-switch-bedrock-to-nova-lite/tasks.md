# Tasks

## 1. Model selection

- [x] 1.1 Add a shared resolver that defaults to `us.amazon.nova-lite-v1:0` and rejects `anthropic.*` overrides
- [x] 1.2 Build Bedrock Converse inputs (system, user message, maxTokens) in that module

## 2. Template

- [x] 2.1 Switch the Lambda runner from `InvokeModel` Anthropic Messages to `ConverseCommand`
- [x] 2.2 Default the CDK stack to Nova Lite in `us-east-1` and scope IAM to Nova foundation models and US Nova inference profiles

## 3. Docs and tests

- [x] 3.1 Update `aws/README.md`, the root README, and `.lovable/plan.md`
- [x] 3.2 Unit-test the resolver, Converse shape, IAM resource list, and that the template sources do not default to Claude
- [x] 3.3 Typecheck the AWS package
