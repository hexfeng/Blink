import { describe, expect, it } from "vitest";
import { modelPresets, recommendedModel } from "../src/lib/modelPresets";

describe("model presets", () => {
  it("shows OpenAI presets only for the official OpenAI endpoint", () => {
    expect(modelPresets("openai-compatible", "https://api.openai.com/v1").map((model) => model.id)).toEqual([
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol"
    ]);
    expect(modelPresets("openai-compatible", "https://api.deepseek.com/v1")).toEqual([]);
  });

  it("provides a recommended starting model for each built-in provider", () => {
    expect(recommendedModel("openai-compatible")).toBe("gpt-5.6-luna");
    expect(recommendedModel("anthropic")).toBe("claude-sonnet-5");
    expect(recommendedModel("gemini")).toBe("gemini-3.6-flash");
  });
});
