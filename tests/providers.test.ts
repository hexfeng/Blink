import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderFailure, requestProvider, testProvider } from "../src/lib/providers";
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
    expect(body).not.toHaveProperty("reasoning_effort");
    if (kind === "gemini") expect(body.store).toBe(false);
  });

  it("maps status errors without exposing provider response bodies or keys", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret-key provider detail", { status: 401 })));
    const error = await requestProvider({ ...baseConfig, kind: "openai-compatible", baseUrl: "https://example.com/v1" }, { system: "s", user: "u" }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ProviderFailure);
    expect((error as ProviderFailure).safeError.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify((error as ProviderFailure).safeError)).not.toContain("secret-key");
  });

  it("uses current token parameters for official OpenAI without sampling controls", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await testProvider({ ...baseConfig, kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna" });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ model: "gpt-5.6-luna", stream: false, max_completion_tokens: 256, reasoning_effort: "low" });
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("temperature");
  });

  it("uses a strict optimized-prompt schema for official OpenAI rewrite requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"optimized_prompt":"result"}' } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestProvider(
      { ...baseConfig, kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna" },
      { system: "system", user: "user", requireOptimizedPromptJson: true }
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "blink_prompt_rewrite",
        strict: true,
        schema: {
          type: "object",
          properties: { optimized_prompt: { type: "string" } },
          required: ["optimized_prompt"],
          additionalProperties: false
        }
      }
    });
  });

  it("does not assume other official OpenAI models support reasoning effort", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await testProvider({ ...baseConfig, kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1" });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("keeps legacy token parameters for third-party OpenAI-compatible services", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestProvider(
      { ...baseConfig, kind: "openai-compatible", baseUrl: "https://gateway.example/proxy/v1", model: "deepseek-reasoner" },
      { system: "system", user: "user", maxOutputTokens: 256 }
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ model: "deepseek-reasoner", temperature: 0.2, max_tokens: 256 });
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("response_format");
  });

  it("maps HTTP 400 to a safe request rejection without exposing the response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret-key unsupported parameter detail", { status: 400 })));

    const error = await requestProvider(
      { ...baseConfig, kind: "openai-compatible", baseUrl: "https://api.openai.com/v1" },
      { system: "s", user: "u" }
    ).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ProviderFailure);
    expect((error as ProviderFailure).safeError).toEqual({ code: "REQUEST_REJECTED", message: "REQUEST_REJECTED", retryable: false });
    expect(JSON.stringify((error as ProviderFailure).safeError)).not.toContain("secret-key");
  });
});
