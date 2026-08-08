import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { browser } from "wxt/browser";
import { CheckCircle, Circle, Eye, EyeSlash, Gear, Globe, Lock, PencilSimple, Plus, Sparkle, Trash, WarningCircle } from "@phosphor-icons/react";
import { DEFAULT_ANTHROPIC_BASE_URL, DEFAULT_GEMINI_BASE_URL, DEFAULT_OPENAI_BASE_URL, MAX_CUSTOM_MODES } from "../../src/lib/constants";
import { ERROR_MESSAGE_KEYS } from "../../src/lib/errors";
import { createTranslator } from "../../src/lib/i18n";
import { SITES } from "../../src/lib/sites";
import { DEFAULT_SETTINGS, getProviderConfig, getSettings, setSettings } from "../../src/lib/storage";
import type { CommandResponse, CustomMode, ProviderConfig, ProviderKind, SyncedSettings } from "../../src/lib/types";
import { normalizeProviderConfig, unicodeLength, validateCustomMode, ValidationError } from "../../src/lib/validation";

type ProviderDraft = Omit<ProviderConfig, "schemaVersion">;
type ConnectionState = "idle" | "saved" | "testing" | "success" | "error";

const defaultDraft: ProviderDraft = { kind: "openai-compatible", baseUrl: DEFAULT_OPENAI_BASE_URL, apiKey: "", model: "" };

export function OptionsApp({ demo = false }: { demo?: boolean }) {
  const t = useMemo(() => createTranslator(), []);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(defaultDraft);
  const [settings, setLocalSettings] = useState<SyncedSettings>(DEFAULT_SETTINGS);
  const [permissionState, setPermissionState] = useState<Record<string, boolean>>({});
  const [showKey, setShowKey] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [feedback, setFeedback] = useState<string>("");
  const [editingMode, setEditingMode] = useState<CustomMode | null>(null);
  const modeDialog = useRef<HTMLDialogElement>(null);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!demo) void load();
  }, [demo]);

  async function load() {
    const [storedProvider, storedSettings] = await Promise.all([getProviderConfig(), getSettings()]);
    setProvider(storedProvider);
    setDraft(storedProvider ? { kind: storedProvider.kind, baseUrl: storedProvider.baseUrl, apiKey: storedProvider.apiKey, model: storedProvider.model } : defaultDraft);
    setLocalSettings(storedSettings);
    const entries = await Promise.all(SITES.map(async (site) => [site.id, await browser.permissions.contains({ origins: site.origins })] as const));
    setPermissionState(Object.fromEntries(entries));
  }

  const serializedDraft = JSON.stringify(draft);
  const serializedProvider = provider ? JSON.stringify({ kind: provider.kind, baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: provider.model }) : "";
  const dirty = serializedDraft !== serializedProvider;
  const hasAllowedSite = SITES.some((site) => site.verificationStatus !== "externalBlocked" && permissionState[site.id]);
  const ready = Boolean(provider && hasAllowedSite);

  function updateKind(kind: ProviderKind) {
    const baseUrl = kind === "anthropic" ? DEFAULT_ANTHROPIC_BASE_URL : kind === "gemini" ? DEFAULT_GEMINI_BASE_URL : DEFAULT_OPENAI_BASE_URL;
    setDraft((current) => ({ ...current, kind, baseUrl }));
    setConnection("idle");
  }

  async function saveProvider(event: FormEvent) {
    event.preventDefault();
    setFeedback("");
    try {
      const normalized = normalizeProviderConfig(draft);
      const origin = `${new URL(normalized.baseUrl).origin}/*`;
      const granted = await browser.permissions.request({ origins: [origin] });
      if (!granted) {
        setFeedback(t("permissionDenied"));
        return;
      }
      const response = await browser.runtime.sendMessage({ type: "SAVE_PROVIDER", config: draft }) as CommandResponse;
      if (!response.ok) {
        setFeedback(t(ERROR_MESSAGE_KEYS[response.error.code]));
        setConnection("error");
        return;
      }
      setProvider(normalized);
      setDraft({ kind: normalized.kind, baseUrl: normalized.baseUrl, apiKey: normalized.apiKey, model: normalized.model });
      setConnection("saved");
      setFeedback(t("saved"));
    } catch (error) {
      setFeedback(error instanceof ValidationError ? t("validationRequired") : t("providerError"));
      setConnection("error");
    }
  }

  async function runConnectionTest() {
    if (dirty || !provider) {
      setFeedback(t("saveBeforeTest"));
      return;
    }
    setConnection("testing");
    setFeedback("");
    const response = await browser.runtime.sendMessage({ type: "TEST_PROVIDER" }) as CommandResponse;
    if (response.ok) {
      setConnection("success");
      setFeedback(t("connectionSuccess"));
    } else {
      setConnection("error");
      setFeedback(t(ERROR_MESSAGE_KEYS[response.error.code]));
    }
  }

  async function toggleSite(siteId: string, enabled: boolean) {
    const site = SITES.find((item) => item.id === siteId);
    if (!site || site.verificationStatus === "externalBlocked") return;
    if (enabled) {
      const granted = await browser.permissions.request({ origins: site.origins });
      if (!granted) return setFeedback(t("permissionDenied"));
    } else {
      const tabs = await browser.tabs.query({ url: site.origins });
      await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [browser.tabs.sendMessage(tab.id, { type: "TEARDOWN_SITE" }).catch(() => undefined)]));
      await browser.permissions.remove({ origins: site.origins });
    }
    setPermissionState((current) => ({ ...current, [site.id]: enabled }));
  }

  function openNewMode() {
    setEditingMode({ id: crypto.randomUUID(), name: "", instruction: "" });
    modeDialog.current?.showModal();
  }

  function openEditMode(mode: CustomMode) {
    setEditingMode(mode);
    modeDialog.current?.showModal();
  }

  async function saveMode(event: FormEvent) {
    event.preventDefault();
    if (!editingMode) return;
    try {
      const valid = validateCustomMode(editingMode, settings.customModes);
      const exists = settings.customModes.some((mode) => mode.id === valid.id);
      const customModes = exists ? settings.customModes.map((mode) => mode.id === valid.id ? valid : mode) : [...settings.customModes, valid];
      const next = { ...settings, customModes };
      await setSettings(next);
      setLocalSettings(next);
      modeDialog.current?.close();
      setEditingMode(null);
      setFeedback("");
    } catch (error) {
      setFeedback(error instanceof ValidationError ? error.message : t("providerError"));
    }
  }

  async function deleteMode(modeId: string) {
    const customModes = settings.customModes.filter((mode) => mode.id !== modeId);
    const next = { ...settings, customModes, activeModeId: settings.activeModeId === modeId ? "auto" : settings.activeModeId };
    await setSettings(next);
    setLocalSettings(next);
  }

  async function clearProvider() {
    const response = await browser.runtime.sendMessage({ type: "CLEAR_PROVIDER" }) as CommandResponse;
    if (response.ok) {
      setProvider(null);
      setDraft(defaultDraft);
      setConnection("idle");
      setFeedback("");
      clearDialog.current?.close();
    }
  }

  async function resetBlink() {
    const response = await browser.runtime.sendMessage({ type: "RESET_EXTENSION" }) as CommandResponse;
    if (response.ok) {
      resetDialog.current?.close();
      await load();
      setConnection("idle");
      setFeedback("");
    }
  }

  return (
    <main className="options-shell">
      <header className="brand-header">
        <div className="brand-mark"><img src="/icons/blink-128.png" alt="" /></div>
        <div><h1>{t("settingsTitle")}</h1><p>{t("settingsSubtitle")}</p></div>
      </header>

      <div className="settings-layout">
        <aside className="readiness" aria-label={t("readiness")}>
          <h2>{t("readiness")}</h2>
          <ReadinessItem done={Boolean(provider)} label={t("modelConfigured")} />
          <ReadinessItem done={hasAllowedSite} label={t("siteAllowed")} />
          <ReadinessItem done={ready} label={t("ready")} />
          <p>{ready ? t("ready") : t("notReady")}</p>
          {!hasAllowedSite ? <p className="readiness-note">{t("noSiteVerified")}</p> : null}
        </aside>

        <div className="settings-content">
          <section className="settings-section model-section" aria-labelledby="model-title">
            <SectionHeading id="model-title" number="1" title={t("modelService")} help={t("modelServiceHelp")} />
            <form className="provider-form" onSubmit={saveProvider}>
              <label>{t("provider")}<select value={draft.kind} onChange={(event) => updateKind(event.target.value as ProviderKind)}><option value="openai-compatible">OpenAI-compatible</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
              <label>{t("baseUrl")}<input type="url" value={draft.baseUrl} onChange={(event) => { setDraft({ ...draft, baseUrl: event.target.value }); setConnection("idle"); }} required /></label>
              <label>{t("apiKey")}<span className="secret-field"><input type={showKey ? "text" : "password"} value={draft.apiKey} onChange={(event) => { setDraft({ ...draft, apiKey: event.target.value }); setConnection("idle"); }} autoComplete="off" required /><button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Hide API key" : "Show API key"}>{showKey ? <EyeSlash size={18} /> : <Eye size={18} />}</button></span></label>
              <label>{t("model")}<input value={draft.model} onChange={(event) => { setDraft({ ...draft, model: event.target.value }); setConnection("idle"); }} required /></label>
              <p className="privacy-copy"><Lock size={16} aria-hidden="true" />{t("apiKeyDisclosure")}</p>
              <div className="form-actions"><button className="primary-button" type="submit">{t("save")}</button><button className="text-button" type="button" onClick={() => void runConnectionTest()} disabled={connection === "testing"}>{connection === "testing" ? t("testing") : t("testConnection")}</button></div>
              {feedback ? <p className={`feedback feedback--${connection}`} role="status">{connection === "success" ? <CheckCircle size={17} weight="fill" /> : connection === "error" ? <WarningCircle size={17} weight="fill" /> : null}{feedback}</p> : null}
            </form>
          </section>

          <section className="settings-section modes-section" aria-labelledby="modes-title">
            <SectionHeading id="modes-title" number="2" title={t("optimizationModes")} help={t("optimizationModesHelp")} />
            <div className="mode-list">
              {[{ id: "auto", label: t("auto"), description: t("autoDescription") }, { id: "concise", label: t("concise"), description: t("conciseDescription") }, { id: "professional", label: t("professional"), description: t("professionalDescription") }].map((mode) => <ModeRow key={mode.id} label={mode.label} description={mode.description} />)}
              {settings.customModes.map((mode) => <ModeRow key={mode.id} label={mode.name} description={mode.instruction} onEdit={() => openEditMode(mode)} onDelete={() => void deleteMode(mode.id)} />)}
            </div>
            <div className="section-action"><span>{settings.customModes.length}/{MAX_CUSTOM_MODES}</span><button type="button" onClick={openNewMode} disabled={settings.customModes.length >= MAX_CUSTOM_MODES}><Plus size={17} />{t("addMode")}</button></div>
          </section>

          <section className="settings-section sites-section" aria-labelledby="sites-title">
            <SectionHeading id="sites-title" number="3" title={t("supportedSites")} help={t("supportedSitesHelp")} />
            <div className="site-list">
              {SITES.map((site) => {
                const blocked = site.verificationStatus === "externalBlocked";
                const pending = site.verificationStatus === "pendingVerification";
                const statusClass = blocked ? "blocked" : pending ? "pending" : "verified";
                const statusLabel = blocked ? t("externalBlocked") : pending ? t("pendingVerification") : t("verified");
                return <div className="site-row" key={site.id}><Globe size={18} aria-hidden="true" /><div><strong>{site.product}</strong><small>{site.origins.map((origin) => new URL(origin.replace("*", "")).hostname).join(" · ")}</small><small>{site.verificationNote}</small></div><span className={`status-badge status-badge--${statusClass}`}>{statusLabel}</span><label className="switch"><input type="checkbox" aria-label={`${site.product}: ${t("siteAllowed")}`} checked={Boolean(permissionState[site.id])} disabled={blocked} onChange={(event) => void toggleSite(site.id, event.target.checked)} /><span /></label></div>;
              })}
            </div>
          </section>

          <section className="danger-zone" aria-label="Reset actions">
            <button type="button" onClick={() => clearDialog.current?.showModal()}><Trash size={18} /><span><strong>{t("clearProvider")}</strong><small>{t("clearProviderHelp")}</small></span></button>
            <button type="button" onClick={() => resetDialog.current?.showModal()}><Gear size={18} /><span><strong>{t("resetBlink")}</strong><small>{t("resetBlinkHelp")}</small></span></button>
          </section>
        </div>
      </div>

      <dialog ref={modeDialog} className="settings-dialog" onClose={() => setEditingMode(null)}>
        <form onSubmit={saveMode}>
          <h2>{editingMode && settings.customModes.some((mode) => mode.id === editingMode.id) ? t("editMode") : t("addMode")}</h2>
          <label>{t("modeName")}<input autoFocus value={editingMode?.name ?? ""} onChange={(event) => editingMode && setEditingMode({ ...editingMode, name: event.target.value })} /><small>{unicodeLength(editingMode?.name ?? "")}/{20}</small></label>
          <label>{t("modeInstruction")}<textarea rows={7} value={editingMode?.instruction ?? ""} onChange={(event) => editingMode && setEditingMode({ ...editingMode, instruction: event.target.value })} /><small>{unicodeLength(editingMode?.instruction ?? "")}/{800}</small></label>
          <div className="dialog-actions"><button type="button" onClick={() => modeDialog.current?.close()}>{t("cancel")}</button><button className="primary-button" type="submit">{t("save")}</button></div>
        </form>
      </dialog>
      <ConfirmDialog ref={clearDialog} title={t("confirmClearProvider")} cancel={t("cancel")} confirm={t("confirm")} onConfirm={() => void clearProvider()} />
      <ConfirmDialog ref={resetDialog} title={t("confirmReset")} cancel={t("cancel")} confirm={t("confirm")} onConfirm={() => void resetBlink()} />
    </main>
  );
}

function ReadinessItem({ done, label }: { done: boolean; label: string }) {
  return <div className={`readiness-item${done ? " readiness-item--done" : ""}`}>{done ? <CheckCircle size={19} weight="fill" /> : <Circle size={19} />}<span>{label}</span></div>;
}

function SectionHeading({ id, number, title, help }: { id: string; number: string; title: string; help: string }) {
  return <header className="section-heading"><span>{number}</span><div><h2 id={id}>{title}</h2><p>{help}</p></div></header>;
}

function ModeRow({ label, description, onEdit, onDelete }: { label: string; description: string; onEdit?: () => void; onDelete?: () => void }) {
  return <div className="mode-row"><Sparkle size={17} aria-hidden="true" /><div><strong>{label}</strong><small>{description}</small></div>{onEdit ? <button type="button" onClick={onEdit} aria-label={`Edit ${label}`}><PencilSimple size={17} /></button> : <span className="builtin-label">Built-in</span>}{onDelete ? <button type="button" onClick={onDelete} aria-label={`Delete ${label}`}><Trash size={17} /></button> : null}</div>;
}

function ConfirmDialog({ ref, title, cancel, confirm, onConfirm }: { ref: React.RefObject<HTMLDialogElement | null>; title: string; cancel: string; confirm: string; onConfirm: () => void }) {
  return <dialog ref={ref} className="settings-dialog confirm-dialog"><h2>{title}</h2><div className="dialog-actions"><button type="button" onClick={() => ref.current?.close()}>{cancel}</button><button className="danger-button" type="button" onClick={onConfirm}>{confirm}</button></div></dialog>;
}
