import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("no accessibility violations with the list open", async ({ page }) => {
  await page.goto("/");
  await page.locator("#multi input").fill("invoices");
  await expect(page.locator('#multi [role="option"]').first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the results can be reached and read at 200 % zoom", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto("/");
  await page.locator("#single input").fill("invoices");
  const option = page.locator('#single [role="option"]').first();
  await expect(option).toBeVisible();
  const box = await option.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 640).toBe(true);
});

test("reduced motion does not break the search", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#single input").fill("webhooks");
  await expect(page.locator('#single [role="option"]').first()).toContainText("Webhooks");
});
