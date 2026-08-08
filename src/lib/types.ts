export type ProviderKind = "openai-compatible" | "anthropic" | "gemini";

export interface ProviderConfig {
  schemaVersion: 1;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface CustomMode {
  id: string;
  name: string;
  instruction: string;
}

export type BuiltinModeId = "auto" | "concise" | "professional";
export type ModeSelection =
  | { type: "builtin"; id: BuiltinModeId }
  | { type: "custom"; id: string };

export interface SyncedSettings {
  schemaVersion: 1;
  activeModeId: BuiltinModeId | string;
  customModes: CustomMode[];
}

export type ErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "INVALID_REQUEST"
  | "HOST_PERMISSION_REQUIRED"
  | "UNAUTHORIZED"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "PROVIDER_ERROR";

export interface SafeError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export interface OptimizeRequest {
  type: "OPTIMIZE";
  requestId: string;
  text: string;
  mode: ModeSelection;
}

export interface CancelOptimizeRequest {
  type: "CANCEL_OPTIMIZE";
  requestId: string;
}

export interface SaveProviderRequest {
  type: "SAVE_PROVIDER";
  config: Omit<ProviderConfig, "schemaVersion">;
}

export interface TestProviderRequest {
  type: "TEST_PROVIDER";
}

export interface ClearProviderRequest {
  type: "CLEAR_PROVIDER";
}

export interface ResetExtensionRequest {
  type: "RESET_EXTENSION";
}

export interface GetPublicSettingsRequest {
  type: "GET_PUBLIC_SETTINGS";
}

export interface SetActiveModeRequest {
  type: "SET_ACTIVE_MODE";
  modeId: string;
}

export interface PublicSettingsChangedMessage {
  type: "PUBLIC_SETTINGS_CHANGED";
  settings: SyncedSettings;
}

export interface TeardownSiteRequest {
  type: "TEARDOWN_SITE";
}

export type InternalRequest =
  | OptimizeRequest
  | CancelOptimizeRequest
  | SaveProviderRequest
  | TestProviderRequest
  | ClearProviderRequest
  | ResetExtensionRequest
  | GetPublicSettingsRequest
  | SetActiveModeRequest;

export type OptimizeResponse =
  | { ok: true; requestId: string; optimizedText: string }
  | { ok: false; requestId: string; error: SafeError };

export type CommandResponse = { ok: true } | { ok: false; error: SafeError };

export type VerificationStatus = "verified" | "externalBlocked";

export interface SiteDescriptor {
  id: string;
  product: string;
  wave: "A" | "B";
  origins: string[];
  selectors: string[];
  verificationStatus: VerificationStatus;
  lastVerifiedVersion?: string;
  verificationNote: string;
}
