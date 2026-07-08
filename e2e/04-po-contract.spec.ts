import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("PO from approved PR auto-fills the contracted price", async ({ page }) => {
  await login(page, "purchaser@humiley.com");
  await page.goto("/requisitions");
  await page.locator("tbody tr", { hasText: "HML-PR-2026-0002" }).locator("a").first().click();
  await page.getByRole("link", { name: /create po/i }).click();
  await page.waitForURL(/purchase-orders\/new/);

  await expect(page.getByText(/HML-CTR-2026-0001.*contracted prices applied/i)).toBeVisible({ timeout: 15_000 });
  // the bolt line price must equal the contract price 280,000
  const priceInput = page.locator("tbody input.text-right").nth(1);
  await expect(priceInput).toHaveValue("280000");
  await expect(page.getByText(/^Contract: 280,000$/).first()).toBeVisible();

  await page.getByRole("button", { name: /create purchase order/i }).click();
  await page.waitForURL(/purchase-orders\/[a-z0-9]+$/, { timeout: 20_000 });
  await expect(page.getByText(/HML-PO-2026-\d{4}/).first()).toBeVisible();
});
