import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BEDROCK_INVOKE_ACTIONS,
  DEFAULT_BEDROCK_MODEL_ID,
  DEFAULT_BEDROCK_REGION,
  NOVA_BEDROCK_RESOURCES,
  buildConverseInput,
  resolveBedrockModelId,
  textFromConverseResponse,
} from "./model.ts";

describe("resolveBedrockModelId", () => {
  it("defaults to Amazon Nova Lite in the US inference profile", () => {
    assert.equal(DEFAULT_BEDROCK_MODEL_ID, "us.amazon.nova-lite-v1:0");
    assert.equal(DEFAULT_BEDROCK_REGION, "us-east-1");
    assert.equal(resolveBedrockModelId(undefined), DEFAULT_BEDROCK_MODEL_ID);
    assert.equal(resolveBedrockModelId(null), DEFAULT_BEDROCK_MODEL_ID);
    assert.equal(resolveBedrockModelId(""), DEFAULT_BEDROCK_MODEL_ID);
    assert.equal(resolveBedrockModelId("   "), DEFAULT_BEDROCK_MODEL_ID);
  });

  it("allows other Amazon Nova overrides", () => {
    assert.equal(resolveBedrockModelId("us.amazon.nova-pro-v1:0"), "us.amazon.nova-pro-v1:0");
    assert.equal(resolveBedrockModelId(" amazon.nova-micro-v1:0 "), "amazon.nova-micro-v1:0");
  });

  it("rejects anthropic.* on-demand ids, geo profiles, and ARNs", () => {
    const rejected = [
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "eu.anthropic.claude-3-haiku-20240307-v1:0",
      "global.anthropic.claude-sonnet-4-20250514-v1:0",
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
      "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    ];
    for (const modelId of rejected) {
      assert.throws(() => resolveBedrockModelId(modelId), /not allowed/, modelId);
      assert.throws(() => resolveBedrockModelId(modelId), /us\.amazon\.nova-lite-v1:0/, modelId);
    }
  });
});

describe("Converse request", () => {
  it("builds a Converse input instead of an Anthropic Messages body", () => {
    const input = buildConverseInput("us.amazon.nova-lite-v1:0", "Be brief.", "Summarize NVDA.", 600);
    assert.deepEqual(input, {
      modelId: "us.amazon.nova-lite-v1:0",
      system: [{ text: "Be brief." }],
      messages: [{ role: "user", content: [{ text: "Summarize NVDA." }] }],
      inferenceConfig: { maxTokens: 600 },
    });
    assert.equal("anthropic_version" in input, false);
  });

  it("joins text blocks from a Converse response", () => {
    assert.equal(
      textFromConverseResponse({
        output: { message: { content: [{ text: "Hello " }, { text: "world" }] } },
      }),
      "Hello world",
    );
    assert.equal(textFromConverseResponse({}), "");
  });
});

describe("Nova IAM resources", () => {
  it("allows amazon.nova foundation models and us.amazon.nova inference profiles", () => {
    assert.deepEqual(BEDROCK_INVOKE_ACTIONS, ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]);
    assert.deepEqual(NOVA_BEDROCK_RESOURCES, [
      "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:*:*:inference-profile/us.amazon.nova-*",
    ]);
    for (const resource of NOVA_BEDROCK_RESOURCES) {
      assert.equal(resource.includes("anthropic"), false);
    }
  });
});

describe("template sources", () => {
  it("does not default the CDK app or runner to Claude", () => {
    const runner = readFileSync(new URL("./runner.ts", import.meta.url), "utf8");
    const cdk = readFileSync(new URL("../cdk-app.ts", import.meta.url), "utf8");
    const combined = `${runner}\n${cdk}`;
    assert.equal(combined.includes("anthropic.claude"), false);
    assert.equal(combined.includes("anthropic_version"), false);
    assert.equal(combined.includes("InvokeModelCommand"), false);
    assert.match(runner, /ConverseCommand/);
    assert.match(cdk, /NOVA_BEDROCK_RESOURCES/);
    assert.match(cdk, /resolveBedrockModelId/);
  });
});
