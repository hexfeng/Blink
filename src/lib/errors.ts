import type { MessageKey } from "./i18n";
import type { ErrorCode, SafeError } from "./types";

export const ERROR_MESSAGE_KEYS: Record<ErrorCode, MessageKey> = {
  PROVIDER_NOT_CONFIGURED: "providerNotConfigured",
  INVALID_REQUEST: "invalidRequest",
  HOST_PERMISSION_REQUIRED: "hostPermissionRequired",
  UNAUTHORIZED: "unauthorized",
  MODEL_NOT_FOUND: "modelNotFound",
  RATE_LIMITED: "rateLimited",
  TIMEOUT: "timeout",
  NETWORK_ERROR: "networkError",
  INVALID_RESPONSE: "invalidResponse",
  PROVIDER_ERROR: "providerError"
};

export function safeError(code: ErrorCode, retryable = false): SafeError {
  return { code, message: code, retryable };
}
