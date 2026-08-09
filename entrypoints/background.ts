import { browser } from "wxt/browser";
import { CONTENT_SCRIPT_FILE, CONTENT_SCRIPT_ID } from "../src/lib/constants";
import { safeError } from "../src/lib/errors";
import { buildProviderPrompt, parseOptimizedResponse } from "../src/lib/prompts";
import { openAiTuningForMode, ProviderFailure, requestProvider, testProvider } from "../src/lib/providers";
import { SITE_PATTERNS, findSiteByUrl, originPattern } from "../src/lib/sites";
import { clearProviderConfig, getProviderConfig, getSettings, resetStorage, restrictStorageAccess, setProviderConfig, setSettings } from "../src/lib/storage";
import type { CommandResponse, InternalRequest, OptimizeResponse, SyncedSettings } from "../src/lib/types";
import { normalizeProviderConfig, validateDraft, ValidationError } from "../src/lib/validation";

const activeRequests = new Map<string, { requestId: string; controller: AbortController }>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let reconcileTail: Promise<void> = Promise.resolve();

function optionsSender(sender: Browser.runtime.MessageSender): boolean {
  return sender.id === browser.runtime.id && sender.url === browser.runtime.getURL("/options.html");
}

async function contentSender(sender: Browser.runtime.MessageSender): Promise<boolean> {
  if (sender.id !== browser.runtime.id || sender.frameId !== 0 || !sender.url || sender.tab?.id === undefined) return false;
  if (!findSiteByUrl(sender.url)) return false;
  return browser.permissions.contains({ origins: [originPattern(sender.url)] });
}

function requestKey(sender: Browser.runtime.MessageSender): string | null {
  if (sender.tab?.id === undefined) return null;
  return `${sender.tab.id}:${sender.documentId ?? "top"}`;
}

async function grantedSitePatterns(): Promise<string[]> {
  const checks = await Promise.all(SITE_PATTERNS.map(async (pattern) => ({ pattern, granted: await browser.permissions.contains({ origins: [pattern] }) })));
  return checks.filter((item) => item.granted).map((item) => item.pattern);
}

async function reconcileContentScriptsNow(): Promise<void> {
  const granted = await grantedSitePatterns();
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (!granted.length) {
    if (existing.length) await browser.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    return;
  }
  const registration = {
    id: CONTENT_SCRIPT_ID,
    matches: granted,
    js: [CONTENT_SCRIPT_FILE],
    css: [],
    runAt: "document_idle" as const,
    persistAcrossSessions: true,
    allFrames: false
  };
  if (existing.length) await browser.scripting.updateContentScripts([registration]);
  else {
    try {
      await browser.scripting.registerContentScripts([registration]);
    } catch (error) {
      const concurrentlyRegistered = await browser.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
      if (!concurrentlyRegistered.length) throw error;
      await browser.scripting.updateContentScripts([registration]);
    }
  }
}

function reconcileContentScripts(): Promise<void> {
  const next = reconcileTail.then(reconcileContentScriptsNow, reconcileContentScriptsNow);
  reconcileTail = next.catch(() => undefined);
  return next;
}

async function injectOpenTabs(patterns: string[]): Promise<void> {
  if (!patterns.length) return;
  const tabs = await browser.tabs.query({ url: patterns });
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [browser.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT_FILE] }).catch(() => undefined)]));
}

async function teardownTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [browser.tabs.sendMessage(tab.id, { type: "TEARDOWN_SITE" }).catch(() => undefined)]));
}

async function broadcastSettings(settings: SyncedSettings): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [browser.tabs.sendMessage(tab.id, { type: "PUBLIC_SETTINGS_CHANGED", settings }).catch(() => undefined)]));
}

async function handleOptimize(message: Extract<InternalRequest, { type: "OPTIMIZE" }>, sender: Browser.runtime.MessageSender): Promise<OptimizeResponse> {
  if (!(await contentSender(sender)) || !uuidPattern.test(message.requestId)) return { ok: false, requestId: message.requestId, error: safeError("INVALID_REQUEST") };
  try {
    validateDraft(message.text);
  } catch {
    return { ok: false, requestId: message.requestId, error: safeError("INVALID_REQUEST") };
  }
  const key = requestKey(sender);
  if (!key || activeRequests.has(key)) return { ok: false, requestId: message.requestId, error: safeError("INVALID_REQUEST") };
  const config = await getProviderConfig();
  if (!config) return { ok: false, requestId: message.requestId, error: safeError("PROVIDER_NOT_CONFIGURED") };
  if (!(await browser.permissions.contains({ origins: [originPattern(config.baseUrl)] }))) return { ok: false, requestId: message.requestId, error: safeError("HOST_PERMISSION_REQUIRED") };
  const settings = await getSettings();
  let prompt: { system: string; user: string };
  try {
    prompt = buildProviderPrompt(message.text, message.mode, settings.customModes);
  } catch {
    return { ok: false, requestId: message.requestId, error: safeError("INVALID_REQUEST") };
  }

  const controller = new AbortController();
  activeRequests.set(key, { requestId: message.requestId, controller });
  try {
    const raw = await requestProvider(config, {
      ...prompt,
      requireOptimizedPromptJson: true,
      ...(config.model === "gpt-5.6-luna" ? { openAiTuning: openAiTuningForMode(message.mode) } : {})
    }, controller.signal);
    const optimizedText = parseOptimizedResponse(raw, message.text);
    return { ok: true, requestId: message.requestId, optimizedText };
  } catch (error) {
    if (error instanceof ProviderFailure) return { ok: false, requestId: message.requestId, error: error.safeError };
    return { ok: false, requestId: message.requestId, error: safeError("INVALID_RESPONSE", true) };
  } finally {
    if (activeRequests.get(key)?.requestId === message.requestId) activeRequests.delete(key);
  }
}

async function handleMessage(message: InternalRequest, sender: Browser.runtime.MessageSender): Promise<OptimizeResponse | CommandResponse | { ok: true; settings: SyncedSettings }> {
  if (!message || typeof message !== "object" || typeof message.type !== "string") return { ok: false, error: safeError("INVALID_REQUEST") };
  if (message.type === "OPTIMIZE") return handleOptimize(message, sender);
  if (message.type === "CANCEL_OPTIMIZE") {
    if (!(await contentSender(sender))) return { ok: false, error: safeError("INVALID_REQUEST") };
    const key = requestKey(sender);
    const active = key ? activeRequests.get(key) : undefined;
    if (active?.requestId === message.requestId) active.controller.abort();
    return { ok: true };
  }
  if (message.type === "GET_PUBLIC_SETTINGS") {
    if (!optionsSender(sender) && !(await contentSender(sender))) return { ok: false, error: safeError("INVALID_REQUEST") };
    return { ok: true, settings: await getSettings() };
  }
  if (message.type === "SET_ACTIVE_MODE") {
    if (!(await contentSender(sender))) return { ok: false, error: safeError("INVALID_REQUEST") };
    const settings = await getSettings();
    const valid = message.modeId === "auto" || message.modeId === "concise" || message.modeId === "professional" || settings.customModes.some((mode) => mode.id === message.modeId);
    if (!valid) return { ok: false, error: safeError("INVALID_REQUEST") };
    const next = { ...settings, activeModeId: message.modeId };
    await setSettings(next);
    await broadcastSettings(next);
    return { ok: true, settings: next };
  }
  if (!optionsSender(sender)) return { ok: false, error: safeError("INVALID_REQUEST") };
  if (message.type === "SAVE_PROVIDER") {
    try {
      const config = normalizeProviderConfig(message.config);
      if (!(await browser.permissions.contains({ origins: [originPattern(config.baseUrl)] }))) return { ok: false, error: safeError("HOST_PERMISSION_REQUIRED") };
      await setProviderConfig(config);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: safeError(error instanceof ValidationError ? "INVALID_REQUEST" : "PROVIDER_ERROR") };
    }
  }
  if (message.type === "TEST_PROVIDER") {
    const config = await getProviderConfig();
    if (!config) return { ok: false, error: safeError("PROVIDER_NOT_CONFIGURED") };
    try {
      await testProvider(config);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof ProviderFailure ? error.safeError : safeError("PROVIDER_ERROR") };
    }
  }
  if (message.type === "CLEAR_PROVIDER") {
    await clearProviderConfig();
    return { ok: true };
  }
  if (message.type === "RESET_EXTENSION") {
    await teardownTabs();
    activeRequests.forEach((request) => request.controller.abort());
    activeRequests.clear();
    const granted = await browser.permissions.getAll();
    if (granted.origins?.length) await browser.permissions.remove({ origins: granted.origins });
    await browser.scripting.unregisterContentScripts().catch(() => undefined);
    await resetStorage();
    await restrictStorageAccess();
    return { ok: true };
  }
  return { ok: false, error: safeError("INVALID_REQUEST") };
}

export default defineBackground({
  type: "module",
  main() {
    void restrictStorageAccess();
    void reconcileContentScripts().catch(() => undefined);
    browser.runtime.onInstalled.addListener((details) => {
      void restrictStorageAccess();
      void reconcileContentScripts().catch(() => undefined);
      if (details.reason === "install") void browser.runtime.openOptionsPage();
    });
    browser.runtime.onMessage.addListener(handleMessage);
    browser.action.onClicked.addListener(() => { void browser.runtime.openOptionsPage(); });
    browser.permissions.onAdded.addListener((permissions) => {
      void reconcileContentScripts().then(() => injectOpenTabs(permissions.origins ?? [])).catch(() => undefined);
    });
    browser.permissions.onRemoved.addListener(() => {
      void teardownTabs().then(() => reconcileContentScripts()).catch(() => undefined);
    });
    browser.storage.sync.onChanged.addListener(() => {
      void getSettings().then(broadcastSettings);
    });
  }
});
