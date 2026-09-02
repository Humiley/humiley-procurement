-- §9: which budget a STANDALONE (no-requisition) purchase order charges.
--
-- moveCommitmentPrToPo / spendOnInvoice / releaseOnPoClose all early-returned on `!po.pr`, so a PO
-- raised without a requisition never committed, never spent and never released — its money was
-- invisible to budget-vs-actual. The requisition was the only carrier of a cost centre; a PO
-- without one had nowhere to be attributed.
--
-- NULLABLE on purpose. Every PO written before this column existed has none, and a PR-sourced PO
-- keeps using its requisition's cost centre — one document, one attribution. The ledger reports an
-- unattributed standalone PO rather than guessing a budget for it.
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "costCenterId" TEXT;

ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_costCenterId_fkey";
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PurchaseOrder_costCenterId_idx" ON "PurchaseOrder"("costCenterId");
