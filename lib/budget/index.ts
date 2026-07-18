import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fiscalYearOf } from "@/lib/dates";

/**
 * §9 budget control — commitment/spend ledger on Budget rows (costCenter × category × FY).
 *
 *  - PR approved   → committedVnd += each line amount           (commitPr)
 *  - PO approved   → commitment moves PR→PO amounts             (moveCommitmentPrToPo)
 *  - Invoice match → spentVnd += invoice amount, release commit (spendOnInvoice)
 *  - PO closed     → release the PO's remaining commitment      (releaseOnPoClose)
 *
 * Effects resolve per line: the explicit PrLine.budgetId wins; otherwise the (PR cost center,
 * item category, fiscal year) budget row. Lines without an item/category, or with no matching
 * budget row, are skipped (best-effort ledger — §15's WARN/BLOCK gating is the governance phase).
 */

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;

async function addToBudget(tx: Tx, budgetId: string, field: "committedVnd" | "spentVnd", delta: Prisma.Decimal) {
  if (delta.isZero()) return;
  // Atomic zero-clamped increment in ONE statement — a JS read-modify-write loses concurrent
  // postings under read-committed (two ledger effects on the same row = one silently dropped).
  const col = field === "committedVnd" ? Prisma.sql`"committedVnd"` : Prisma.sql`"spentVnd"`;
  await tx.$executeRaw`
    UPDATE "Budget" SET ${col} = GREATEST(0, ${col} + ${delta.toString()}::numeric)
    WHERE "id" = ${budgetId}`;
}

/** Resolve the budget row id for one PR line (explicit budgetId, else costCenter+category+FY). */
async function budgetIdForPrLine(
  tx: Tx,
  line: { budgetId: string | null; itemId: string | null },
  costCenterId: string,
  fiscalYear: number,
): Promise<string | null> {
  if (line.budgetId) return line.budgetId;
  if (!line.itemId) return null;
  const item = await tx.item.findUnique({ where: { id: line.itemId }, select: { categoryId: true } });
  if (!item?.categoryId) return null;
  const budget = await tx.budget.findUnique({
    where: { costCenterId_fiscalYear_categoryId: { costCenterId, fiscalYear, categoryId: item.categoryId } },
    select: { id: true },
  });
  return budget?.id ?? null;
}

/** PR approved: commit each line amount. sign=-1 reverses (e.g. a returned/cancelled PR). */
export async function commitPr(prId: string, sign: 1 | -1 = 1) {
  await db.$transaction(async (tx) => {
    const pr = await tx.purchaseRequisition.findUnique({ where: { id: prId }, include: { lines: true } });
    if (!pr) return;
    const fy = fiscalYearOf(pr.createdAt);   // the document's year, not the processing year
    for (const l of pr.lines) {
      const budgetId = await budgetIdForPrLine(tx, l, pr.costCenterId, fy);
      if (!budgetId) continue;
      const amount = new D(l.qty).times(l.estUnitPriceVnd).times(sign).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", amount);
    }
  });
}

/** PO approved: swap the source-PR commitment for the PO's actual amounts (PR-linked POs only). */
export async function moveCommitmentPrToPo(poId: string) {
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: { include: { prLine: true } }, pr: { include: { lines: true } } },
    });
    if (!po?.pr) return;
    const fy = fiscalYearOf(po.pr.createdAt);
    // Release the ENTIRE source-PR estimate — every PR line, not just the ones carried onto the PO.
    // A partial conversion (PO drops some PR lines) leaves the PR at the terminal CONVERTED state, which
    // can never spawn a second PO nor be cancelled, so a dropped line's commitment would otherwise be
    // stranded forever and permanently understate the budget's available balance. commitPr placed the
    // full estimate, so we reverse the full estimate here, then commit the PO's actual amounts.
    for (const prl of po.pr.lines) {
      const budgetId = await budgetIdForPrLine(tx, prl, po.pr.costCenterId, fy);
      if (!budgetId) continue;
      const est = new D(prl.qty).times(prl.estUnitPriceVnd).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", est.negated());
    }
    for (const l of po.lines) {
      const src = l.prLine ?? { budgetId: null, itemId: l.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, po.pr.costCenterId, fy);
      if (!budgetId) continue;
      // §20: budgets are VND — convert foreign-currency PO amounts at the PO's captured rate
      await addToBudget(tx, budgetId, "committedVnd", new D(l.amount).times(po.fxRate).toDecimalPlaces(2));
    }
  });
}

/** Invoice verified as matched: move commitment to spend for the invoiced amounts. */
export async function spendOnInvoice(invoiceId: string) {
  await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { include: { poLine: { include: { prLine: true } } } }, po: { include: { pr: { select: { costCenterId: true, createdAt: true } } } } },
    });
    if (!inv?.po.pr) return;
    const fy = fiscalYearOf(inv.po.pr.createdAt);
    for (const l of inv.lines) {
      const src = l.poLine.prLine ?? { budgetId: null, itemId: l.poLine.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, inv.po.pr.costCenterId, fy);
      if (!budgetId) continue;
      const amount = new D(l.amount).times(inv.fxRate).toDecimalPlaces(2);   // VND ledger
      await addToBudget(tx, budgetId, "spentVnd", amount);
      await addToBudget(tx, budgetId, "committedVnd", amount.negated());
    }
  });
}

/** Goods issue executed (§10b): the issued cost (qty × avgCost from the OUT movements) hits spend. */
export async function spendFromStock(goodsIssueId: string) {
  await db.$transaction(async (tx) => {
    const gi = await tx.goodsIssue.findUnique({ where: { id: goodsIssueId }, select: { costCenterId: true, createdAt: true } });
    if (!gi) return;
    const fy = fiscalYearOf(gi.createdAt);
    const movements = await tx.stockMovement.findMany({
      where: { refEntityType: "GoodsIssue", refEntityId: goodsIssueId, type: "ISSUE_OUT" },
      select: { itemId: true, qty: true, unitCostVnd: true },
    });
    for (const m of movements) {
      const budgetId = await budgetIdForPrLine(tx, { budgetId: null, itemId: m.itemId }, gi.costCenterId, fy);
      if (!budgetId) continue;
      await addToBudget(tx, budgetId, "spentVnd", new D(m.qty).times(m.unitCostVnd).toDecimalPlaces(2));
    }
  });
}

/** PO closed: release whatever commitment remains (ordered − invoiced, per line). */
export async function releaseOnPoClose(poId: string) {
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: { include: { prLine: true } }, pr: { select: { costCenterId: true, createdAt: true } } },
    });
    if (!po?.pr) return;
    const fy = fiscalYearOf(po.pr.createdAt);
    for (const l of po.lines) {
      const src = l.prLine ?? { budgetId: null, itemId: l.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, po.pr.costCenterId, fy);
      if (!budgetId) continue;
      const remaining = new D(l.qty).minus(l.invoicedQty);
      if (remaining.lessThanOrEqualTo(0)) continue;
      const release = remaining.times(l.unitPrice).times(po.fxRate).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", release.negated());
    }
  });
}
