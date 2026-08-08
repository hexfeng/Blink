import { describe, expect, it } from "vitest";
import { calculateOverlayPosition } from "../src/content/positioning";

describe("overlay positioning", () => {
  it("uses the required eight-pixel gap below when space is available", () => {
    expect(calculateOverlayPosition({ right: 760, top: 200, bottom: 300 }, { width: 800, height: 600 })).toEqual({
      anchorX: 760,
      top: 308,
      width: 340,
      placement: "below"
    });
  });

  it("flips above and keeps the host inside a narrow viewport", () => {
    expect(calculateOverlayPosition({ right: 250, top: 420, bottom: 500 }, { width: 300, height: 520 })).toEqual({
      anchorX: 288,
      top: 368,
      width: 276,
      placement: "above"
    });
  });
});
