import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentFiscalYear } from "@/lib/dates";

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
  const row = await tx.budget.findUnique({ where: { id: budgetId } });
  if (!row) return;
  let next = row[field].plus(delta);
  if (next.isNegative()) next = new D(0);   // never negative — releases clamp at zero
  await tx.budget.update({ where: { id: budgetId }, data: { [field]: next } });
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
  const fy = currentFiscalYear();
  await db.$transaction(async (tx) => {
    const pr = await tx.purchaseRequisition.findUnique({ where: { id: prId }, include: { lines: true } });
    if (!pr) return;
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
  const fy = currentFiscalYear();
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: { include: { prLine: true } }, pr: { select: { costCenterId: true } } },
    });
    if (!po?.pr) return;
    for (const l of po.lines) {
      const src = l.prLine ?? { budgetId: null, itemId: l.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, po.pr.costCenterId, fy);
      if (!budgetId) continue;
      // release the PR estimate, commit the PO amount
      if (l.prLine) {
        const est = new D(l.prLine.qty).times(l.prLine.estUnitPriceVnd).toDecimalPlaces(2);
        await addToBudget(tx, budgetId, "committedVnd", est.negated());
      }
      await addToBudget(tx, budgetId, "committedVnd", new D(l.amount));
    }
  });
}

/** Invoice verified as matched: move commitment to spend for the invoiced amounts. */
export async function spendOnInvoice(invoiceId: string) {
  const fy = currentFiscalYear();
  await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { include: { poLine: { include: { prLine: true } } } }, po: { include: { pr: { select: { costCenterId: true } } } } },
    });
    if (!inv?.po.pr) return;
    for (const l of inv.lines) {
      const src = l.poLine.prLine ?? { budgetId: null, itemId: l.poLine.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, inv.po.pr.costCenterId, fy);
      if (!budgetId) continue;
      const amount = new D(l.amount);
      await addToBudget(tx, budgetId, "spentVnd", amount);
      await addToBudget(tx, budgetId, "committedVnd", amount.negated());
    }
  });
}

/** PO closed: release whatever commitment remains (ordered − invoiced, per line). */
export async function releaseOnPoClose(poId: string) {
  const fy = currentFiscalYear();
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: { include: { prLine: true } }, pr: { select: { costCenterId: true } } },
    });
    if (!po?.pr) return;
    for (const l of po.lines) {
      const src = l.prLine ?? { budgetId: null, itemId: l.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, po.pr.costCenterId, fy);
      if (!budgetId) continue;
      const remaining = new D(l.qty).minus(l.invoicedQty);
      if (remaining.lessThanOrEqualTo(0)) continue;
      const release = remaining.times(l.unitPrice).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", release.negated());
    }
  });
}
