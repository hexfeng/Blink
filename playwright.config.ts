import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { trace: "retain-on-failure" },
  reporter: "list",
  webServer: {
    command: "npm run preview:ui",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30_000
  }
});
