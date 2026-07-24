import { test, expect } from "@playwright/test";
import { login, logout, sign, drawSignature } from "./helpers";

test("payment request refuses the final approval before accounting verifies", async ({ page }) => {
  // purchaser combines both matched invoices (33M → L1 manager + L2 chief accountant)
  await login(page, "purchaser@humiley.com");
  await page.goto("/payment-requests/new");
  await page.locator("select").last().selectOption({ index: 1 }); // V-CLEAN01
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await page.locator("label", { hasText: /reason \/ purpose/i }).locator("input").fill("E2E vendor payment");
  await page.getByRole("button", { name: /create payment request/i }).click();
  await page.waitForURL(/payment-requests\/[a-z0-9]+/, { timeout: 20_000 });
  await page.getByRole("button", { name: /^submit/i }).click();
  await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 15_000 });
  await logout(page);

  // L1 manager approves — documents are decided on their detail page now (only VENDOR rows keep
  // inline queue buttons); follow "Review & decide →" and approve from the DecideInline bar there.
  await login(page, "mgr.eng@humiley.com");
  await page.goto("/approvals");
  await page.locator("tbody tr", { hasText: "HML-PAY-" }).first()
    .getByRole("link", { name: /review & decide/i }).click();
  await page.waitForURL(/payment-requests\/[a-z0-9]+/, { timeout: 20_000 });
  await page.getByRole("button", { name: /^approve$/i }).click();
  await sign(page, /sign & submit decision/i);
  await logout(page);

  // chief accountant: the final APPROVE before VERIFY must be refused (§10a). The decision is
  // signed on the detail page, and the gate error surfaces inside the still-open signature dialog.
  await login(page, "accountant@humiley.com");
  await page.goto("/approvals");
  await page.locator("tbody tr", { hasText: "HML-PAY-" }).first()
    .getByRole("link", { name: /review & decide/i }).click();
  await page.waitForURL(/payment-requests\/[a-z0-9]+/, { timeout: 20_000 });
  await page.getByRole("button", { name: /^approve$/i }).click();
  const dialog = page.locator("div.fixed.inset-0.z-50");
  await expect(dialog).toBeVisible();
  await drawSignature(page, dialog);
  await dialog.locator('input[type="password"]').fill("Humiley@2026");
  await dialog.getByRole("button", { name: /sign & submit decision/i }).click();
  await expect(page.getByText(/accounting must verify/i)).toBeVisible({ timeout: 15_000 });
});
