// Amazon Bedrock model selection for the AWS runner.
// Promo credits on the owner account do not cover Anthropic Claude (AWS Marketplace).
// Claude is IAM-denied there, so this template defaults to Amazon Nova and refuses anthropic.* overrides.

/** US cross-region inference profile for Amazon Nova Lite. Invoke from us-east-1. */
export const DEFAULT_BEDROCK_MODEL_ID = "us.amazon.nova-lite-v1:0";

export const DEFAULT_BEDROCK_REGION = "us-east-1";

export const BEDROCK_INVOKE_ACTIONS = [
  "bedrock:InvokeModel",
  "bedrock:InvokeModelWithResponseStream",
] as const;

/**
 * Nova only. Foundation-model ARNs cover on-demand amazon.nova-* IDs.
 * Inference-profile ARNs cover US cross-region profiles (us.amazon.nova-*),
 * which is how the default Nova Lite ID is invoked.
 */
export const NOVA_BEDROCK_RESOURCES = [
  "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
  "arn:aws:bedrock:*:*:inference-profile/us.amazon.nova-*",
] as const;

// On-demand ids (anthropic.claude-...) and geo profiles (us.anthropic.claude-...,
// including those embedded in a Bedrock ARN).
const ANTHROPIC_MODEL_ID = /(^|\/)(?:[a-z0-9-]+\.)*anthropic\./i;

export function isAnthropicModelId(modelId: string): boolean {
  return ANTHROPIC_MODEL_ID.test(modelId.trim());
}

export function resolveBedrockModelId(override?: string | null): string {
  const trimmed = override?.trim() ?? "";
  const modelId = trimmed.length > 0 ? trimmed : DEFAULT_BEDROCK_MODEL_ID;
  if (isAnthropicModelId(modelId)) {
    throw new Error(
      `BEDROCK_MODEL_ID "${modelId}" is not allowed. Anthropic Claude on Amazon Bedrock is billed through AWS Marketplace, is not covered by promo credits, and is IAM-denied on this account. Use an Amazon Nova model such as ${DEFAULT_BEDROCK_MODEL_ID}.`,
    );
  }
  return modelId;
}

export interface ConverseInput {
  modelId: string;
  system: Array<{ text: string }>;
  messages: Array<{ role: "user"; content: Array<{ text: string }> }>;
  inferenceConfig: { maxTokens: number };
}

/** Bedrock Converse request. Nova does not accept Anthropic Messages bodies. */
export function buildConverseInput(modelId: string, system: string, user: string, maxTokens: number): ConverseInput {
  return {
    modelId,
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens },
  };
}

export function textFromConverseResponse(response: {
  output?: { message?: { content?: Array<{ text?: string }> } };
}): string {
  const blocks = response.output?.message?.content ?? [];
  return blocks.map((block) => block.text ?? "").join("");
}
