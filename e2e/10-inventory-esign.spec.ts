import { test, expect } from "@playwright/test";
import { login, sign, drawSignature, PASSWORD, SEED_YEAR } from "./helpers";

/**
 * §9/§10b/§20 money + e-sign integrity (commits 098d4ab, 8143aa2, 23834ff):
 *  1. GRN accept posts accepted quantities into stock at the PO unit cost (claim-before-sign).
 *  2. A foreign-currency PO values stock at unitPrice × fxRate in VND (the HIGH FX fix), not the
 *     raw foreign unit price.
 *  3. The §9 0% quantity tolerance is a hard backstop — an over-ordered invoice is refused at
 *     verify even when the accountant forces a mismatch override.
 *
 * Selects the seeded SENT/RECEIVED POs by number so the specs stay stable as demo data grows.
 */

/** Receive the full outstanding qty of a seeded PO and QC-accept it (signed RECEIVED). */
async function receiveAndAccept(page: import("@playwright/test").Page, poNumber: string, qty: string) {
  await page.goto("/goods-receipts/new");
  const poSelect = page.locator("select").first();
  const poVal = await poSelect.locator("option", { hasText: poNumber }).getAttribute("value");
  await poSelect.selectOption(poVal!);
  await page.waitForURL(/goods-receipts\/new\?po=/, { timeout: 20_000 });
  await page.locator("table tbody input").first().fill(qty); // receive-now
  await page.getByRole("button", { name: /create grn/i }).click();
  await page.waitForURL(/goods-receipts\/[a-z0-9]+$/, { timeout: 20_000 });
  // QC form pre-fills accepted = received; accept all and sign as RECEIVED.
  await page.getByRole("button", { name: /accept & sign/i }).click();
  await sign(page, /sign & accept/i);
  await expect(page.getByRole("button", { name: /accept & sign/i })).toBeHidden({ timeout: 15_000 });
}

test("GRN accept posts accepted stock at the PO unit cost (VND)", async ({ page }) => {
  await login(page, "warehouse@humiley.com");
  // Seeded HML-PO-…-0002: 10 pcs HVAC-DMPR-30 @ 1,000,000 VND, no prior stock.
  await receiveAndAccept(page, `HML-PO-${SEED_YEAR}-0002`, "10");

  await page.goto("/inventory");
  const row = page.locator("tbody tr", { hasText: "HVAC-DMPR-30" }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText("10 PCS");                 // stock rose by the received qty
  await expect(row.locator("td").nth(3)).toHaveText(/1,000,000\s*₫/);   // avg cost = PO unit price
});

test("foreign-currency GRN values stock at unitPrice × fxRate in VND", async ({ page }) => {
  await login(page, "warehouse@humiley.com");
  // Seeded HML-PO-…-0004: USD, fxRate 25,000, 5 pcs ELEC-SOCK-32 @ $100.
  await receiveAndAccept(page, `HML-PO-${SEED_YEAR}-0004`, "5");

  await page.goto("/inventory");
  const row = page.locator("tbody tr", { hasText: "ELEC-SOCK-32" }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText("5 PCS");
  // §20: $100 × fx 25,000 = 2,500,000 ₫/pc — NOT the raw foreign 100 (the bug this fix closed).
  await expect(row.locator("td").nth(3)).toHaveText(/2,500,000\s*₫/);
});

test("verify refuses an invoice that exceeds the PO's ordered quantity", async ({ page }) => {
  await login(page, "accountant@humiley.com");
  await page.goto("/invoices/new");
  // Seeded HML-PO-…-0005: RECEIVED, 10 pcs ELEC-CONT-40 @ 1,150,000, still un-invoiced.
  const poSelect = page.locator("select").first();
  const poVal = await poSelect.locator("option", { hasText: `HML-PO-${SEED_YEAR}-0005` }).getAttribute("value");
  await poSelect.selectOption(poVal!);
  await page.waitForURL(/invoices\/new\?po=/, { timeout: 20_000 });

  await page.getByPlaceholder(/HD-2026/).fill("QA-INV-PROBE-001");
  // 15 units against a 10-unit ordered line; price kept at the PO price so ONLY the quantity is over.
  await page.locator("table tbody input").first().fill("15");
  await page.getByRole("button", { name: /create invoice/i }).click();
  await page.waitForURL(/invoices\/[a-z0-9]+$/, { timeout: 20_000 });

  // The invoice is a quantity mismatch; forcing it through with an override must still hit the
  // hard 0% quantity backstop and be refused.
  await page.getByRole("button", { name: /verify with override/i }).click();
  const dialog = page.locator("div.fixed.inset-0.z-50");
  await expect(dialog).toBeVisible();
  await drawSignature(page, dialog);
  await dialog.locator("textarea").fill("QA mismatch override probe");
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await dialog.getByRole("button", { name: /sign & confirm/i }).click();

  // The §9 backstop refuses it: "Over-invoice: … past its ordered quantity."
  await expect(page.getByText(/past its ordered quantity/i)).toBeVisible({ timeout: 15_000 });
  // The refusal left the invoice unverified (the verify claim was rolled back → dialog still open).
  await expect(dialog.getByRole("button", { name: /sign & confirm/i })).toBeVisible();
});
