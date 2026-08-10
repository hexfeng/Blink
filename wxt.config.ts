import { defineConfig } from "wxt";

const sitePatterns = [
  "https://chatgpt.com/*",
  "https://gemini.google.com/*",
  "https://claude.ai/*",
  "https://grok.com/*",
  "https://chat.qwen.ai/*",
  "https://chat.deepseek.com/*",
  "https://chat.minimax.io/*",
  "https://agent.minimax.io/*",
  "https://kimi.com/*",
  "https://www.kimi.com/*",
  "https://chatglm.cn/*",
  "https://z.ai/*",
  "https://chat.z.ai/*",
  "https://doubao.com/*",
  "https://www.doubao.com/*",
  "https://copilot.microsoft.com/*",
  "https://perplexity.ai/*",
  "https://www.perplexity.ai/*",
  "https://chat.mistral.ai/*",
  "https://yuanbao.tencent.com/*",
  "https://wenxin.baidu.com/*",
  "https://meta.ai/*"
];

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    version: "0.1.0",
    default_locale: "en",
    minimum_chrome_version: "120",
    permissions: ["storage", "scripting"],
    optional_host_permissions: [
      ...sitePatterns,
      "https://*/*",
      "http://localhost/*",
      "http://127.0.0.1/*"
    ],
    icons: {
      16: "icons/blink-16.png",
      32: "icons/blink-32.png",
      48: "icons/blink-48.png",
      128: "icons/blink-128.png"
    },
    action: {
      default_title: "__MSG_openSettings__",
      default_icon: {
        16: "icons/blink-16.png",
        32: "icons/blink-32.png"
      }
    },
    options_ui: { page: "options.html", open_in_tab: true }
  },
  hooks: {
    "build:manifestGenerated": (_wxt, manifest) => {
      if (manifest.options_ui) manifest.options_ui.open_in_tab = true;
      manifest.host_permissions = (manifest.host_permissions ?? []).filter(
        (pattern: string) => !sitePatterns.includes(pattern)
      );
      if (manifest.host_permissions.length === 0) delete manifest.host_permissions;
    }
  }
});
