"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  departmentSchema,
  costCenterSchema,
  categorySchema,
  uomSchema,
  itemSchema,
} from "@/lib/schemas/masterdata";

type FormValues = Record<string, string | boolean>;

function rethrow(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error("That code is already in use — codes must be unique.");
  }
  throw e;
}

// ---- Departments -------------------------------------------------------------
export async function createDepartment(values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = departmentSchema.parse(values);
  try {
    const row = await db.department.create({
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        managerId: data.managerId ?? null,
      },
    });
    await audit({ userId: admin.id, action: "DEPT_CREATE", entityType: "Department", entityId: row.id, after: data });
    revalidatePath("/admin/departments");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

export async function updateDepartment(id: string, values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = departmentSchema.parse(values);
  try {
    await db.department.update({
      where: { id },
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        managerId: data.managerId ?? null,
      },
    });
    await audit({ userId: admin.id, action: "DEPT_UPDATE", entityType: "Department", entityId: id, after: data });
    revalidatePath("/admin/departments");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}

// ---- Cost Centers ------------------------------------------------------------
export async function createCostCenter(values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = costCenterSchema.parse(values);
  try {
    const row = await db.costCenter.create({ data });
    await audit({ userId: admin.id, action: "CC_CREATE", entityType: "CostCenter", entityId: row.id, after: data });
    revalidatePath("/admin/cost-centers");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

export async function updateCostCenter(id: string, values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = costCenterSchema.parse(values);
  try {
    await db.costCenter.update({ where: { id }, data });
    await audit({ userId: admin.id, action: "CC_UPDATE", entityType: "CostCenter", entityId: id, after: data });
    revalidatePath("/admin/cost-centers");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}

// ---- Categories --------------------------------------------------------------
export async function createCategory(values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = categorySchema.parse(values);
  try {
    const row = await db.category.create({
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        parentId: data.parentId ?? null,
        isCapex: data.isCapex,
      },
    });
    await audit({ userId: admin.id, action: "CAT_CREATE", entityType: "Category", entityId: row.id, after: data });
    revalidatePath("/admin/categories");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

export async function updateCategory(id: string, values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = categorySchema.parse(values);
  if (data.parentId === id) throw new Error("A category cannot be its own parent.");
  try {
    await db.category.update({
      where: { id },
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        parentId: data.parentId ?? null,
        isCapex: data.isCapex,
      },
    });
    await audit({ userId: admin.id, action: "CAT_UPDATE", entityType: "Category", entityId: id, after: data });
    revalidatePath("/admin/categories");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}

// ---- UoM ---------------------------------------------------------------------
export async function createUom(values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = uomSchema.parse(values);
  try {
    const row = await db.uom.create({ data });
    await audit({ userId: admin.id, action: "UOM_CREATE", entityType: "Uom", entityId: row.id, after: data });
    revalidatePath("/admin/uom");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

export async function updateUom(id: string, values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = uomSchema.parse(values);
  try {
    await db.uom.update({ where: { id }, data });
    await audit({ userId: admin.id, action: "UOM_UPDATE", entityType: "Uom", entityId: id, after: data });
    revalidatePath("/admin/uom");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}

// ---- Items -------------------------------------------------------------------
export async function createItem(values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = itemSchema.parse(values);
  try {
    const row = await db.item.create({
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        categoryId: data.categoryId,
        uomId: data.uomId,
        specDescription: data.specDescription ?? null,
        lastPriceVnd: data.lastPriceVnd != null ? new Prisma.Decimal(data.lastPriceVnd) : null,
        isLotTracked: data.isLotTracked,
        isActive: data.isActive,
      },
    });
    await audit({ userId: admin.id, action: "ITEM_CREATE", entityType: "Item", entityId: row.id, after: { code: data.code } });
    revalidatePath("/admin/items");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

export async function updateItem(id: string, values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = itemSchema.parse(values);
  try {
    await db.item.update({
      where: { id },
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        categoryId: data.categoryId,
        uomId: data.uomId,
        specDescription: data.specDescription ?? null,
        lastPriceVnd: data.lastPriceVnd != null ? new Prisma.Decimal(data.lastPriceVnd) : null,
        isLotTracked: data.isLotTracked,
        isActive: data.isActive,
      },
    });
    await audit({ userId: admin.id, action: "ITEM_UPDATE", entityType: "Item", entityId: id, after: { code: data.code } });
    revalidatePath("/admin/items");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}
