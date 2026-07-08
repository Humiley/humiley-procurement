"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { notifyRole } from "@/lib/notify";
import { contractCreateSchema, type ContractCreatePayload } from "@/lib/schemas/contract";

const D = Prisma.Decimal;
const DAY = 24 * 3600 * 1000;

/** §9 framework agreement: vendor + validity + value + optional item price list. */
export async function createContract(input: ContractCreatePayload) {
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

export async function activateContract(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  if (!(await transition(db.contract, id, "DRAFT", "ACTIVE"))) throw staleError();
  await audit({ userId: user.id, action: "CONTRACT_ACTIVATE", entityType: "Contract", entityId: id, after: { status: "ACTIVE" } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return { id };
}

export async function terminateContract(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  if (!(await transition(db.contract, id, "ACTIVE", "TERMINATED"))) throw staleError();
  await audit({ userId: user.id, action: "CONTRACT_TERMINATE", entityType: "Contract", entityId: id, after: { status: "TERMINATED" } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return { id };
}

/**
 * §9 renewal alerts — ACTIVE contracts within renewalAlertDays of endDate notify PURCHASER +
 * DIRECTOR (deduped on an unread notification). Also expires past-end contracts. Runs on
 * register load (a nightly job would add nothing until the API phase owns scheduling).
 */
export async function checkContractRenewals() {
  const now = new Date();
  await db.contract.updateMany({ where: { status: "ACTIVE", endDate: { lt: now } }, data: { status: "EXPIRED" } });

  const active = await db.contract.findMany({
    where: { status: "ACTIVE" },
    include: { vendor: { select: { code: true, nameEn: true } } },
  });
  for (const c of active) {
    const daysLeft = Math.ceil((c.endDate.getTime() - now.getTime()) / DAY);
    if (daysLeft > c.renewalAlertDays) continue;
    const link = `/contracts/${c.id}`;
    const dup = await db.notification.findFirst({ where: { link, isRead: false } });
    if (dup) continue;
    const payload = {
      titleEn: `Contract ${c.contractNumber} (${c.vendor.code}) expires in ${daysLeft} day(s)`,
      titleVn: `Hợp đồng ${c.contractNumber} (${c.vendor.code}) hết hạn sau ${daysLeft} ngày`,
      bodyEn: `${c.title} — valid to ${c.endDate.toISOString().slice(0, 10)}. Review for renewal.`,
      bodyVn: `${c.title} — hiệu lực đến ${c.endDate.toISOString().slice(0, 10)}. Xem xét gia hạn.`,
      link,
    };
    await notifyRole("PURCHASER", payload);
    await notifyRole("DIRECTOR", payload);
  }
}
