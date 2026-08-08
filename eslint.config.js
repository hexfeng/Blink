import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".output/**", ".wxt/**", "node_modules/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        chrome: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        HTMLElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLInputElement: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        Event: "readonly",
        InputEvent: "readonly",
        KeyboardEvent: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        Range: "readonly",
        AbortController: "readonly",
        DOMException: "readonly",
        URL: "readonly",
        fetch: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    }
  }
);
