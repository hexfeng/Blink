import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { browser } from "wxt/browser";
import { ArrowClockwise, CaretDown, Check, CheckCircle, Circle, Eye, EyeSlash, Gear, Lock, MagnifyingGlass, PencilSimple, Plus, Sparkle, Trash, WarningCircle } from "@phosphor-icons/react";
import { DEFAULT_OPENAI_BASE_URL, MAX_CUSTOM_MODES } from "../../src/lib/constants";
import { ERROR_MESSAGE_KEYS } from "../../src/lib/errors";
import { createTranslator } from "../../src/lib/i18n";
import { defaultBaseUrl, modelPresets, recommendedModel, type ModelOption } from "../../src/lib/modelPresets";
import { SITES } from "../../src/lib/sites";
import { DEFAULT_SETTINGS, getProviderConfig, getSettings, setSettings } from "../../src/lib/storage";
import type { CommandResponse, CustomMode, ModelListResponse, ProviderConfig, ProviderKind, ProviderModel, SyncedSettings } from "../../src/lib/types";
import { normalizeProviderConfig, unicodeLength, validateCustomMode, ValidationError } from "../../src/lib/validation";
import { SITE_ICONS } from "./siteIcons";

type ProviderDraft = Omit<ProviderConfig, "schemaVersion">;
type ConnectionState = "idle" | "saved" | "testing" | "success" | "error";
type SiteFilter = "all" | "enabled";

const defaultDraft: ProviderDraft = { kind: "openai-compatible", baseUrl: DEFAULT_OPENAI_BASE_URL, apiKey: "", model: "gpt-5.6-luna" };
const demoProvider: ProviderConfig = { schemaVersion: 1, ...defaultDraft, apiKey: "sk-blink-demo" };
const demoPermissions = Object.fromEntries(SITES.slice(0, 3).map((site) => [site.id, true]));

export function OptionsApp({ demo = false }: { demo?: boolean }) {
  const t = useMemo(() => createTranslator(), []);
  const [provider, setProvider] = useState<ProviderConfig | null>(demo ? demoProvider : null);
  const [draft, setDraft] = useState<ProviderDraft>(demo ? { ...defaultDraft, apiKey: demoProvider.apiKey } : defaultDraft);
  const [settings, setLocalSettings] = useState<SyncedSettings>(DEFAULT_SETTINGS);
  const [permissionState, setPermissionState] = useState<Record<string, boolean>>(demo ? demoPermissions : {});
  const [showKey, setShowKey] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [feedback, setFeedback] = useState<string>("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [remoteModels, setRemoteModels] = useState<Record<string, ProviderModel[]>>({});
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsUpdatedAt, setModelsUpdatedAt] = useState<number | null>(null);
  const [siteFilter, setSiteFilter] = useState<SiteFilter>("all");
  const [siteSearch, setSiteSearch] = useState("");
  const [editingMode, setEditingMode] = useState<CustomMode | null>(null);
  const modelCombobox = useRef<HTMLDivElement>(null);
  const modeDialog = useRef<HTMLDialogElement>(null);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!demo) void load();
  }, [demo]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!modelCombobox.current?.contains(event.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modelMenuOpen]);

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
  const enabledSiteCount = SITES.filter((site) => permissionState[site.id]).length;
  const modelSourceKey = `${draft.kind}:${draft.baseUrl.trim()}`;
  const presetModels = modelPresets(draft.kind, draft.baseUrl);
  const modelOptions = mergeModelOptions(presetModels, remoteModels[modelSourceKey] ?? [], t("providerModel"));
  const exactModel = modelOptions.some((model) => model.id.toLowerCase() === draft.model.trim().toLowerCase());
  const visibleModels = exactModel || !draft.model.trim()
    ? modelOptions
    : modelOptions.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(draft.model.trim().toLowerCase()));
  const visibleSites = SITES.filter((site) => {
    if (siteFilter === "enabled" && !permissionState[site.id]) return false;
    if (!siteSearch.trim()) return true;
    const domains = site.origins.map(siteHostname).join(" ");
    return `${site.product} ${domains}`.toLowerCase().includes(siteSearch.trim().toLowerCase());
  });

  function updateKind(kind: ProviderKind) {
    setDraft((current) => ({ ...current, kind, baseUrl: defaultBaseUrl(kind), model: recommendedModel(kind) }));
    setModelMenuOpen(false);
    setModelsUpdatedAt(null);
    setConnection("idle");
  }

  async function refreshModels() {
    if (demo) {
      setModelsUpdatedAt(Date.now());
      return;
    }
    setModelsLoading(true);
    setFeedback("");
    try {
      const normalized = normalizeProviderConfig(draft);
      const origin = `${new URL(normalized.baseUrl).origin}/*`;
      const granted = await browser.permissions.request({ origins: [origin] });
      if (!granted) {
        setFeedback(t("permissionDenied"));
        return;
      }
      const response = await browser.runtime.sendMessage({ type: "LIST_MODELS", config: draft }) as ModelListResponse;
      if (!response.ok) {
        setFeedback(t(ERROR_MESSAGE_KEYS[response.error.code]));
        return;
      }
      setRemoteModels((current) => ({ ...current, [modelSourceKey]: response.models }));
      setModelsUpdatedAt(Date.now());
      setModelMenuOpen(true);
    } catch (error) {
      setFeedback(error instanceof ValidationError ? t("validationRequired") : t("providerError"));
    } finally {
      setModelsLoading(false);
    }
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
    if (demo) {
      setPermissionState((current) => ({ ...current, [site.id]: enabled }));
      return;
    }
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
              <label>{t("model")}
                <div className="model-combobox" ref={modelCombobox}>
                  <div className={`model-input${modelMenuOpen ? " model-input--open" : ""}`}>
                    <input
                      id="provider-model"
                      value={draft.model}
                      aria-label={t("model")}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="model-options"
                      aria-expanded={modelMenuOpen}
                      onFocus={() => setModelMenuOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") setModelMenuOpen(true);
                        if (event.key === "Escape") setModelMenuOpen(false);
                      }}
                      onChange={(event) => {
                        setDraft({ ...draft, model: event.target.value });
                        setConnection("idle");
                        setModelMenuOpen(true);
                      }}
                      required
                    />
                    <MagnifyingGlass size={17} aria-hidden="true" />
                    <button type="button" aria-label={t("toggleModelList")} onClick={() => setModelMenuOpen((open) => !open)}><CaretDown size={16} /></button>
                  </div>
                  {modelMenuOpen ? <div className="model-menu">
                    <div id="model-options" role="listbox">
                      {visibleModels.some((model) => model.recommended) ? <ModelGroup
                        label={t("recommended")}
                        models={visibleModels.filter((model) => model.recommended)}
                        selected={draft.model}
                        recommendationLabel={t("recommended")}
                        onSelect={(model) => { setDraft({ ...draft, model }); setConnection("idle"); setModelMenuOpen(false); }}
                      /> : null}
                      <ModelGroup
                        label={t("available")}
                        models={visibleModels.filter((model) => !model.recommended)}
                        selected={draft.model}
                        recommendationLabel={t("recommended")}
                        onSelect={(model) => { setDraft({ ...draft, model }); setConnection("idle"); setModelMenuOpen(false); }}
                      />
                      <div className="model-group model-custom">
                        <span className="model-group-label">{t("custom")}</span>
                        <button type="button" role="option" aria-selected={!exactModel && Boolean(draft.model.trim())} onClick={() => setModelMenuOpen(false)}>
                          <span>{draft.model.trim() && !exactModel ? draft.model.trim() : t("customModelId")}</span>
                          <small>{t("customModelHelp")}</small>
                        </button>
                      </div>
                    </div>
                    <div className="model-menu-footer">
                      <button type="button" onClick={() => void refreshModels()} disabled={modelsLoading}><ArrowClockwise size={15} />{modelsLoading ? t("loadingModels") : t("refreshModels")}</button>
                      <span>{modelsUpdatedAt ? t("modelsUpdated") : t("modelAvailabilityNote")}</span>
                    </div>
                  </div> : null}
                </div>
              </label>
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
            <div className="sites-heading-row">
              <div className="sites-title-group"><SectionHeading id="sites-title" number="3" title={t("supportedSites")} help={t("supportedSitesHelp")} /><span className="enabled-count">{t("enabledCount").replace("{count}", String(enabledSiteCount))}</span></div>
              <div className="site-toolbar">
                <div className="site-filter" aria-label={t("siteFilter")}>
                  <button className={siteFilter === "all" ? "active" : ""} type="button" onClick={() => setSiteFilter("all")}>{t("all")}</button>
                  <button className={siteFilter === "enabled" ? "active" : ""} type="button" onClick={() => setSiteFilter("enabled")}>{t("enabled")}</button>
                </div>
                <label className="site-search"><span className="sr-only">{t("searchSites")}</span><MagnifyingGlass size={16} aria-hidden="true" /><input type="search" value={siteSearch} placeholder={t("searchSites")} onChange={(event) => setSiteSearch(event.target.value)} /></label>
              </div>
            </div>
            <div className="site-grid">
              {visibleSites.map((site) => {
                const blocked = site.verificationStatus === "externalBlocked";
                const pending = site.verificationStatus === "pendingVerification";
                const enabled = Boolean(permissionState[site.id]);
                const statusClass = enabled ? "enabled" : blocked ? "blocked" : pending ? "pending" : "verified";
                const statusLabel = enabled ? t("enabled") : blocked ? t("externalBlocked") : pending ? t("pendingVerification") : t("verified");
                return <article className={`site-card${enabled ? " site-card--enabled" : ""}`} key={site.id}>
                  <img className="site-logo" src={SITE_ICONS[site.id]} alt="" />
                  <div className="site-card-copy"><strong>{site.product}</strong><small>{site.origins.map(siteHostname).join(" · ")}</small></div>
                  <label className="switch"><input type="checkbox" aria-label={`${site.product}: ${t("siteAllowed")}`} checked={enabled} disabled={blocked} onChange={(event) => void toggleSite(site.id, event.target.checked)} /><span /></label>
                  <span className={`status-badge status-badge--${statusClass}`}>{statusLabel}</span>
                </article>;
              })}
              {!visibleSites.length ? <p className="site-empty">{t("noSitesFound")}</p> : null}
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

function ModelGroup({ label, models, selected, recommendationLabel, onSelect }: { label: string; models: ModelOption[]; selected: string; recommendationLabel: string; onSelect: (model: string) => void }) {
  if (!models.length) return null;
  return <div className="model-group">
    <span className="model-group-label">{label}</span>
    {models.map((model) => <button key={model.id} type="button" role="option" aria-selected={selected === model.id} onClick={() => onSelect(model.id)}>
      <span className="model-check">{selected === model.id ? <Check size={15} weight="bold" /> : null}</span>
      <span className="model-option-copy"><strong>{model.name}{model.recommended ? <em>{recommendationLabel}</em> : null}</strong><small><code>{model.id}</code><span>·</span>{model.description}</small></span>
    </button>)}
  </div>;
}

function mergeModelOptions(presets: ModelOption[], remote: ProviderModel[], providerDescription: string): ModelOption[] {
  const options = new Map(presets.map((model) => [model.id, model]));
  remote.forEach((model) => {
    const current = options.get(model.id);
    options.set(model.id, {
      id: model.id,
      name: current?.name ?? model.name ?? model.id,
      description: current?.description ?? model.description ?? providerDescription,
      ...(current?.recommended ? { recommended: true } : {})
    });
  });
  return [...options.values()];
}

function siteHostname(origin: string): string {
  return new URL(origin.replace("*", "")).hostname;
}

function ConfirmDialog({ ref, title, cancel, confirm, onConfirm }: { ref: React.RefObject<HTMLDialogElement | null>; title: string; cancel: string; confirm: string; onConfirm: () => void }) {
  return <dialog ref={ref} className="settings-dialog confirm-dialog"><h2>{title}</h2><div className="dialog-actions"><button type="button" onClick={() => ref.current?.close()}>{cancel}</button><button className="danger-button" type="button" onClick={onConfirm}>{confirm}</button></div></dialog>;
}
