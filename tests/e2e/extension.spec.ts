import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

let context: BrowserContext;
let optionsPage: Page;

test.beforeAll(async () => {
  const extensionPath = path.resolve(process.env.BLINK_EXTENSION_PATH ?? ".output/chrome-mv3");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
});

test.afterAll(async () => context?.close());

test("loads the built options page with the three required sections", async () => {
  await expect(optionsPage.getByRole("heading", { name: "Blink settings" })).toBeVisible();
  await expect(optionsPage.getByRole("heading", { name: "Model service" })).toBeVisible();
  await expect(optionsPage.getByRole("heading", { name: "Optimization modes" })).toBeVisible();
  await expect(optionsPage.getByRole("heading", { name: "Supported sites" })).toBeVisible();
  await expect(optionsPage.getByRole("checkbox", { name: "ChatGPT: Site allowed" })).toBeEnabled();
  await expect(optionsPage.getByRole("checkbox", { name: "Gemini: Site allowed" })).toBeEnabled();
  await expect(optionsPage.getByRole("checkbox", { name: "Claude: Site allowed" })).toBeEnabled();
  await expect(optionsPage.getByText("Grok")).toHaveCount(0);
  await expect(optionsPage.getByText("OpenAI-compatible is verified for this Beta.")).toBeVisible();

  await optionsPage.setViewportSize({ width: 720, height: 800 });
  const horizontalOverflow = await optionsPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await optionsPage.setViewportSize({ width: 1280, height: 720 });

  await optionsPage.getByRole("button", { name: "Experimental" }).click();
  await expect(optionsPage.getByRole("checkbox", { name: "DeepSeek: Site allowed" })).toBeDisabled();
  await expect(optionsPage.getByText("External blocker").first()).toBeVisible();
});

test("has no serious or critical axe violations on first use", async () => {
  const results = await new AxeBuilder({ page: optionsPage }).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking).toEqual([]);
});
