import { readEditor, writeEditor } from "../src/content/editor";

const textarea = document.querySelector<HTMLTextAreaElement>("#fixture-textarea")!;
const richHost = document.querySelector<HTMLDivElement>("#rich-host")!;
const events = document.querySelector<HTMLOutputElement>("#events")!;
let eventCount = 0;

function mountRich() {
  const editor = document.createElement("div");
  editor.id = "fixture-rich";
  editor.className = "ProseMirror";
  editor.contentEditable = "true";
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", "Rich editor");
  editor.textContent = "Original rich text";
  editor.addEventListener("input", countEvent);
  richHost.replaceChildren(editor);
}

function countEvent() {
  eventCount += 1;
  events.value = String(eventCount);
}

textarea.addEventListener("input", countEvent);
mountRich();

document.querySelector("#write-textarea")?.addEventListener("click", () => writeEditor(textarea, "Optimized textarea"));
document.querySelector("#write-rich")?.addEventListener("click", () => {
  const editor = document.querySelector<HTMLElement>("#fixture-rich")!;
  writeEditor(editor, "Optimized rich text");
  if (readEditor(editor) !== "Optimized rich text") throw new Error("Rich editor read-back failed");
});
document.querySelector("#remount-rich")?.addEventListener("click", mountRich);
