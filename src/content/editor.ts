import type { SiteDescriptor } from "../lib/types";

export type SupportedEditor = HTMLTextAreaElement | HTMLElement;

function isTextArea(element: Element): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

export function isUsableEditor(element: Element, minHeight = 32): element is SupportedEditor {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 180 || rect.height < minHeight) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (isTextArea(element)) return !element.disabled && !element.readOnly;
  return element.isContentEditable && element.getAttribute("contenteditable") !== "false";
}

export function findEditor(site: SiteDescriptor): SupportedEditor | null {
  for (const selector of site.selectors) {
    const candidates = document.querySelectorAll(selector);
    for (const candidate of candidates) if (isUsableEditor(candidate, site.minEditorHeight)) return candidate;
  }
  return null;
}

export function findOverlayAnchor(editor: SupportedEditor, site: SiteDescriptor): HTMLElement {
  if (!site.overlayAnchorSelector) return editor;
  const anchor = editor.closest(site.overlayAnchorSelector);
  return anchor instanceof HTMLElement ? anchor : editor;
}

export function readEditor(editor: SupportedEditor): string {
  if (isTextArea(editor)) return editor.value;
  return editor.innerText.replace(/\r\n/g, "\n");
}

function dispatchInput(editor: SupportedEditor, text: string): void {
  editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, composed: true, inputType: "insertText", data: text }));
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
  editor.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

function replaceRichText(editor: HTMLElement, text: string): void {
  const fragment = document.createDocumentFragment();
  text.split("\n").forEach((line, index) => {
    if (index > 0) fragment.append(document.createElement("br"));
    if (line) fragment.append(document.createTextNode(line));
  });
  editor.replaceChildren(fragment);
}

export function writeEditor(editor: SupportedEditor, text: string): void {
  editor.focus();
  if (isTextArea(editor)) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("Textarea value setter is unavailable");
    setter.call(editor, text);
    dispatchInput(editor, text);
    editor.setSelectionRange(text.length, text.length);
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = document.execCommand?.("insertText", false, text) ?? false;
  if (!inserted || readEditor(editor) !== text) replaceRichText(editor, text);
  dispatchInput(editor, text);
  focusEditorEnd(editor);
}

export function focusEditorEnd(editor: SupportedEditor): void {
  editor.focus();
  if (isTextArea(editor)) {
    editor.setSelectionRange(editor.value.length, editor.value.length);
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function editorIsVisible(editor: SupportedEditor): boolean {
  const rect = editor.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}
