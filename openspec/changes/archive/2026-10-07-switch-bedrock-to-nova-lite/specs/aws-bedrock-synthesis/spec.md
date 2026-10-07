## ADDED Requirements

### Requirement: Default synthesizer is Amazon Nova Lite

The AWS template SHALL use Amazon Nova Lite model id `us.amazon.nova-lite-v1:0` when `BEDROCK_MODEL_ID` is unset or blank. The stack Region and the Bedrock client SHALL default to `us-east-1`.

#### Scenario: Unset model id

- **WHEN** `BEDROCK_MODEL_ID` is unset, empty, or whitespace
- **THEN** the resolved model id is `us.amazon.nova-lite-v1:0`

#### Scenario: Nova override

- **WHEN** `BEDROCK_MODEL_ID` is `us.amazon.nova-pro-v1:0`
- **THEN** the resolved model id is `us.amazon.nova-pro-v1:0`

### Requirement: Anthropic overrides are rejected

The template SHALL reject a `BEDROCK_MODEL_ID` that selects an Anthropic model, including on-demand ids (`anthropic.*`), geographic inference profiles (`us.anthropic.*` and similar), and Bedrock ARNs that contain those ids. The error SHALL state that Anthropic Claude on Bedrock is not allowed and SHALL name `us.amazon.nova-lite-v1:0` as the model to use. The runner SHALL NOT send an Anthropic Messages body (`anthropic_version`).

#### Scenario: On-demand Claude id

- **WHEN** `BEDROCK_MODEL_ID` is `anthropic.claude-3-5-sonnet-20241022-v2:0`
- **THEN** resolution throws an error that includes `us.amazon.nova-lite-v1:0`

#### Scenario: Cross-region Claude profile

- **WHEN** `BEDROCK_MODEL_ID` is `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
- **THEN** resolution throws an error

### Requirement: Synthesis uses the Bedrock Converse API

The runner SHALL invoke Amazon Bedrock with `ConverseCommand` from `@aws-sdk/client-bedrock-runtime`. The request SHALL include the resolved model id, a system text block, a single user message, and `inferenceConfig.maxTokens`.

#### Scenario: Converse input shape

- **WHEN** the runner builds a chat request with a system string, a user string, and a max token count
- **THEN** the Converse input carries those values and does not include `anthropic_version`

#### Scenario: Response text

- **WHEN** a Converse response contains one or more text content blocks
- **THEN** the runner returns those text blocks concatenated

### Requirement: IAM allows Amazon Nova only

The Lambda execution role SHALL allow `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on `arn:aws:bedrock:*::foundation-model/amazon.nova-*` and `arn:aws:bedrock:*:*:inference-profile/us.amazon.nova-*`. The statement SHALL NOT grant Anthropic foundation models or inference profiles.

#### Scenario: Policy resources

- **WHEN** the stack's Bedrock invoke statement is defined
- **THEN** its resources are exactly those two Nova ARN patterns
