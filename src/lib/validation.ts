import { INPUT_LIMIT, MAX_CUSTOM_MODES, MODE_INSTRUCTION_LIMIT, MODE_NAME_LIMIT } from "./constants";
import type { CustomMode, ProviderConfig } from "./types";

export class ValidationError extends Error {}

export function unicodeLength(value: string): number {
  return Array.from(value).length;
}

export function normalizeProviderConfig(config: Omit<ProviderConfig, "schemaVersion">): ProviderConfig {
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();
  if (!apiKey || !model) throw new ValidationError("Required provider field is empty");

  let url: URL;
  try {
    url = new URL(config.baseUrl.trim());
  } catch {
    throw new ValidationError("Invalid Base URL");
  }

  const isLocalHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalHttp) throw new ValidationError("Base URL must use HTTPS");
  if (url.username || url.password || url.search || url.hash) throw new ValidationError("Base URL cannot contain credentials, query, or fragment");

  return {
    schemaVersion: 1,
    kind: config.kind,
    baseUrl: url.toString().replace(/\/$/, ""),
    apiKey,
    model
  };
}

export function validateDraft(text: string): void {
  if (!text.trim()) throw new ValidationError("Draft is empty");
  if (text.length > INPUT_LIMIT) throw new ValidationError("Draft is too long");
}

export function validateCustomMode(mode: CustomMode, existing: CustomMode[]): CustomMode {
  if (!mode.id) throw new ValidationError("Mode id is required");
  const name = mode.name.trim();
  const instruction = mode.instruction.trim();
  if (unicodeLength(name) < 1 || unicodeLength(name) > MODE_NAME_LIMIT) throw new ValidationError("Invalid mode name length");
  if (unicodeLength(instruction) < 1 || unicodeLength(instruction) > MODE_INSTRUCTION_LIMIT) throw new ValidationError("Invalid mode instruction length");
  const replacing = existing.some((item) => item.id === mode.id);
  if (!replacing && existing.length >= MAX_CUSTOM_MODES) throw new ValidationError("Custom mode limit reached");
  return { id: mode.id, name, instruction };
}
