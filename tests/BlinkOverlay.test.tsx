import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BlinkOverlay } from "../src/content/BlinkOverlay";
import type { BlinkController, OverlayState } from "../src/content/controller";
import { DEFAULT_SETTINGS } from "../src/lib/storage";

vi.mock("wxt/browser", () => ({ browser: { i18n: { getUILanguage: () => "en" } } }));

const controller = {
  optimize: vi.fn(),
  undoLast: vi.fn(),
  setMenuOpen: vi.fn(),
  selectMode: vi.fn(),
  openSettings: vi.fn(),
  restoreOriginal: vi.fn(),
  copyOriginal: vi.fn()
} as unknown as BlinkController;

describe("BlinkOverlay success state", () => {
  it("replaces the current pill instead of adding a success popover", async () => {
    const user = userEvent.setup();
    vi.mocked(controller.undoLast).mockClear();
    const state: OverlayState = { visible: true, phase: "success", menuOpen: false, settings: DEFAULT_SETTINGS };
    const { container } = render(<BlinkOverlay controller={controller} state={state} locale="en" />);
    expect(screen.getByText("Optimized")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(screen.queryByText("Blink")).toBeNull();
    expect(screen.queryByText("Auto")).toBeNull();
    expect(container.querySelectorAll(".blink-pill")).toHaveLength(1);
    expect(container.querySelector(".blink-feedback--success")).toBeNull();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
    await user.keyboard("{Enter}");
    expect(controller.undoLast).toHaveBeenCalledOnce();
  });
});
