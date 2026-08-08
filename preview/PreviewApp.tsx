import { useMemo, useState } from "react";
import { BlinkOverlay } from "../src/content/BlinkOverlay";
import type { BlinkController, OverlayPhase, OverlayState } from "../src/content/controller";
import { DEFAULT_SETTINGS } from "../src/lib/storage";
import { OptionsApp } from "../entrypoints/options/OptionsApp";

export function PreviewApp() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [phase, setPhase] = useState((params.get("state") ?? "success") as OverlayPhase);
  const [menuOpen, setMenuOpen] = useState(phase === "ready" && params.get("menu") === "1");
  const controller = useMemo(() => ({
    optimize: () => setPhase("loading"),
    undoLast: () => setPhase("ready"),
    setMenuOpen,
    selectMode: async () => setMenuOpen(false),
    openSettings: () => undefined,
    restoreOriginal: () => setPhase("ready"),
    copyOriginal: async () => undefined
  }) as unknown as BlinkController, []);
  if (params.get("view") === "options") return <OptionsApp demo />;
  const state: OverlayState = {
    visible: true,
    phase,
    menuOpen,
    settings: DEFAULT_SETTINGS,
    errorCode: phase === "error" ? "PROVIDER_NOT_CONFIGURED" : undefined,
    recoveryOriginal: phase === "recovery" ? "Original prompt text" : undefined
  };
  return (
    <main className="preview-canvas preview-canvas--light">
      <section className="host-card" aria-label="Host editor preview">
        <div className="host-toolbar"><span /><span /><span /></div>
        <div className="host-editor">Compare the launch strategy and preserve every date, URL, and constraint.</div>
        <div className={`overlay-slot${params.get("zoom") === "2" ? " overlay-slot--zoom" : ""}`}><BlinkOverlay controller={controller} state={state} locale={params.get("locale") === "zh-CN" ? "zh-CN" : "en"} /></div>
      </section>
    </main>
  );
}
