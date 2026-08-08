import { browser } from "wxt/browser";
import { INPUT_LIMIT } from "../lib/constants";
import type { ErrorCode, ModeSelection, OptimizeResponse, PublicSettingsChangedMessage, SiteDescriptor, SyncedSettings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/storage";
import { editorIsVisible, findEditor, focusEditorEnd, readEditor, writeEditor, type SupportedEditor } from "./editor";

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

export class BlinkController {
  private editor: SupportedEditor | null = null;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private navigationTarget: EventTarget | null = null;
  private listener: Listener = () => undefined;
  private toastTimer: number | undefined;
  private currentSession = "";
  private request: { id: string; snapshot: string } | null = null;
  private undo: { original: string; optimized: string; session: string } | null = null;
  private state: OverlayState = { visible: false, phase: "ready", menuOpen: false, settings: DEFAULT_SETTINGS };

  constructor(private readonly site: SiteDescriptor, private readonly onPosition: (editor: SupportedEditor | null) => void) {}

  subscribe(listener: Listener): () => void {
    this.listener = listener;
    listener(this.state);
    return () => { this.listener = () => undefined; };
  }

  async start(): Promise<void> {
    this.currentSession = this.sessionKey();
    await this.refreshSettings();
    this.observer = new MutationObserver(() => {
      this.checkSession();
      this.locate();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", this.handleViewport, { passive: true });
    window.addEventListener("scroll", this.handleViewport, { capture: true, passive: true });
    window.addEventListener("focusin", this.handleFocus, true);
    window.addEventListener("focusout", this.handleFocus, true);
    window.addEventListener("popstate", this.handleSessionChange);
    window.addEventListener("hashchange", this.handleSessionChange);
    window.visualViewport?.addEventListener("resize", this.handleViewport, { passive: true });
    window.visualViewport?.addEventListener("scroll", this.handleViewport, { passive: true });
    this.navigationTarget = (window as Window & { navigation?: EventTarget }).navigation ?? null;
    this.navigationTarget?.addEventListener("currententrychange", this.handleSessionChange);
    browser.runtime.onMessage.addListener(this.handleRuntimeMessage);
    this.locate();
  }

  teardown(): void {
    void this.cancelRequest();
    this.detachEditor();
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener("resize", this.handleViewport);
    window.removeEventListener("scroll", this.handleViewport, true);
    window.removeEventListener("focusin", this.handleFocus, true);
    window.removeEventListener("focusout", this.handleFocus, true);
    window.removeEventListener("popstate", this.handleSessionChange);
    window.removeEventListener("hashchange", this.handleSessionChange);
    window.visualViewport?.removeEventListener("resize", this.handleViewport);
    window.visualViewport?.removeEventListener("scroll", this.handleViewport);
    this.navigationTarget?.removeEventListener("currententrychange", this.handleSessionChange);
    this.navigationTarget = null;
    browser.runtime.onMessage.removeListener(this.handleRuntimeMessage);
    this.update({ visible: false, menuOpen: false });
  }

  async refreshSettings(): Promise<void> {
    const response = await browser.runtime.sendMessage({ type: "GET_PUBLIC_SETTINGS" }) as { ok: true; settings: SyncedSettings } | { ok: false };
    if (response.ok) this.update({ settings: response.settings });
  }

  setMenuOpen(menuOpen: boolean): void {
    this.update({ menuOpen });
    if (menuOpen) void this.refreshSettings();
  }

  async selectMode(modeId: string): Promise<void> {
    const response = await browser.runtime.sendMessage({ type: "SET_ACTIVE_MODE", modeId }) as { ok: boolean; settings?: SyncedSettings };
    if (response.ok && response.settings) this.update({ settings: response.settings, menuOpen: false });
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

    const response = await browser.runtime.sendMessage({ type: "OPTIMIZE", requestId, text: snapshot, mode }) as OptimizeResponse;
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
    void browser.runtime.openOptionsPage();
  }

  private locate(): void {
    const next = findEditor(this.site);
    if (next === this.editor) return this.refreshVisibility();
    this.detachEditor();
    if (!next) return;
    this.editor = next;
    next.addEventListener("input", this.handleInput, true);
    next.addEventListener("keydown", this.handleKeydown, true);
    next.closest("form")?.addEventListener("submit", this.handleSubmit, true);
    this.resizeObserver = new ResizeObserver(() => this.handleViewport());
    this.resizeObserver.observe(next);
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
    this.undo = null;
    this.onPosition(null);
    this.update({ visible: false, phase: "ready", menuOpen: false });
  }

  private refreshVisibility(): void {
    if (!this.editor) return this.update({ visible: false });
    const focused = document.activeElement === this.editor || this.editor.contains(document.activeElement);
    const visible = editorIsVisible(this.editor) && (focused || readEditor(this.editor).length > 0);
    this.update({ visible });
    this.onPosition(visible ? this.editor : null);
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
    await browser.runtime.sendMessage({ type: "CANCEL_OPTIMIZE", requestId });
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
    this.refreshVisibility();
    if (this.editor && this.state.visible) this.onPosition(this.editor);
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
