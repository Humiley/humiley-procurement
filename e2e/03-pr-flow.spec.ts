import { test, expect } from "@playwright/test";
import { login, logout, sign } from "./helpers";

test("PR: create → submit → signed manager approval", async ({ page }) => {
  await login(page, "req.eng@humiley.com");
  await page.goto("/requisitions/new");

  // cost center defaults to the requester's department (single option)
  await page.locator('input[type="date"]').first().fill(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  await page.locator("textarea").first().fill("E2E — office consumables");
  // line: pick the first catalog item (auto-fills UoM), small qty×price → L1 band only
  await page.locator("tbody select").first().selectOption({ index: 1 });
  const lineInputs = page.locator("tbody input");
  await lineInputs.nth((await lineInputs.count()) - 2).fill("2");        // qty
  await lineInputs.nth((await lineInputs.count()) - 1).fill("500000");   // est unit price
  await page.getByRole("button", { name: /save draft/i }).click();
  await page.waitForURL(/requisitions\/(?!new)[a-z0-9]+/, { timeout: 20_000 });

  await page.getByRole("button", { name: /^submit$/i }).click();
  await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 15_000 });
  await logout(page);

  await login(page, "mgr.eng@humiley.com");
  await page.goto("/approvals");
  const row = page.locator("tbody tr", { hasText: "E2E — office consumables" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /^approve$/i }).click();
  await sign(page, /sign & submit decision/i);
  await expect(row).toBeHidden({ timeout: 15_000 });
});
