"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { contractCreateSchema, type ContractCreatePayload } from "@/lib/schemas/contract";
import { guard } from "@/lib/safe-action";

const D = Prisma.Decimal;

/** §9 framework agreement: vendor + validity + value + optional item price list. */
async function _createContract(input: ContractCreatePayload) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const values = contractCreateSchema.parse(input);

  const vendor = await db.vendor.findUnique({ where: { id: values.vendorId } });
  if (!vendor) throw new Error("Vendor not found.");
  if (vendor.status !== "APPROVED") throw new Error("Only an APPROVED vendor can hold a contract.");

  const priceList = Object.fromEntries(values.prices.map((p) => [p.itemId, p.priceVnd]));
  const contract = await db.$transaction(async (tx) => {
    const contractNumber = await nextDocNumber("CTR", tx, { prefix: "CTR" });
    return tx.contract.create({
      data: {
        contractNumber,
        vendorId: values.vendorId,
        title: values.title,
        startDate: new Date(values.startDate + "T00:00:00"),
        endDate: new Date(values.endDate + "T23:59:59"),
        valueVnd: new D(values.valueVnd),
        renewalAlertDays: values.renewalAlertDays,
        priceListJson: priceList,
        status: "DRAFT",
      },
    });
  });

  await audit({ userId: user.id, action: "CONTRACT_CREATE", entityType: "Contract", entityId: contract.id, after: { contractNumber: contract.contractNumber, prices: values.prices.length } });
  revalidatePath("/contracts");
  return { id: contract.id };
}

async function _activateContract(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  if (!(await transition(db.contract, id, "DRAFT", "ACTIVE"))) throw staleError();
  await audit({ userId: user.id, action: "CONTRACT_ACTIVATE", entityType: "Contract", entityId: id, after: { status: "ACTIVE" } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return { id };
}

async function _terminateContract(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  if (!(await transition(db.contract, id, "ACTIVE", "TERMINATED"))) throw staleError();
  await audit({ userId: user.id, action: "CONTRACT_TERMINATE", entityType: "Contract", entityId: id, after: { status: "TERMINATED" } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return { id };
}

/**
 * §9 renewal alerts. The implementation lives in lib/sweeps.ts, where the TIMER runs it — this
 * stays only as a manual trigger (and so the register can force a check on demand). Two copies of
 * this logic would drift, and the copy nobody runs is the one that rots.
 */
async function _checkContractRenewals() {
  const { runRenewalSweep } = await import("@/lib/sweeps");
  await runRenewalSweep();
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createContract(...a: Parameters<typeof _createContract>) { return guard(_createContract, a); }
export async function activateContract(...a: Parameters<typeof _activateContract>) { return guard(_activateContract, a); }
export async function terminateContract(...a: Parameters<typeof _terminateContract>) { return guard(_terminateContract, a); }
export async function checkContractRenewals(...a: Parameters<typeof _checkContractRenewals>) { return guard(_checkContractRenewals, a); }
