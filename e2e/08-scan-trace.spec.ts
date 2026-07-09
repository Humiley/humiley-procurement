import { test, expect } from "@playwright/test";
import { login, SEED_YEAR } from "./helpers";

test("scan hub routes documents and reports unknowns", async ({ page }) => {
  await login(page, "warehouse@humiley.com");
  await page.goto("/scan");
  const input = page.getByPlaceholder(/HML-PO/);
  await input.fill(`HML-PO-${SEED_YEAR}-0002`);
  await page.getByRole("button", { name: /look up/i }).click();
  await page.waitForURL(/purchase-orders\/[a-z0-9]+/, { timeout: 15_000 });

  await page.goto("/scan");
  await page.getByPlaceholder(/HML-PO/).fill("NO-SUCH-CODE-123");
  await page.getByRole("button", { name: /look up/i }).click();
  await expect(page.getByText(/nothing matches/i)).toBeVisible({ timeout: 15_000 });
});
