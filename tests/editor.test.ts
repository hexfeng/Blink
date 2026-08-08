import { describe, expect, it, vi } from "vitest";
import { readEditor, writeEditor } from "../src/content/editor";

describe("shared editor driver", () => {
  it("writes and reads textarea through the native setter and dispatches input", () => {
    const editor = document.createElement("textarea");
    document.body.append(editor);
    const input = vi.fn();
    editor.addEventListener("input", input);
    writeEditor(editor, "line one\nline two");
    expect(readEditor(editor)).toBe("line one\nline two");
    expect(input).toHaveBeenCalledOnce();
    expect(editor.selectionStart).toBe(editor.value.length);
  });
});
