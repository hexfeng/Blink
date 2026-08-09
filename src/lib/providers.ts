import { MAX_OUTPUT_TOKENS, REQUEST_TIMEOUT_MS } from "./constants";
import type { ErrorCode, ModeSelection, ProviderConfig, ProviderModel, SafeError } from "./types";

export type BenchmarkVariant = "baseline" | "candidate";

export interface OpenAiTuning {
  reasoningEffort: "none" | "low";
  verbosity?: "low";
}

export interface ProviderRequest {
  system: string;
  user: string;
  maxOutputTokens?: number;
  requireOptimizedPromptJson?: boolean;
  openAiTuning?: OpenAiTuning;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export interface ProviderResult {
  text: string;
  durationMs: number;
  usage?: ProviderUsage;
  finishReason?: string;
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

interface OpenAiResponse {
  choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
    prompt_tokens_details?: { cached_tokens?: unknown };
    completion_tokens_details?: { reasoning_tokens?: unknown };
  };
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseOpenAi(data: unknown): Omit<ProviderResult, "durationMs"> {
  const response = data as OpenAiResponse;
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  const usage = response.usage;
  const parsedUsage: ProviderUsage = {};
  const inputTokens = optionalNumber(usage?.prompt_tokens);
  const outputTokens = optionalNumber(usage?.completion_tokens);
  const totalTokens = optionalNumber(usage?.total_tokens);
  const reasoningTokens = optionalNumber(usage?.completion_tokens_details?.reasoning_tokens);
  const cachedInputTokens = optionalNumber(usage?.prompt_tokens_details?.cached_tokens);
  if (inputTokens !== undefined) parsedUsage.inputTokens = inputTokens;
  if (outputTokens !== undefined) parsedUsage.outputTokens = outputTokens;
  if (totalTokens !== undefined) parsedUsage.totalTokens = totalTokens;
  if (reasoningTokens !== undefined) parsedUsage.reasoningTokens = reasoningTokens;
  if (cachedInputTokens !== undefined) parsedUsage.cachedInputTokens = cachedInputTokens;
  return {
    text: content,
    ...(typeof response.choices?.[0]?.finish_reason === "string" ? { finishReason: response.choices[0].finish_reason } : {}),
    ...(Object.keys(parsedUsage).length ? { usage: parsedUsage } : {})
  };
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

export function openAiTuningForMode(mode: ModeSelection, variant: BenchmarkVariant = "candidate"): OpenAiTuning {
  if (variant === "baseline" || (mode.type === "builtin" && mode.id === "professional")) return { reasoningEffort: "low" };
  return { reasoningEffort: "none", verbosity: "low" };
}

async function requestWithSignal(config: ProviderConfig, request: ProviderRequest, signal: AbortSignal): Promise<Omit<ProviderResult, "durationMs">> {
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
          ...(config.model === "gpt-5.6-luna" && request.openAiTuning ? {
            reasoning_effort: request.openAiTuning.reasoningEffort,
            ...(request.openAiTuning.verbosity ? { verbosity: request.openAiTuning.verbosity } : {})
          } : {}),
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
    return { text: parseAnthropic(data) };
  }
  const data = await fetchJson(endpoint(config.baseUrl, "v1/interactions"), {
    method: "POST",
    headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, system_instruction: request.system, input: request.user, store: false, generation_config: { temperature: 0.2, max_output_tokens: maxTokens } })
  }, signal);
  return { text: parseGemini(data) };
}

export async function requestProviderDetailed(config: ProviderConfig, request: ProviderRequest, externalSignal?: AbortSignal): Promise<ProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const startedAt = Date.now();
  try {
    return { ...(await requestWithSignal(config, request, controller.signal)), durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export async function requestProvider(config: ProviderConfig, request: ProviderRequest, externalSignal?: AbortSignal): Promise<string> {
  return (await requestProviderDetailed(config, request, externalSignal)).text;
}

export async function testProvider(config: ProviderConfig, signal?: AbortSignal): Promise<void> {
  const result = await requestProvider(config, {
    system: "Reply with a short plain-text acknowledgement.",
    user: "OK",
    maxOutputTokens: 256,
    ...(config.model === "gpt-5.6-luna" ? { openAiTuning: { reasoningEffort: "low" as const } } : {})
  }, signal);
  if (!result.trim()) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
}

function parseModelList(config: ProviderConfig, data: unknown): ProviderModel[] {
  if (config.kind === "gemini") {
    const models = (data as { models?: Array<{ name?: unknown; displayName?: unknown; description?: unknown; supportedGenerationMethods?: unknown }> })?.models;
    if (!Array.isArray(models)) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
    return models.flatMap((model) => {
      if (typeof model.name !== "string") return [];
      const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
      if (methods.length && !methods.some((method) => method === "generateContent" || method === "interactions")) return [];
      return [{
        id: model.name.replace(/^models\//u, ""),
        ...(typeof model.displayName === "string" ? { name: model.displayName } : {}),
        ...(typeof model.description === "string" ? { description: model.description } : {})
      }];
    });
  }

  const models = (data as { data?: Array<{ id?: unknown; display_name?: unknown }> })?.data;
  if (!Array.isArray(models)) throw new ProviderFailure(makeError("INVALID_RESPONSE", true));
  return models.flatMap((model) => typeof model.id === "string"
    ? [{ id: model.id, ...(typeof model.display_name === "string" ? { name: model.display_name } : {}) }]
    : []);
}

export async function listProviderModels(config: ProviderConfig): Promise<ProviderModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = config.kind === "openai-compatible"
      ? endpoint(config.baseUrl, "models")
      : config.kind === "anthropic"
        ? endpoint(config.baseUrl, "v1/models?limit=100")
        : endpoint(config.baseUrl, "v1beta/models?pageSize=100");
    const headers = config.kind === "anthropic"
      ? { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" }
      : config.kind === "gemini"
        ? { "x-goog-api-key": config.apiKey }
        : { Authorization: `Bearer ${config.apiKey}` };
    const models = parseModelList(config, await fetchJson(url, { method: "GET", headers }, controller.signal));
    return [...new Map(models.map((model) => [model.id, model])).values()].slice(0, 100);
  } finally {
    clearTimeout(timeout);
  }
}
