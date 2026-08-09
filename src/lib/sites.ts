import type { SiteDescriptor } from "./types";

const pending = "Not yet verified on a signed-in real site for extension 0.1.0.";

export const SITES: SiteDescriptor[] = [
  { id: "chatgpt", product: "ChatGPT", wave: "A", origins: ["https://chatgpt.com/*"], selectors: ["#prompt-textarea", "textarea[data-testid='prompt-textarea']", "[contenteditable='true'][data-lexical-editor='true']"], overlayAnchorSelector: "form[data-type='unified-composer']", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "gemini", product: "Gemini", wave: "A", origins: ["https://gemini.google.com/*"], selectors: [".ql-editor[contenteditable='true'][role='textbox']", "rich-textarea [contenteditable='true'][role='textbox']"], minEditorHeight: 20, overlayAnchorSelector: "[data-node-type='input-area']", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "claude", product: "Claude", wave: "A", origins: ["https://claude.ai/*"], selectors: ["[data-testid='chat-input'][contenteditable='true']", "[contenteditable='true'].ProseMirror"], minEditorHeight: 20, overlayAnchorSelector: "fieldset", verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "grok", product: "Grok", wave: "A", origins: ["https://grok.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "qwen", product: "Qwen", wave: "A", origins: ["https://chat.qwen.ai/*"], selectors: ["textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "deepseek", product: "DeepSeek", wave: "A", origins: ["https://chat.deepseek.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "minimax", product: "MiniMax", wave: "A", origins: ["https://chat.minimax.io/*", "https://agent.minimax.io/*"], selectors: ["textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "kimi", product: "Kimi", wave: "A", origins: ["https://kimi.com/*"], selectors: ["textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "glm", product: "GLM / Z.ai", wave: "A", origins: ["https://chatglm.cn/*", "https://z.ai/*"], selectors: ["textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "doubao", product: "豆包", wave: "B", origins: ["https://doubao.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "copilot", product: "Microsoft Copilot", wave: "B", origins: ["https://copilot.microsoft.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "perplexity", product: "Perplexity", wave: "B", origins: ["https://perplexity.ai/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "mistral", product: "Vibe", wave: "B", origins: ["https://chat.mistral.ai/*"], selectors: ["textarea", ".ProseMirror[contenteditable='true']", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "yuanbao", product: "腾讯元宝", wave: "B", origins: ["https://yuanbao.tencent.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "wenxin", product: "文心助手", wave: "B", origins: ["https://wenxin.baidu.com/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "pendingVerification", verificationNote: pending },
  { id: "meta", product: "Meta AI", wave: "B", origins: ["https://meta.ai/*"], selectors: ["textarea", "[contenteditable='true']"], verificationStatus: "externalBlocked", verificationNote: "Region and account availability prevent current real-site acceptance." }
];

export const SITE_PATTERNS = SITES.flatMap((site) => site.origins);

export function findSiteByUrl(url: string): SiteDescriptor | undefined {
  const hostname = new URL(url).hostname;
  return SITES.find((site) => site.origins.some((pattern) => new URL(pattern.replace("*", "")).hostname === hostname));
}

export function originPattern(url: string): string {
  return `${new URL(url).origin}/*`;
}
