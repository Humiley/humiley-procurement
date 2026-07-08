"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";

const D = Prisma.Decimal;

const reorderPrSchema = z.object({
  warehouseId: z.string().min(1),
  costCenterId: z.string().min(1, "Cost center is required"),
  itemIds: z.array(z.string().min(1)).min(1, "Pick at least one item"),
});
export type ReorderPrPayload = z.input<typeof reorderPrSchema>;

/** §10b one-click reorder: draft PR with reorderQty lines, flagged source=REORDER. */
export async function generateReorderPr(input: ReorderPrPayload) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const values = reorderPrSchema.parse(input);
  if (!user.departmentId) throw new Error("Your account has no department — ask an admin to fix it.");

  const [policies, items, balances] = await Promise.all([
    db.itemStockPolicy.findMany({ where: { warehouseId: values.warehouseId, itemId: { in: values.itemIds } } }),
    db.item.findMany({ where: { id: { in: values.itemIds } } }),
    db.stockBalance.findMany({ where: { warehouseId: values.warehouseId, itemId: { in: values.itemIds } } }),
  ]);
  const policyByItem = new Map(policies.map((p) => [p.itemId, p]));
  const balByItem = new Map(balances.map((b) => [b.itemId, b]));

  const lines = items.map((it) => {
    const pol = policyByItem.get(it.id);
    const qty = pol && !new D(pol.reorderQty).isZero() ? new D(pol.reorderQty) : new D(pol?.minQty ?? 1);
    const price = it.lastPriceVnd ?? balByItem.get(it.id)?.avgCostVnd ?? new D(0);
    return { itemId: it.id, uomId: it.uomId, qty, estUnitPriceVnd: new D(price) };
  });
  const total = lines.reduce((s, l) => s.plus(l.qty.times(l.estUnitPriceVnd)), new D(0)).toDecimalPlaces(2);

  const pr = await db.$transaction(async (tx) => {
    const prNumber = await nextDocNumber("PR", tx, { prefix: "PR" });
    return tx.purchaseRequisition.create({
      data: {
        prNumber,
        requesterId: user.id,
        departmentId: user.departmentId!,
        costCenterId: values.costCenterId,
        neededByDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        purpose: "Reorder — stock below minimum (auto-generated) / Đặt hàng lại — tồn kho dưới mức tối thiểu",
        source: "REORDER",
        status: "DRAFT",
        totalEstimatedVnd: total,
        lines: { create: lines },
      },
    });
  });

  await audit({ userId: user.id, action: "PR_REORDER_CREATE", entityType: "PurchaseRequisition", entityId: pr.id, after: { prNumber: pr.prNumber, source: "REORDER", lines: lines.length } });
  revalidatePath("/requisitions");
  return { id: pr.id, prNumber: pr.prNumber };
}
