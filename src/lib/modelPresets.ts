import { DEFAULT_ANTHROPIC_BASE_URL, DEFAULT_GEMINI_BASE_URL, DEFAULT_OPENAI_BASE_URL } from "./constants";
import type { ProviderKind } from "./types";

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

const PRESETS: Record<ProviderKind, ModelOption[]> = {
  "openai-compatible": [
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", description: "Efficient for fast, high-volume prompt rewrites.", recommended: true },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", description: "Balances capability, latency, and cost." },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", description: "Highest capability for complex professional work." }
  ],
  anthropic: [
    { id: "claude-sonnet-5", name: "Claude Sonnet 5", description: "Strong balance of speed and intelligence.", recommended: true },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", description: "Fastest Claude option for lightweight rewrites." },
    { id: "claude-opus-5", name: "Claude Opus 5", description: "For complex reasoning and professional work." }
  ],
  gemini: [
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", description: "Fast general-purpose model with strong reasoning.", recommended: true },
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite", description: "Lower-cost option for high-volume requests." }
  ]
};

const DEFAULT_BASE_URLS: Record<ProviderKind, string> = {
  "openai-compatible": DEFAULT_OPENAI_BASE_URL,
  anthropic: DEFAULT_ANTHROPIC_BASE_URL,
  gemini: DEFAULT_GEMINI_BASE_URL
};

export function modelPresets(kind: ProviderKind, baseUrl: string): ModelOption[] {
  if (kind !== "openai-compatible") return PRESETS[kind];
  try {
    return new URL(baseUrl).hostname === "api.openai.com" ? PRESETS[kind] : [];
  } catch {
    return [];
  }
}

export function recommendedModel(kind: ProviderKind): string {
  return PRESETS[kind].find((model) => model.recommended)?.id ?? PRESETS[kind][0]?.id ?? "";
}

export function defaultBaseUrl(kind: ProviderKind): string {
  return DEFAULT_BASE_URLS[kind];
}
