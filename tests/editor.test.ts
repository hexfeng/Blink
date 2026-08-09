import { describe, expect, it, vi } from "vitest";
import { findEditor, findOverlayAnchor, readEditor, writeEditor } from "../src/content/editor";
import type { SiteDescriptor } from "../src/lib/types";

const site: SiteDescriptor = {
  id: "chatgpt",
  product: "ChatGPT",
  wave: "A",
  origins: ["https://chatgpt.com/*"],
  selectors: ["#prompt-textarea"],
  overlayAnchorSelector: "form[data-type='unified-composer']",
  verificationStatus: "pendingVerification",
  verificationNote: "test"
};

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

  it("anchors the overlay to the whole composer instead of the inner editor", () => {
    const composer = document.createElement("form");
    composer.dataset.type = "unified-composer";
    const editor = document.createElement("textarea");
    composer.append(editor);

    expect(findOverlayAnchor(editor, site)).toBe(composer);
  });

  it("falls back to the editor when a site anchor is unavailable", () => {
    const editor = document.createElement("textarea");
    expect(findOverlayAnchor(editor, site)).toBe(editor);
  });

  it("accepts Gemini's 24px editor and anchors to its complete input area", () => {
    const gemini: SiteDescriptor = {
      ...site,
      id: "gemini",
      product: "Gemini",
      selectors: [".ql-editor[contenteditable='true'][role='textbox']"],
      minEditorHeight: 20,
      overlayAnchorSelector: "[data-node-type='input-area']"
    };
    const inputArea = document.createElement("div");
    inputArea.dataset.nodeType = "input-area";
    const editor = document.createElement("div");
    editor.className = "ql-editor";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    editor.getBoundingClientRect = () => ({ width: 445, height: 24 } as DOMRect);
    inputArea.append(editor);
    document.body.append(inputArea);

    expect(findEditor(gemini)).toBe(editor);
    expect(findOverlayAnchor(editor, gemini)).toBe(inputArea);
  });

  it("accepts Claude's 20px ProseMirror and anchors to its complete composer", () => {
    const claude: SiteDescriptor = {
      ...site,
      id: "claude",
      product: "Claude",
      origins: ["https://claude.ai/*"],
      selectors: ["[data-testid='chat-input'][contenteditable='true']", "[contenteditable='true'].ProseMirror"],
      minEditorHeight: 20,
      overlayAnchorSelector: "fieldset"
    };
    const composer = document.createElement("fieldset");
    const editor = document.createElement("div");
    editor.className = "tiptap ProseMirror";
    editor.dataset.testid = "chat-input";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    editor.getBoundingClientRect = () => ({ width: 636, height: 20 } as DOMRect);
    composer.append(editor);
    document.body.append(composer);

    expect(findEditor(claude)).toBe(editor);
    expect(findOverlayAnchor(editor, claude)).toBe(composer);
  });
});
