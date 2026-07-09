import { test, expect } from "@playwright/test";
import { login, SEED_YEAR } from "./helpers";

test("PO from approved PR auto-fills the contracted price", async ({ page }) => {
  await login(page, "purchaser@humiley.com");
  await page.goto("/requisitions");
  await page.locator("tbody tr", { hasText: `HML-PR-${SEED_YEAR}-0002` }).locator("a").first().click();
  await page.getByRole("link", { name: /create po/i }).click();
  await page.waitForURL(/purchase-orders\/new/);

  // vendor is deliberately NOT preselected anymore (UX audit) — pick the contracted vendor
  const vendorSelect = page.locator("select").first();
  const clean01 = await vendorSelect.locator("option", { hasText: "V-CLEAN01" }).getAttribute("value");
  await vendorSelect.selectOption(clean01!);

  await expect(page.getByText(new RegExp(`HML-CTR-${SEED_YEAR}-0001.*contracted prices applied`, "i"))).toBeVisible({ timeout: 15_000 });
  // the bolt line price must equal the contract price 280,000
  const priceInput = page.locator("tbody input.text-right").nth(1);
  await expect(priceInput).toHaveValue(/280[,.]?000/);   // MoneyInput displays grouped digits
  await expect(page.getByText(/^Contract: 280,000$/).first()).toBeVisible();

  await page.getByRole("button", { name: /create purchase order/i }).click();
  await page.waitForURL(/purchase-orders\/[a-z0-9]+$/, { timeout: 20_000 });
  await expect(page.getByText(new RegExp(`HML-PO-${SEED_YEAR}-\\d{4}`)).first()).toBeVisible();
});
