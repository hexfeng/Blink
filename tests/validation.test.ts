import { describe, expect, it } from "vitest";
import { INPUT_LIMIT } from "../src/lib/constants";
import { normalizeProviderConfig, unicodeLength, validateCustomMode, validateDraft, ValidationError } from "../src/lib/validation";

describe("validation", () => {
  it("counts Unicode code points for custom modes", () => {
    expect(unicodeLength("A😀中")).toBe(3);
    expect(validateCustomMode({ id: "1", name: "😀", instruction: "保持链接" }, [])).toEqual({ id: "1", name: "😀", instruction: "保持链接" });
  });

  it("enforces the five-mode and draft limits", () => {
    const existing = Array.from({ length: 5 }, (_, index) => ({ id: String(index), name: "mode", instruction: "rule" }));
    expect(() => validateCustomMode({ id: "new", name: "sixth", instruction: "rule" }, existing)).toThrow(ValidationError);
    expect(() => validateDraft("x".repeat(INPUT_LIMIT + 1))).toThrow(ValidationError);
    expect(() => validateDraft(" \n ")).toThrow(ValidationError);
  });

  it("keeps provider subpaths and rejects unsafe base URLs", () => {
    const config = normalizeProviderConfig({ kind: "openai-compatible", baseUrl: "https://gateway.example/api/v1/", apiKey: " key ", model: " model " });
    expect(config).toEqual({ schemaVersion: 1, kind: "openai-compatible", baseUrl: "https://gateway.example/api/v1", apiKey: "key", model: "model" });
    expect(() => normalizeProviderConfig({ kind: "openai-compatible", baseUrl: "http://example.com/v1", apiKey: "key", model: "model" })).toThrow(ValidationError);
  });
});
