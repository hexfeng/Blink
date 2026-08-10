import { browser } from "wxt/browser";
import { INPUT_LIMIT } from "../lib/constants";
import type { ErrorCode, ModeSelection, OptimizeResponse, PublicSettingsChangedMessage, SiteDescriptor, SyncedSettings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/storage";
import { editorIsVisible, findEditor, findOverlayAnchor, focusEditorEnd, readEditor, writeEditor, type SupportedEditor } from "./editor";

export type OverlayPhase = "ready" | "loading" | "same" | "success" | "error" | "recovery";

export interface OverlayState {
  visible: boolean;
  phase: OverlayPhase;
  menuOpen: boolean;
  settings: SyncedSettings;
  errorCode?: ErrorCode | undefined;
  localMessage?: "empty" | "tooLong" | "draftChanged" | "copied" | undefined;
  recoveryOriginal?: string | undefined;
}

type Listener = (state: OverlayState) => void;

export function isExtensionContextInvalidated(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated");
}

export class BlinkController {
  private editor: SupportedEditor | null = null;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private overlayAnchor: HTMLElement | null = null;
  private navigationTarget: EventTarget | null = null;
  private overlayActive = false;
  private overlayDeactivateTimer: number | undefined;
  private stopped = false;
  private runtimeInvalidated = false;
  private listener: Listener = () => undefined;
  private toastTimer: number | undefined;
  private currentSession = "";
  private request: { id: string; snapshot: string } | null = null;
  private undo: { original: string; optimized: string; session: string } | null = null;
  private state: OverlayState = { visible: false, phase: "ready", menuOpen: false, settings: DEFAULT_SETTINGS };

  constructor(private readonly site: SiteDescriptor, private readonly onPosition: (anchor: HTMLElement | null) => void) {}

  subscribe(listener: Listener): () => void {
    this.listener = listener;
    listener(this.state);
    return () => { this.listener = () => undefined; };
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.currentSession = this.sessionKey();
    await this.refreshSettings();
    if (this.stopped || this.runtimeInvalidated) return;
    this.observer = new MutationObserver(() => {
      this.checkSession();
      this.locate();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", this.handleViewport, { passive: true });
    window.addEventListener("focusin", this.handleFocus, true);
    window.addEventListener("focusout", this.handleFocus, true);
    window.addEventListener("popstate", this.handleSessionChange);
    window.addEventListener("hashchange", this.handleSessionChange);
    window.visualViewport?.addEventListener("resize", this.handleViewport, { passive: true });
    this.navigationTarget = (window as Window & { navigation?: EventTarget }).navigation ?? null;
    this.navigationTarget?.addEventListener("currententrychange", this.handleSessionChange);
    try {
      browser.runtime.onMessage.addListener(this.handleRuntimeMessage);
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) throw error;
      this.runtimeInvalidated = true;
      this.teardown();
      return;
    }
    this.locate();
  }

  teardown(): void {
    if (this.stopped) return;
    this.stopped = true;
    void this.cancelRequest();
    this.detachEditor();
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener("resize", this.handleViewport);
    window.removeEventListener("focusin", this.handleFocus, true);
    window.removeEventListener("focusout", this.handleFocus, true);
    window.removeEventListener("popstate", this.handleSessionChange);
    window.removeEventListener("hashchange", this.handleSessionChange);
    window.visualViewport?.removeEventListener("resize", this.handleViewport);
    this.navigationTarget?.removeEventListener("currententrychange", this.handleSessionChange);
    this.navigationTarget = null;
    try {
      browser.runtime.onMessage.removeListener(this.handleRuntimeMessage);
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) throw error;
    }
    this.update({ visible: false, menuOpen: false });
  }

  async refreshSettings(): Promise<void> {
    const response = await this.sendRuntimeMessage<{ ok: true; settings: SyncedSettings } | { ok: false }>({ type: "GET_PUBLIC_SETTINGS" });
    if (!this.stopped && response?.ok) this.update({ settings: response.settings });
  }

  setMenuOpen(menuOpen: boolean): void {
    this.update({ menuOpen });
    if (menuOpen) void this.refreshSettings();
  }

  setOverlayActive(active: boolean): void {
    if (this.overlayDeactivateTimer) window.clearTimeout(this.overlayDeactivateTimer);
    if (active) {
      this.overlayActive = true;
      this.refreshVisibility();
      return;
    }
    this.overlayDeactivateTimer = window.setTimeout(() => {
      this.overlayActive = false;
      this.refreshVisibility();
    }, 0);
  }

  async selectMode(modeId: string): Promise<void> {
    const response = await this.sendRuntimeMessage<{ ok: boolean; settings?: SyncedSettings }>({ type: "SET_ACTIVE_MODE", modeId });
    if (response?.ok && response.settings) this.update({ settings: response.settings, menuOpen: false });
  }

  async optimize(): Promise<void> {
    if (!this.editor || this.state.phase === "loading") return;
    const snapshot = readEditor(this.editor);
    if (!snapshot.trim()) return this.showLocal("empty");
    if (snapshot.length > INPUT_LIMIT) return this.showLocal("tooLong");
    this.undo = null;
    const requestId = crypto.randomUUID();
    this.request = { id: requestId, snapshot };
    this.update({ phase: "loading", menuOpen: false, errorCode: undefined, localMessage: undefined, recoveryOriginal: undefined });
    const modeId = this.state.settings.activeModeId;
    const mode: ModeSelection = modeId === "auto" || modeId === "concise" || modeId === "professional"
      ? { type: "builtin", id: modeId }
      : { type: "custom", id: modeId };

    const response = await this.sendRuntimeMessage<OptimizeResponse>({ type: "OPTIMIZE", requestId, text: snapshot, mode });
    if (!response) return;
    if (!this.request || this.request.id !== requestId || !this.editor) return;
    this.request = null;
    if (!response.ok) return this.showError(response.error.code);
    if (readEditor(this.editor) !== snapshot) return this.showLocal("draftChanged");
    if (response.optimizedText === snapshot) return this.showTransient("same");

    try {
      writeEditor(this.editor, response.optimizedText);
      if (readEditor(this.editor) !== response.optimizedText) throw new Error("Write-back verification failed");
      this.undo = { original: snapshot, optimized: response.optimizedText, session: this.sessionKey() };
      focusEditorEnd(this.editor);
      this.update({ phase: "success" });
    } catch {
      this.recoverOriginal(snapshot);
    }
  }

  undoLast(): void {
    if (!this.editor || !this.undo || this.undo.session !== this.sessionKey()) return this.clearUndo();
    if (readEditor(this.editor) !== this.undo.optimized) return this.clearUndo();
    const original = this.undo.original;
    try {
      writeEditor(this.editor, original);
      if (readEditor(this.editor) !== original) throw new Error("Undo verification failed");
      this.clearUndo();
      focusEditorEnd(this.editor);
    } catch {
      this.update({ phase: "recovery", recoveryOriginal: original });
    }
  }

  restoreOriginal(): void {
    if (!this.editor || !this.state.recoveryOriginal) return;
    try {
      writeEditor(this.editor, this.state.recoveryOriginal);
      if (readEditor(this.editor) !== this.state.recoveryOriginal) throw new Error("Restore verification failed");
      this.clearUndo();
      focusEditorEnd(this.editor);
    } catch {
      this.update({ phase: "recovery" });
    }
  }

  async copyOriginal(): Promise<void> {
    if (!this.state.recoveryOriginal) return;
    await navigator.clipboard.writeText(this.state.recoveryOriginal);
    this.showLocal("copied");
  }

  openSettings(): void {
    void browser.runtime.openOptionsPage().catch((error: unknown) => {
      if (!isExtensionContextInvalidated(error)) console.error("[Blink] Could not open settings", error);
    });
  }

  private locate(): void {
    const next = findEditor(this.site);
    const nextAnchor = next ? findOverlayAnchor(next, this.site) : null;
    if (next === this.editor && nextAnchor === this.overlayAnchor) return this.refreshVisibility(true);
    if (next === this.editor && nextAnchor) {
      this.overlayAnchor = nextAnchor;
      this.resizeObserver?.disconnect();
      this.resizeObserver?.observe(nextAnchor);
      return this.refreshVisibility(true);
    }
    this.detachEditor();
    if (!next) return;
    this.editor = next;
    const overlayAnchor = nextAnchor ?? next;
    this.overlayAnchor = overlayAnchor;
    next.addEventListener("input", this.handleInput, true);
    next.addEventListener("keydown", this.handleKeydown, true);
    next.closest("form")?.addEventListener("submit", this.handleSubmit, true);
    this.resizeObserver = new ResizeObserver(() => this.refreshVisibility(true));
    this.resizeObserver.observe(overlayAnchor);
    this.intersectionObserver = new IntersectionObserver(() => this.refreshVisibility(), { threshold: [0, 0.01] });
    this.intersectionObserver.observe(next);
    this.refreshVisibility();
  }

  private detachEditor(): void {
    if (this.editor) {
      this.editor.removeEventListener("input", this.handleInput, true);
      this.editor.removeEventListener("keydown", this.handleKeydown, true);
      this.editor.closest("form")?.removeEventListener("submit", this.handleSubmit, true);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.editor = null;
    this.overlayAnchor = null;
    this.overlayActive = false;
    if (this.overlayDeactivateTimer) window.clearTimeout(this.overlayDeactivateTimer);
    this.overlayDeactivateTimer = undefined;
    this.undo = null;
    this.onPosition(null);
    this.update({ visible: false, phase: "ready", menuOpen: false });
  }

  private refreshVisibility(reposition = false): void {
    if (!this.editor) return this.update({ visible: false });
    const focused = document.activeElement === this.editor || this.editor.contains(document.activeElement);
    const visible = editorIsVisible(this.editor) && (focused || this.overlayActive || readEditor(this.editor).length > 0);
    const becameVisible = visible && !this.state.visible;
    this.update({ visible });
    if (!visible) this.onPosition(null);
    else if (becameVisible || reposition) this.onPosition(this.overlayAnchor);
  }

  private recoverOriginal(original: string): void {
    if (!this.editor) return;
    try {
      writeEditor(this.editor, original);
      if (readEditor(this.editor) !== original) throw new Error("Recovery verification failed");
      this.showError("INVALID_RESPONSE");
    } catch {
      this.update({ phase: "recovery", recoveryOriginal: original });
    }
  }

  private async cancelRequest(): Promise<void> {
    if (!this.request) return;
    const requestId = this.request.id;
    this.request = null;
    await this.sendRuntimeMessage({ type: "CANCEL_OPTIMIZE", requestId });
  }

  private async sendRuntimeMessage<T>(message: object): Promise<T | undefined> {
    try {
      return await browser.runtime.sendMessage(message) as T;
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) throw error;
      this.runtimeInvalidated = true;
      return undefined;
    }
  }

  private clearUndo(): void {
    this.undo = null;
    this.update({ phase: "ready", recoveryOriginal: undefined });
  }

  private showError(errorCode: ErrorCode): void {
    this.showTransient("error", { errorCode });
  }

  private showLocal(localMessage: OverlayState["localMessage"]): void {
    this.showTransient("error", { localMessage });
  }

  private showTransient(phase: OverlayPhase, patch: Partial<OverlayState> = {}): void {
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.update({ phase, ...patch });
    this.toastTimer = window.setTimeout(() => {
      if (this.state.phase === phase) this.update({ phase: "ready", errorCode: undefined, localMessage: undefined });
    }, 4_000);
  }

  private sessionKey(): string {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  private checkSession(): void {
    const session = this.sessionKey();
    if (session === this.currentSession) return;
    this.currentSession = session;
    void this.cancelRequest();
    this.clearUndo();
  }

  private update(patch: Partial<OverlayState>): void {
    this.state = { ...this.state, ...patch };
    this.listener(this.state);
  }

  private readonly handleInput = (): void => {
    if (this.request) {
      void this.cancelRequest();
      this.showLocal("draftChanged");
    }
    if (this.undo && this.editor && readEditor(this.editor) !== this.undo.optimized) this.clearUndo();
    this.refreshVisibility();
  };

  private readonly handleKeydown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      void this.cancelRequest();
      this.undo = null;
    }
  };

  private readonly handleSubmit = (): void => {
    void this.cancelRequest();
    this.undo = null;
  };

  private readonly handleFocus = (): void => {
    window.setTimeout(() => this.refreshVisibility(), 0);
  };
  private readonly handleViewport = (): void => {
    this.refreshVisibility(true);
  };
  private readonly handleSessionChange = (): void => {
    this.currentSession = this.sessionKey();
    void this.cancelRequest();
    this.clearUndo();
    this.locate();
  };

  private readonly handleRuntimeMessage = (message: PublicSettingsChangedMessage | { type?: string }): void => {
    if (message.type === "PUBLIC_SETTINGS_CHANGED" && "settings" in message) this.update({ settings: message.settings });
  };
}
