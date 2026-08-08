import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "preview",
  publicDir: "../public",
  plugins: [react()],
  server: { port: 4173, strictPort: true },
  build: { outDir: "../.preview-output", emptyOutDir: true }
});
