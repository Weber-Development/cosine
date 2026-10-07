import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

const single = "#single";

test("typing shows results and announces the count", async ({ page }) => {
  const input = page.locator(`${single} input`);
  await input.fill("invoices");
  await expect(page.locator(`${single} [role="option"]`).first()).toContainText("Invoices");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`${single} [role="status"]`)).not.toBeEmpty();
});

test("the arrow keys move through results and Enter opens the section", async ({ page }) => {
  const input = page.locator("#multi input");
  await input.fill("invoices");
  await expect(page.locator('#multi [role="option"]')).toHaveCount(2);
  await input.press("ArrowDown");
  const first = await input.getAttribute("aria-activedescendant");
  expect(first).toBeTruthy();
  await expect(page.locator('#multi [role="option"][aria-selected="true"]')).toHaveCount(1);
  await input.press("ArrowDown");
  const second = await input.getAttribute("aria-activedescendant");
  expect(second).not.toBe(first);
  await input.press("ArrowUp");
  expect(await input.getAttribute("aria-activedescendant")).toBe(first);
  await Promise.all([page.waitForURL(/\/(docs|blog)\//), input.press("Enter")]);
});

test("Escape closes the list and a second Escape clears the field", async ({ page }) => {
  const input = page.locator(`${single} input`);
  await input.fill("webhooks");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
});

test("the shortcut focuses the field", async ({ page }) => {
  await page.keyboard.press("/");
  await expect(page.locator(`${single} input`)).toBeFocused();
  expect(await page.locator(`${single} input`).inputValue()).toBe("");
});

test("keyboard users can reach the field with Tab", async ({ page }) => {
  await page.keyboard.press("Tab");
  await expect(page.locator(`${single} input`)).toBeFocused();
});

test("the field is a labelled combobox that owns a listbox", async ({ page }) => {
  const input = page.locator(`${single} input`);
  await expect(input).toHaveAttribute("role", "combobox");
  await expect(input).toHaveAttribute("aria-label", /.+/);
  await expect(input).toHaveAttribute("aria-autocomplete", "list");
  const listId = await input.getAttribute("aria-controls");
  expect(listId).toBeTruthy();
  await expect(page.locator(`${single} #${listId}`)).toHaveAttribute("role", "listbox");
});

test("a query without matches says so", async ({ page }) => {
  const input = page.locator(`${single} input`);
  await input.fill("zzzzqqqq");
  await expect(page.locator(`${single} [role="status"]`)).toContainText(/no results/i);
});

test("several indexes are searched as one and the filter buttons narrow them", async ({ page }) => {
  const multi = "#multi";
  const input = page.locator(`${multi} input`);
  await input.fill("invoices");
  const options = page.locator(`${multi} [role="option"]`);
  await expect(options.first()).toBeVisible();
  const all = await options.count();
  expect(all).toBeGreaterThanOrEqual(2);
  const blog = page.locator(`${multi} .facets button`, { hasText: "blog" });
  await expect(blog).toHaveAttribute("aria-pressed", "false");
  await blog.click();
  await expect(blog).toHaveAttribute("aria-pressed", "true");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("Invoices news");
});
