import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderFailure, requestProvider } from "../src/lib/providers";
import type { ProviderConfig } from "../src/lib/types";

const baseConfig = { schemaVersion: 1 as const, apiKey: "secret-key", model: "test-model" };

afterEach(() => vi.unstubAllGlobals());

describe("provider adapters", () => {
  it.each([
    {
      kind: "openai-compatible" as const,
      baseUrl: "https://gateway.example/proxy/v1",
      response: { choices: [{ message: { content: "openai result" } }] },
      endpoint: "https://gateway.example/proxy/v1/chat/completions",
      expected: "openai result"
    },
    {
      kind: "anthropic" as const,
      baseUrl: "https://api.anthropic.example/proxy",
      response: { content: [{ type: "text", text: "anthropic result" }] },
      endpoint: "https://api.anthropic.example/proxy/v1/messages",
      expected: "anthropic result"
    },
    {
      kind: "gemini" as const,
      baseUrl: "https://gemini.example/proxy",
      response: { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "gemini result" }] }] },
      endpoint: "https://gemini.example/proxy/v1/interactions",
      expected: "gemini result"
    }
  ])("maps $kind requests and keeps proxy subpaths", async ({ kind, baseUrl, response, endpoint, expected }) => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestProvider({ ...baseConfig, kind, baseUrl } satisfies ProviderConfig, { system: "system", user: "user" });
    expect(result).toBe(expected);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(endpoint);
    const body = JSON.parse(String(firstCall?.[1]?.body));
    if (kind === "gemini") expect(body.store).toBe(false);
  });

  it("maps status errors without exposing provider response bodies or keys", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret-key provider detail", { status: 401 })));
    const error = await requestProvider({ ...baseConfig, kind: "openai-compatible", baseUrl: "https://example.com/v1" }, { system: "s", user: "u" }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ProviderFailure);
    expect((error as ProviderFailure).safeError.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify((error as ProviderFailure).safeError)).not.toContain("secret-key");
  });
});
