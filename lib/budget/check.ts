import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fiscalYearOf } from "@/lib/dates";

const D = Prisma.Decimal;

export type BudgetCheckRow = {
  budgetId: string;
  costCenter: string;
  category: string;
  amountVnd: string;
  committedVnd: string;
  spentVnd: string;
  newCommitVnd: string;
  remainingVnd: string;   // before this PR
  over: boolean;          // committed + spent + newCommit > amount
};

/**
 * §9 pre-submit budget check: resolve every PR line to its budget row (explicit budgetId, else
 * costCenter × item.category × FY) and project the new commitment. Lines with no budget row are
 * unbudgeted and never block (§9 keeps the ledger best-effort).
 */
export async function checkPrBudget(prId: string): Promise<BudgetCheckRow[]> {
  const pr = await db.purchaseRequisition.findUnique({
    where: { id: prId },
    include: { lines: { include: { item: { select: { categoryId: true } } } } },
  });
  if (!pr) return [];
  // The document's FY, matching what the commit ledger (lib/budget/index.ts) will later charge —
  // NOT the processing year. A PR created 2025-12-30 and submitted 2026-01-02 must screen the
  // same Budget row commitPr mutates, or the §9 BLOCK gate checks the wrong row.
  const fy = fiscalYearOf(pr.createdAt);

  // aggregate the PR's would-be commitment per budget row
  const commitByBudget = new Map<string, Prisma.Decimal>();
  for (const l of pr.lines) {
    let budgetId = l.budgetId;
    if (!budgetId && l.item?.categoryId) {
      const row = await db.budget.findUnique({
        where: { costCenterId_fiscalYear_categoryId: { costCenterId: pr.costCenterId, fiscalYear: fy, categoryId: l.item.categoryId } },
        select: { id: true },
      });
      budgetId = row?.id ?? null;
    }
    if (!budgetId) continue;
    const amount = new D(l.qty).times(l.estUnitPriceVnd).toDecimalPlaces(2);
    commitByBudget.set(budgetId, (commitByBudget.get(budgetId) ?? new D(0)).plus(amount));
  }
  if (commitByBudget.size === 0) return [];

  const rows = await db.budget.findMany({
    where: { id: { in: Array.from(commitByBudget.keys()) } },
    include: { costCenter: { select: { code: true } }, category: { select: { code: true } } },
  });
  return rows.map((b) => {
    const newCommit = commitByBudget.get(b.id) ?? new D(0);
    const used = new D(b.committedVnd).plus(b.spentVnd);
    const remaining = new D(b.amountVnd).minus(used);
    return {
      budgetId: b.id,
      costCenter: b.costCenter.code,
      category: b.category.code,
      amountVnd: new D(b.amountVnd).toFixed(0),
      committedVnd: new D(b.committedVnd).toFixed(0),
      spentVnd: new D(b.spentVnd).toFixed(0),
      newCommitVnd: newCommit.toFixed(0),
      remainingVnd: remaining.toFixed(0),
      over: used.plus(newCommit).greaterThan(b.amountVnd),
    };
  });
}
