import { expect, test } from "@playwright/test";

test("success replaces the pill and undo returns to ready", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/?state=success&locale=zh-CN");
  await expect(page.locator(".blink-pill")).toHaveCount(1);
  await expect(page.locator(".blink-feedback--success")).toHaveCount(0);
  await expect(page.getByText("已优化", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByRole("button", { name: "Blink" })).toBeVisible();
  await expect(page.getByRole("button", { name: "自动" })).toBeVisible();
});

test("200 percent success pill stays inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  await page.goto("http://127.0.0.1:4173/?state=success&zoom=2&locale=zh-CN");
  const box = await page.locator(".blink-pill").boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(800);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(500);
});

test("shared editor driver handles textarea, rich text, and remount", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/fixture.html");
  await page.getByRole("button", { name: "Write textarea" }).click();
  await expect(page.getByLabel("Textarea")).toHaveValue("Optimized textarea");
  await page.getByRole("button", { name: "Write rich editor" }).click();
  await expect(page.getByRole("textbox", { name: "Rich editor" })).toHaveText("Optimized rich text");
  await page.getByRole("button", { name: "Remount rich editor" }).click();
  await expect(page.getByRole("textbox", { name: "Rich editor" })).toHaveText("Original rich text");
});
