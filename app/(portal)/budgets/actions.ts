"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const D = Prisma.Decimal;

const budgetUpsertSchema = z.object({
  costCenterId: z.string().min(1, "Cost center is required"),
  categoryId: z.string().min(1, "Category is required"),
  fiscalYear: z.coerce.number().int().min(2020).max(2100),
  amountVnd: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter the budget amount in whole VND"),
});
export type BudgetUpsertPayload = z.input<typeof budgetUpsertSchema>;

/** §9 admin budget row (costCenter × category × FY): create or set the amount; ledger columns untouched. */
export async function upsertBudget(input: BudgetUpsertPayload) {
  const admin = await requireRoles("ADMIN");
  const values = budgetUpsertSchema.parse(input);

  const row = await db.budget.upsert({
    where: {
      costCenterId_fiscalYear_categoryId: {
        costCenterId: values.costCenterId,
        fiscalYear: values.fiscalYear,
        categoryId: values.categoryId,
      },
    },
    update: { amountVnd: new D(values.amountVnd) },
    create: {
      costCenterId: values.costCenterId,
      categoryId: values.categoryId,
      fiscalYear: values.fiscalYear,
      amountVnd: new D(values.amountVnd),
    },
  });

  await audit({ userId: admin.id, action: "BUDGET_UPSERT", entityType: "Budget", entityId: row.id, after: values });
  revalidatePath("/budgets");
  return { id: row.id };
}
