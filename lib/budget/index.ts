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
 * Effects resolve per line: the explicit PrLine.budgetId wins; otherwise the (cost center, item
 * category, fiscal year) budget row. Lines without an item/category, or with no matching budget
 * row, are skipped (best-effort ledger — §15's WARN/BLOCK gating is the governance phase).
 *
 * WHERE THE COST CENTER COMES FROM. A PR-sourced PO uses its requisition's — one document, one
 * attribution. A STANDALONE PO (no requisition) uses its own `costCenterId`. Until that column
 * existed every effect early-returned on `!po.pr`, so a PO raised without a requisition never
 * committed, never spent and never released: its whole spend was invisible to budget-vs-actual,
 * silently, and the budget it was drawing on reported money it did not have. A standalone PO with
 * no cost center still cannot be placed — `poBudgetContext` returns null and the effect is skipped
 * — but that is now a recorded absence rather than an unconsidered one.
 */

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;

/**
 * Run inside the CALLER'S transaction when it has one, otherwise open a private one.
 *
 * Every effect below used to open its own transaction, and every caller wrapped the call in
 * `try { … } catch (console.warn)`. Between those two decisions a ledger failure was invisible AND
 * unrecoverable: the document had already moved — a PO approved, an invoice matched, a PO closed —
 * in a transaction that had already committed, so the money state simply disagreed with the
 * document state and nothing said so. Threading the caller's `tx` lets the whole operation roll
 * back together, which is the only way "the PO is approved" and "its commitment moved" can be one
 * fact rather than two that usually agree.
 */
async function inTx<T>(tx: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : db.$transaction(fn);
}

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

/**
 * The cost center and fiscal year a PO's money belongs to, or null if it cannot be placed.
 *
 * The requisition wins where there is one, and its createdAt sets the year — the PR is the
 * document the budget was checked against, and moving the year to the PO's date would charge a
 * December requisition to the next fiscal year because the PO was cut in January. A standalone PO
 * is its own document, so it uses its own cost center and its own date.
 */
function poBudgetContext(po: {
  costCenterId: string | null;
  createdAt: Date;
  pr: { costCenterId: string; createdAt: Date } | null;
}): { costCenterId: string; fiscalYear: number } | null {
  if (po.pr) return { costCenterId: po.pr.costCenterId, fiscalYear: fiscalYearOf(po.pr.createdAt) };
  if (po.costCenterId) return { costCenterId: po.costCenterId, fiscalYear: fiscalYearOf(po.createdAt) };
  return null;
}

/** PR approved: commit each line amount. sign=-1 reverses (e.g. a returned/cancelled PR). */
export async function commitPr(prId: string, sign: 1 | -1 = 1, tx?: Tx) {
  await inTx(tx, async (tx) => {
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

/**
 * PO approved: commit the PO's actual amounts, releasing the source-PR estimate where there is one.
 *
 * A standalone PO has no estimate to release — nothing was committed for it, because no requisition
 * ever was — so it only commits. That path used to return here and commit nothing at all.
 */
export async function moveCommitmentPrToPo(poId: string, tx?: Tx) {
  await inTx(tx, async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: { include: { prLine: true } }, pr: { include: { lines: true } } },
    });
    if (!po) return;
    const ctx = poBudgetContext(po);
    if (!ctx) return;
    const { costCenterId, fiscalYear: fy } = ctx;
    // Release the ENTIRE source-PR estimate — every PR line, not just the ones carried onto the PO.
    // A partial conversion (PO drops some PR lines) leaves the PR at the terminal CONVERTED state, which
    // can never spawn a second PO nor be cancelled, so a dropped line's commitment would otherwise be
    // stranded forever and permanently understate the budget's available balance. commitPr placed the
    // full estimate, so we reverse the full estimate here, then commit the PO's actual amounts.
    for (const prl of po.pr?.lines ?? []) {
      const budgetId = await budgetIdForPrLine(tx, prl, costCenterId, fy);
      if (!budgetId) continue;
      const est = new D(prl.qty).times(prl.estUnitPriceVnd).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", est.negated());
    }
    for (const l of po.lines) {
      const src = l.prLine ?? { budgetId: null, itemId: l.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, costCenterId, fy);
      if (!budgetId) continue;
      // §20: budgets are VND — convert foreign-currency PO amounts at the PO's captured rate
      await addToBudget(tx, budgetId, "committedVnd", new D(l.amount).times(po.fxRate).toDecimalPlaces(2));
    }
  });
}

/** Invoice verified as matched: move commitment to spend for the invoiced amounts. */
export async function spendOnInvoice(invoiceId: string, tx?: Tx) {
  await inTx(tx, async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { include: { poLine: { include: { prLine: true } } } },
        po: { select: { costCenterId: true, createdAt: true, fxRate: true, pr: { select: { costCenterId: true, createdAt: true } } } },
      },
    });
    if (!inv) return;
    const ctx = poBudgetContext(inv.po);
    if (!ctx) return;
    const { costCenterId, fiscalYear: fy } = ctx;
    for (const l of inv.lines) {
      const src = l.poLine.prLine ?? { budgetId: null, itemId: l.poLine.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, costCenterId, fy);
      if (!budgetId) continue;
      // Spend the ACTUAL invoiced money (invoice price × invoice fx).
      const spend = new D(l.amount).times(inv.fxRate).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "spentVnd", spend);
      // But RELEASE the commitment for these units at the price they were COMMITTED at (PO price × PO
      // fx), not the invoice price. moveCommitmentPrToPo committed qty×PO-price×PO-fx and
      // releaseOnPoClose frees the remainder at the same basis — so drawing committed down at the
      // invoice price left a residue (a within-tolerance price gap) stranded on committedVnd forever,
      // or, if invoice>PO, over-drew and ate other commitments. Matching the basis makes a fully
      // invoiced line's commitment net to exactly zero.
      const releaseCommit = new D(l.qty).times(l.poLine.unitPrice).times(inv.po.fxRate).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", releaseCommit.negated());
    }
  });
}

/** Goods issue executed (§10b): the issued cost (qty × avgCost from the OUT movements) hits spend. */
export async function spendFromStock(goodsIssueId: string, tx?: Tx) {
  await inTx(tx, async (tx) => {
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
export async function releaseOnPoClose(poId: string, tx?: Tx) {
  await inTx(tx, async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: { include: { prLine: true } }, pr: { select: { costCenterId: true, createdAt: true } } },
    });
    if (!po) return;
    const ctx = poBudgetContext(po);
    if (!ctx) return;
    const { costCenterId, fiscalYear: fy } = ctx;
    for (const l of po.lines) {
      const src = l.prLine ?? { budgetId: null, itemId: l.itemId };
      const budgetId = await budgetIdForPrLine(tx, src, costCenterId, fy);
      if (!budgetId) continue;
      const remaining = new D(l.qty).minus(l.invoicedQty);
      if (remaining.lessThanOrEqualTo(0)) continue;
      const release = remaining.times(l.unitPrice).times(po.fxRate).toDecimalPlaces(2);
      await addToBudget(tx, budgetId, "committedVnd", release.negated());
    }
  });
}
