import { test, expect } from "@playwright/test";
import { login, logout, sign } from "./helpers";

test("vendor bank change freezes payments until a Director signs", async ({ page }) => {
  // 1. purchaser edits the vendor's bank account
  await login(page, "purchaser@humiley.com");
  await page.goto("/vendors");
  const row = page.locator("tbody tr", { hasText: "V-CLEAN01" }).first();
  await row.locator("button").first().click(); // edit dialog
  const bankLabel = page.locator("label", { hasText: "Bank account" });
  await bankLabel.locator("xpath=..").locator("input").fill("111222333444");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/bank changes awaiting director confirmation/i)).toBeVisible({ timeout: 15_000 });

  // 2. new vendor payment is refused while frozen
  await page.goto("/payment-requests/new");
  await page.locator("select", { hasText: "V-CLEAN01" }).last().selectOption({ label: "V-CLEAN01 · CleanAir Panels Co., Ltd" });
  const boxes = page.locator('input[type="checkbox"]');
  const count = await boxes.count();
  for (let i = 0; i < count; i++) await boxes.nth(i).check();
  await page.locator("label", { hasText: /reason \/ purpose/i }).locator("input").fill("E2E freeze probe");
  await page.getByRole("button", { name: /create payment request/i }).click();
  await expect(page.getByText(/frozen \(§15\)/i)).toBeVisible({ timeout: 15_000 });
  await logout(page);

  // 3. director confirms with a signature → unfrozen
  await login(page, "director.fin@humiley.com");
  await page.goto("/vendors");
  await page.getByRole("button", { name: /confirm \(call-back done\)/i }).click();
  await sign(page, /confirm \(call-back done\)/i);
  await expect(page.getByText(/bank changes awaiting director confirmation/i)).toBeHidden({ timeout: 15_000 });
});
