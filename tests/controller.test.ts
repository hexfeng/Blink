import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlinkController } from "../src/content/controller";
import type { SiteDescriptor, SyncedSettings } from "../src/lib/types";

const runtime = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn()
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      sendMessage: runtime.sendMessage,
      onMessage: { addListener: runtime.addListener, removeListener: runtime.removeListener }
    }
  }
}));

const site: SiteDescriptor = {
  id: "chatgpt",
  product: "ChatGPT",
  wave: "A",
  origins: ["https://chatgpt.com/*"],
  selectors: ["#prompt-textarea"],
  verificationStatus: "pendingVerification",
  verificationNote: "test"
};

describe("BlinkController lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.sendMessage.mockReset();
    runtime.addListener.mockReset();
    runtime.removeListener.mockReset();
  });

  it("does not publish or attach listeners when teardown happens during startup", async () => {
    let resolveSettings: ((value: { ok: true; settings: SyncedSettings }) => void) | undefined;
    runtime.sendMessage.mockReturnValueOnce(new Promise((resolve) => { resolveSettings = resolve; }));
    runtime.addListener.mockClear();
    const controller = new BlinkController(site, vi.fn());
    let rootUnmounted = false;
    const unsubscribe = controller.subscribe(() => {
      if (rootUnmounted) throw new Error("rendered after root unmount");
    });

    const starting = controller.start();
    unsubscribe();
    rootUnmounted = true;
    controller.teardown();
    resolveSettings?.({ ok: true, settings: { schemaVersion: 1, activeModeId: "auto", customModes: [] } });

    await expect(starting).resolves.toBeUndefined();
    expect(runtime.addListener).not.toHaveBeenCalled();
  });

  it("treats extension invalidation during startup as lifecycle shutdown", async () => {
    runtime.sendMessage.mockRejectedValueOnce(new Error("Extension context invalidated."));
    const controller = new BlinkController(site, vi.fn());

    await expect(controller.start()).resolves.toBeUndefined();
    expect(runtime.addListener).not.toHaveBeenCalled();
  });

  it("does not hide unrelated startup failures", async () => {
    runtime.sendMessage.mockRejectedValueOnce(new Error("Unexpected runtime failure"));
    const controller = new BlinkController(site, vi.fn());

    await expect(controller.start()).rejects.toThrow("Unexpected runtime failure");
  });

  it("allows teardown after the runtime context is invalidated", async () => {
    runtime.sendMessage.mockResolvedValueOnce({ ok: true, settings: { schemaVersion: 1, activeModeId: "auto", customModes: [] } });
    const controller = new BlinkController(site, vi.fn());
    await controller.start();
    runtime.removeListener.mockImplementationOnce(() => { throw new Error("Extension context invalidated."); });

    expect(() => controller.teardown()).not.toThrow();
  });

  it("cleans up if the runtime invalidates while listeners are attaching", async () => {
    runtime.sendMessage.mockResolvedValueOnce({ ok: true, settings: { schemaVersion: 1, activeModeId: "auto", customModes: [] } });
    runtime.addListener.mockImplementationOnce(() => { throw new Error("Extension context invalidated."); });
    const controller = new BlinkController(site, vi.fn());

    await expect(controller.start()).resolves.toBeUndefined();
    expect(runtime.removeListener).toHaveBeenCalledOnce();
  });
});
