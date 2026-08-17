import type { SiteDescriptor } from "./types";

const pending = "Not included in the 0.1.x Core Beta verification scope.";
const userVerified = "Full real-site acceptance on 2026-08-09; 0.1.1 optimization and Undo smoke passed on 2026-08-16.";

export const SITES: SiteDescriptor[] = [
  { id: "chatgpt", product: "ChatGPT", wave: "A", supportTier: "core", origins: ["https://chatgpt.com/*"], selectors: ["#prompt-textarea", "textarea[data-testid='prompt-textarea']", "[contenteditable='true'][data-lexical-editor='true']"], overlayAnchorSelector: "form[data-type='unified-composer']", verificationStatus: "verified", lastVerifiedVersion: "0.1.1", verificationNote: userVerified },
  { id: "gemini", product: "Gemini", wave: "A", supportTier: "core", origins: ["https://gemini.google.com/*"], selectors: [".ql-editor[contenteditable='true'][role='textbox']", "rich-textarea [contenteditable='true'][role='textbox']"], minEditorHeight: 20, overlayAnchorSelector: "[data-node-type='input-area']", verificationStatus: "verified", lastVerifiedVersion: "0.1.1", verificationNote: userVerified },
  { id: "claude", product: "Claude", wave: "A", supportTier: "core", origins: ["https://claude.ai/*"], selectors: ["[data-testid='chat-input'][contenteditable='true']", "[contenteditable='true'].ProseMirror"], minEditorHeight: 20, overlayAnchorSelector: "fieldset", verificationStatus: "verified", lastVerifiedVersion: "0.1.1", verificationNote: userVerified },
  { id: "grok", product: "Grok", wave: "A", origins: ["https://grok.com/*"], selectors: ["textarea[placeholder='What do you want to know?']", "textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "qwen", product: "Qwen", wave: "A", origins: ["https://chat.qwen.ai/*"], selectors: ["textarea.message-input-textarea", "textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], overlayAnchorSelector: ".message-input-container", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "deepseek", product: "DeepSeek", wave: "A", origins: ["https://chat.deepseek.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "externalBlocked", verificationNote: "A signed-in account is required before the chat editor is available." },
  { id: "minimax", product: "MiniMax", wave: "A", origins: ["https://chat.minimax.io/*", "https://agent.minimax.io/*"], selectors: [".ProseMirror[contenteditable='true']", "textarea", "[contenteditable='true']"], overlayAnchorSelector: ".message-input-container", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "kimi", product: "Kimi", wave: "A", origins: ["https://kimi.com/*", "https://www.kimi.com/*"], selectors: [".chat-input-editor[contenteditable='true']", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], overlayAnchorSelector: ".chat-editor", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "glm", product: "GLM / Z.ai", wave: "A", origins: ["https://chatglm.cn/*", "https://z.ai/*", "https://chat.z.ai/*"], selectors: ["textarea.input-scroll", "textarea.scroll-display-none", "textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], overlayAnchorSelector: "form", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "doubao", product: "豆包", wave: "B", origins: ["https://doubao.com/*", "https://www.doubao.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "externalBlocked", verificationNote: "The current region is blocked until an eligible account signs in." },
  { id: "copilot", product: "Microsoft Copilot", wave: "B", origins: ["https://copilot.microsoft.com/*"], selectors: ["textarea[placeholder='Message Copilot']", "textarea", "[contenteditable='true']"], minEditorHeight: 20, verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "perplexity", product: "Perplexity", wave: "B", origins: ["https://perplexity.ai/*", "https://www.perplexity.ai/*"], selectors: ["[contenteditable='true'][role='textbox']", "[contenteditable='true']", "textarea"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "mistral", product: "Vibe", wave: "B", origins: ["https://chat.mistral.ai/*"], selectors: [".ProseMirror[contenteditable='true']", "[contenteditable='true']", "textarea"], minEditorHeight: 20, verificationStatus: "externalBlocked", verificationNote: "Acceptance requires agreeing to Vibe's Terms of Service in the browser." },
  { id: "yuanbao", product: "腾讯元宝", wave: "B", origins: ["https://yuanbao.tencent.com/*"], selectors: [".ql-editor[contenteditable='true']", "[contenteditable='true']", "textarea"], minEditorHeight: 20, verificationStatus: "externalBlocked", verificationNote: "A signed-in account is required before prompt input is enabled." },
  { id: "wenxin", product: "文心助手", wave: "B", origins: ["https://wenxin.baidu.com/*"], selectors: ["textarea.ci-textarea", "textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "meta", product: "Meta AI", wave: "B", origins: ["https://meta.ai/*"], selectors: ["input[placeholder='Ask Meta AI...']", "textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending }
];

export const SITE_PATTERNS = SITES.flatMap((site) => site.origins);

export function findSiteByUrl(url: string): SiteDescriptor | undefined {
  const hostname = new URL(url).hostname;
  return SITES.find((site) => site.origins.some((pattern) => new URL(pattern.replace("*", "")).hostname === hostname));
}

export function originPattern(url: string): string {
  return `${new URL(url).origin}/*`;
}
