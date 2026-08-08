import { browser } from "wxt/browser";
import type { ProviderConfig, SyncedSettings } from "./types";

const PROVIDER_KEY = "providerConfig";
const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS: SyncedSettings = {
  schemaVersion: 1,
  activeModeId: "auto",
  customModes: []
};

export async function restrictStorageAccess(): Promise<void> {
  await Promise.all([
    browser.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
    browser.storage.sync.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  ]);
}

export async function getProviderConfig(): Promise<ProviderConfig | null> {
  const result = await browser.storage.local.get(PROVIDER_KEY);
  const value = result[PROVIDER_KEY] as ProviderConfig | undefined;
  return value?.schemaVersion === 1 ? value : null;
}

export async function setProviderConfig(config: ProviderConfig): Promise<void> {
  await browser.storage.local.set({ [PROVIDER_KEY]: config });
}

export async function clearProviderConfig(): Promise<void> {
  await browser.storage.local.remove(PROVIDER_KEY);
}

export async function getSettings(): Promise<SyncedSettings> {
  const result = await browser.storage.sync.get(SETTINGS_KEY);
  const value = result[SETTINGS_KEY] as SyncedSettings | undefined;
  if (value?.schemaVersion !== 1 || !Array.isArray(value.customModes)) return DEFAULT_SETTINGS;
  const activeModeId = value.activeModeId === "auto" || value.activeModeId === "concise" || value.activeModeId === "professional" || value.customModes.some((mode) => mode.id === value.activeModeId)
    ? value.activeModeId
    : "auto";
  return { ...value, activeModeId };
}

export async function setSettings(settings: SyncedSettings): Promise<void> {
  await browser.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export async function resetStorage(): Promise<void> {
  await Promise.all([browser.storage.local.clear(), browser.storage.sync.clear()]);
}
