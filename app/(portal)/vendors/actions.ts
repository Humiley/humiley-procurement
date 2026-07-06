"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { vendorSchema } from "@/lib/schemas/masterdata";

type FormValues = Record<string, string | boolean>;

function rethrow(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error("That vendor code is already in use — codes must be unique.");
  }
  throw e;
}

export async function createVendor(values: FormValues) {
  const user = await requireRoles("ADMIN", "PURCHASER");
  const data = vendorSchema.parse(values);
  try {
    const row = await db.vendor.create({
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        taxCode: data.taxCode ?? null,
        address: data.address ?? null,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        paymentTermDays: data.paymentTermDays,
        bankName: data.bankName ?? null,
        bankAccount: data.bankAccount ?? null,
        categories: data.categories,
        // status defaults to DRAFT; the vendor approval flow is Phase 5.
      },
    });
    await audit({ userId: user.id, action: "VENDOR_CREATE", entityType: "Vendor", entityId: row.id, after: { code: data.code } });
    revalidatePath("/vendors");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

export async function updateVendor(id: string, values: FormValues) {
  const user = await requireRoles("ADMIN", "PURCHASER");
  const data = vendorSchema.parse(values);
  try {
    await db.vendor.update({
      where: { id },
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        taxCode: data.taxCode ?? null,
        address: data.address ?? null,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        paymentTermDays: data.paymentTermDays,
        bankName: data.bankName ?? null,
        bankAccount: data.bankAccount ?? null,
        categories: data.categories,
      },
    });
    await audit({ userId: user.id, action: "VENDOR_UPDATE", entityType: "Vendor", entityId: id, after: { code: data.code } });
    revalidatePath("/vendors");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}
