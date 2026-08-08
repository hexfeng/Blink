import { describe, expect, it } from "vitest";
import { applyOverlayHostPosition, calculateOverlayPosition, hideOverlayHost } from "../src/content/positioning";

describe("overlay positioning", () => {
  it("stays eight pixels above the complete composer top-right", () => {
    expect(calculateOverlayPosition({ right: 760, top: 200 }, { width: 800, height: 600 })).toEqual({
      anchorX: 760,
      top: 148,
      width: 340
    });
    expect(calculateOverlayPosition({ right: 760, top: 200 }, { width: 800, height: 600 }, 60).top).toBe(132);
  });

  it("keeps the top-right anchor inside a narrow viewport", () => {
    expect(calculateOverlayPosition({ right: 250, top: 420 }, { width: 300, height: 520 })).toEqual({
      anchorX: 288,
      top: 368,
      width: 276
    });
  });

  it("uses an important full-viewport host and positions the inner stage with variables", () => {
    const host = document.createElement("div");
    applyOverlayHostPosition(host, { anchorX: 760, top: 148, width: 340 });

    expect(host.style.getPropertyValue("position")).toBe("fixed");
    expect(host.style.getPropertyPriority("position")).toBe("important");
    expect(host.style.getPropertyValue("inset")).toBe("0px");
    expect(host.style.getPropertyValue("--blink-left")).toBe("420px");
    expect(host.style.getPropertyValue("--blink-top")).toBe("148px");
    expect(host.style.getPropertyValue("--blink-width")).toBe("340px");
    hideOverlayHost(host);
    expect(host.style.getPropertyValue("display")).toBe("none");
    expect(host.style.getPropertyPriority("display")).toBe("important");
  });
});
