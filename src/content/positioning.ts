export interface OverlayPosition {
  anchorX: number;
  top: number;
  width: number;
  placement: "above" | "below";
}

export function calculateOverlayPosition(
  editor: Pick<DOMRect, "right" | "top" | "bottom">,
  viewport: { width: number; height: number },
  pillHeight = 44
): OverlayPosition {
  const width = Math.max(0, Math.min(340, viewport.width - 24));
  const anchorX = Math.max(width + 12, Math.min(editor.right, viewport.width - 12));
  const placeBelow = editor.bottom + 8 + pillHeight <= viewport.height - 8;
  return {
    anchorX,
    top: placeBelow ? editor.bottom + 8 : Math.max(8, editor.top - pillHeight - 8),
    width,
    placement: placeBelow ? "below" : "above"
  };
}
