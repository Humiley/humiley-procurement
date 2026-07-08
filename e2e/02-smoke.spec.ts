import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const ROUTES: [string, RegExp][] = [
  ["/dashboard", /dashboard/i],
  ["/requisitions", /requisitions/i],
  ["/approvals", /approval/i],
  ["/rfqs", /rfq/i],
  ["/purchase-orders", /purchase orders/i],
  ["/goods-receipts", /goods receipts/i],
  ["/invoices", /invoice/i],
  ["/payment-requests", /payment/i],
  ["/vendors", /vendor/i],
  ["/contracts", /contract/i],
  ["/inventory", /stock/i],
  ["/inventory/issues", /goods issues/i],
  ["/inventory/transfers", /transfers/i],
  ["/inventory/counts", /stock counts/i],
  ["/inventory/reorder", /below minimum/i],
  ["/scan", /scan hub/i],
  ["/reference/incoterms", /incoterms 2020/i],
  ["/reference/hs-codes", /hs codes/i],
  ["/trade/estimator", /landed-cost estimator/i],
  ["/budgets", /budget/i],
  ["/reports", /reports/i],
  ["/admin/settings", /governance/i],
  ["/admin/approval-matrix", /approval matrix/i],
  ["/admin/audit", /audit trail/i],
  ["/admin/accounting-export", /accounting export/i],
];

test("every register renders for the admin", async ({ page }) => {
  await login(page, "admin@humiley.com");
  for (const [route, marker] of ROUTES) {
    await page.goto(route);
    await expect(page.getByText(marker).first(), `${route} should render`).toBeVisible({ timeout: 20_000 });
  }
});
