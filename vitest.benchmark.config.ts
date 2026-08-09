import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["benchmarks/**/*.test.ts"],
    environment: "node",
    testTimeout: 30 * 60 * 1_000
  }
});
