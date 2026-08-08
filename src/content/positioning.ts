export interface OverlayPosition {
  anchorX: number;
  top: number;
  width: number;
}

function setImportantStyle(element: HTMLElement, property: string, value: string): void {
  // WXT resets the shadow host with `all: initial !important`; normal inline styles lose that cascade.
  element.style.setProperty(property, value, "important");
}

export function hideOverlayHost(host: HTMLElement): void {
  setImportantStyle(host, "display", "none");
}

export function applyOverlayHostPosition(host: HTMLElement, overlay: OverlayPosition): void {
  setImportantStyle(host, "display", "block");
  setImportantStyle(host, "position", "fixed");
  setImportantStyle(host, "inset", "0");
  setImportantStyle(host, "width", "100vw");
  setImportantStyle(host, "height", "100vh");
  setImportantStyle(host, "transform", "none");
  setImportantStyle(host, "overflow", "visible");
  setImportantStyle(host, "pointer-events", "none");
  setImportantStyle(host, "z-index", "2147483646");
  host.style.setProperty("--blink-left", `${overlay.anchorX - overlay.width}px`);
  host.style.setProperty("--blink-top", `${overlay.top}px`);
  host.style.setProperty("--blink-width", `${overlay.width}px`);
}

export function calculateOverlayPosition(
  anchor: Pick<DOMRect, "right" | "top">,
  viewport: { width: number; height: number },
  pillHeight = 44
): OverlayPosition {
  const width = Math.max(0, Math.min(340, viewport.width - 24));
  const anchorX = Math.max(width + 12, Math.min(anchor.right, viewport.width - 12));
  return {
    anchorX,
    top: Math.max(8, anchor.top - pillHeight - 8),
    width
  };
}
