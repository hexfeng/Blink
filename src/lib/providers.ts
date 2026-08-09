import { MAX_OUTPUT_TOKENS, REQUEST_TIMEOUT_MS } from "./constants";
import type { ErrorCode, ProviderConfig, SafeError } from "./types";

interface ProviderRequest {
  system: string;
  user: string;
  maxOutputTokens?: number;
  requireOptimizedPromptJson?: boolean;
}

const OPTIMIZED_PROMPT_RESPONSE_FORMAT = {
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
} as const;

export class ProviderFailure extends Error {
  constructor(public readonly safeError: SafeError) {
    super(safeError.message);
  }
}

function endpoint(baseUrl: string, resource: string): string {
  return new URL(resource, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

function makeError(code: ErrorCode, retryable: boolean): SafeError {
  return { code, message: code, retryable };
}

function mapStatus(status: number): SafeError {
  if (status === 401 || status === 403) return makeError("UNAUTHORIZED", false);
  if (status === 404) return makeError("MODEL_NOT_FOUND", false);
  if (status === 429) return makeError("RATE_LIMITED", true);
  if (status === 400) return makeError("REQUEST_REJECTED", false);
  return makeError("PROVIDER_ERROR", status >= 500);
}

async function fetchJson(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new ProviderFailure(makeError("TIMEOUT", true));
    throw new ProviderFailure(makeError("NETWORK_ERROR", true));
  }
  if (!response.ok) throw new ProviderFailure(mapStatus(response.status));
  try {
    return await response.json();
  } catch {
    throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  }
}

function parseOpenAi(data: unknown): string {
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  return content;
}

function parseAnthropic(data: unknown): string {
  const content = (data as { content?: Array<{ type?: string; text?: unknown }> })?.content?.find((item) => item.type === "text")?.text;
  if (typeof content !== "string" || !content.trim()) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  return content;
}

function parseGemini(data: unknown): string {
  const response = data as { status?: string; steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }> };
  if (response.status !== "completed") throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  const step = response.steps?.filter((item) => item.type === "model_output").at(-1);
  const text = step?.content?.filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text as string).join("");
  if (!text?.trim()) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  return text;
}

async function requestWithSignal(config: ProviderConfig, request: ProviderRequest, signal: AbortSignal): Promise<string> {
  const maxTokens = request.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
  if (config.kind === "openai-compatible") {
    const commonBody = {
      model: config.model,
      messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
      stream: false
    };
    const isOfficialOpenAi = new URL(config.baseUrl).hostname === "api.openai.com";
    const body = isOfficialOpenAi
      ? {
          ...commonBody,
          max_completion_tokens: maxTokens,
          ...(config.model === "gpt-5.6-luna" ? { reasoning_effort: "low" } : {}),
          ...(request.requireOptimizedPromptJson ? { response_format: OPTIMIZED_PROMPT_RESPONSE_FORMAT } : {})
        }
      : { ...commonBody, temperature: 0.2, max_tokens: maxTokens };
    const data = await fetchJson(endpoint(config.baseUrl, "chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, signal);
    return parseOpenAi(data);
  }
  if (config.kind === "anthropic") {
    const data = await fetchJson(endpoint(config.baseUrl, "v1/messages"), {
      method: "POST",
      headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, system: request.system, messages: [{ role: "user", content: request.user }], temperature: 0.2, max_tokens: maxTokens })
    }, signal);
    return parseAnthropic(data);
  }
  const data = await fetchJson(endpoint(config.baseUrl, "v1/interactions"), {
    method: "POST",
    headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, system_instruction: request.system, input: request.user, store: false, generation_config: { temperature: 0.2, max_output_tokens: maxTokens } })
  }, signal);
  return parseGemini(data);
}

export async function requestProvider(config: ProviderConfig, request: ProviderRequest, externalSignal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  try {
    return await requestWithSignal(config, request, controller.signal);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export async function testProvider(config: ProviderConfig, signal?: AbortSignal): Promise<void> {
  const result = await requestProvider(config, { system: "Reply with a short plain-text acknowledgement.", user: "OK", maxOutputTokens: 256 }, signal);
  if (!result.trim()) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
}
