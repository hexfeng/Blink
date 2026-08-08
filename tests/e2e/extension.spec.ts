import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

let context: BrowserContext;
let optionsPage: Page;

test.beforeAll(async () => {
  const extensionPath = path.resolve(".output/chrome-mv3");
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
  await expect(optionsPage.getByRole("checkbox", { name: "Meta AI: Site allowed" })).toBeDisabled();
  await expect(optionsPage.getByText("Pending verification").first()).toBeVisible();
  await expect(optionsPage.getByText("External blocker")).toBeVisible();
});

test("has no serious or critical axe violations on first use", async () => {
  const results = await new AxeBuilder({ page: optionsPage }).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking).toEqual([]);
});
