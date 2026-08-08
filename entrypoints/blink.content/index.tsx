import "../../src/content/style.css";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { BlinkOverlay } from "../../src/content/BlinkOverlay";
import { BlinkController, type OverlayState } from "../../src/content/controller";
import { applyOverlayHostPosition, calculateOverlayPosition, hideOverlayHost } from "../../src/content/positioning";
import { findSiteByUrl, SITE_PATTERNS } from "../../src/lib/sites";
import type { TeardownSiteRequest } from "../../src/lib/types";

declare global {
  interface Window { __BLINK_MOUNTED__?: boolean; }
}

export default defineContentScript({
  matches: SITE_PATTERNS,
  registration: "runtime",
  cssInjectionMode: "ui",
  runAt: "document_idle",
  noScriptStartedPostMessage: true,
  async main(ctx) {
    if (window.top !== window || window.__BLINK_MOUNTED__) return;
    const site = findSiteByUrl(location.href);
    if (!site) return;
    window.__BLINK_MOUNTED__ = true;
    let shadowHost: HTMLElement | null = null;
    let controller: BlinkController | undefined;

    function position(anchor: HTMLElement | null) {
      if (!shadowHost || !anchor) {
        if (shadowHost) hideOverlayHost(shadowHost);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      applyOverlayHostPosition(
        shadowHost,
        calculateOverlayPosition(rect, { width: window.innerWidth, height: window.innerHeight })
      );
    }

    const ui = await createShadowRootUi(ctx, {
      name: "blink-extension-root",
      position: "overlay",
      anchor: "body",
      isolateEvents: ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "keypress"],
      onMount(container, _shadow, host) {
        shadowHost = host;
        const app = document.createElement("div");
        container.append(app);
        let state: OverlayState = { visible: false, phase: "ready", menuOpen: false, settings: { schemaVersion: 1, activeModeId: "auto", customModes: [] } };
        const root = ReactDOM.createRoot(app);
        const mountedController = new BlinkController(site, position);
        controller = mountedController;
        const unsubscribe = mountedController.subscribe((next) => {
          state = next;
          root.render(<BlinkOverlay controller={mountedController} state={state} />);
        });
        void mountedController.start();
        return { root, unsubscribe };
      },
      onRemove(mounted) {
        mounted?.unsubscribe();
        mounted?.root.unmount();
        shadowHost = null;
      }
    });

    ui.mount();
    const teardown = (message: TeardownSiteRequest | { type?: string }) => {
      if (message.type !== "TEARDOWN_SITE") return;
      controller?.teardown();
      ui.remove();
      window.__BLINK_MOUNTED__ = false;
    };
    browser.runtime.onMessage.addListener(teardown);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(teardown);
      controller?.teardown();
      window.__BLINK_MOUNTED__ = false;
    });
  }
});
