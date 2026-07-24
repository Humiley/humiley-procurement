import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * §22 — the six registers now share the config-driven <DocListPage> (PO / RFQ / GRN / Invoice /
 * Payment-Request / Contract). This pins the shared behaviour that rollout added: client-side search,
 * CSV export, and a row that links to its document. Data-agnostic (no reliance on specific seed rows),
 * so it stays green as the demo data evolves.
 */
const REGISTERS: { name: string; route: string; prefix: string }[] = [
  { name: "Purchase Orders", route: "/purchase-orders", prefix: "/purchase-orders/" },
  { name: "RFQs", route: "/rfqs", prefix: "/rfqs/" },
  { name: "Goods Receipts", route: "/goods-receipts", prefix: "/goods-receipts/" },
  { name: "Invoices", route: "/invoices", prefix: "/invoices/" },
  { name: "Payment Requests", route: "/payment-requests", prefix: "/payment-requests/" },
  { name: "Contracts", route: "/contracts", prefix: "/contracts/" },
];

test.describe("register lists — shared DocListPage", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@humiley.com");
  });

  for (const r of REGISTERS) {
    test(`${r.name}: search filters, CSV export, and rows open the document`, async ({ page }) => {
      await page.goto(r.route);
      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: 20_000 });

      const search = page.locator("input.field").first();
      await expect(search).toBeVisible();

      // row document-links live inside the table (the "New" header link is outside it)
      const rowLinks = table.locator(`a[href^="${r.prefix}"]`);
      const rowCount = await rowLinks.count();

      // CSV export downloads a file (works even with 0 rows — headers only)
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /export/i }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.csv$/);

      // client-side search: a nonsense query filters every row out, clearing restores them
      await search.fill("zzq-no-such-record-000");
      await expect(table.locator(`a[href^="${r.prefix}"]`)).toHaveCount(0);
      await search.fill("");
      await expect(table.locator(`a[href^="${r.prefix}"]`)).toHaveCount(rowCount);

      // a document row opens its detail page
      if (rowCount > 0) {
        await rowLinks.first().click();
        await expect(page).toHaveURL(new RegExp(r.prefix.replace(/\//g, "\\/") + "[^/]+"));
      }
    });
  }
});
