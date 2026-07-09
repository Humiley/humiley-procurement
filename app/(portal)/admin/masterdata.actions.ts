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
import { guard } from "@/lib/safe-action";

type FormValues = Record<string, string | boolean>;

function rethrow(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error("That code is already in use — codes must be unique.");
  }
  throw e;
}

// ---- Departments -------------------------------------------------------------
async function _createDepartment(values: FormValues) {
  const admin = await requireRoles("ADMIN");
  const data = departmentSchema.parse(values);
  try {
    const row = await db.department.create({
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        managerId: data.managerId ?? null,
        overBudgetPolicy: data.overBudgetPolicy,
      },
    });
    await audit({ userId: admin.id, action: "DEPT_CREATE", entityType: "Department", entityId: row.id, after: data });
    revalidatePath("/admin/departments");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

async function _updateDepartment(id: string, values: FormValues) {
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
        overBudgetPolicy: data.overBudgetPolicy,
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
async function _createCostCenter(values: FormValues) {
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

async function _updateCostCenter(id: string, values: FormValues) {
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
async function _createCategory(values: FormValues) {
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

async function _updateCategory(id: string, values: FormValues) {
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
async function _createUom(values: FormValues) {
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

async function _updateUom(id: string, values: FormValues) {
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
async function _createItem(values: FormValues) {
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

async function _updateItem(id: string, values: FormValues) {
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

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createDepartment(...a: Parameters<typeof _createDepartment>) { return guard(_createDepartment, a); }
export async function updateDepartment(...a: Parameters<typeof _updateDepartment>) { return guard(_updateDepartment, a); }
export async function createCostCenter(...a: Parameters<typeof _createCostCenter>) { return guard(_createCostCenter, a); }
export async function updateCostCenter(...a: Parameters<typeof _updateCostCenter>) { return guard(_updateCostCenter, a); }
export async function createCategory(...a: Parameters<typeof _createCategory>) { return guard(_createCategory, a); }
export async function updateCategory(...a: Parameters<typeof _updateCategory>) { return guard(_updateCategory, a); }
export async function createUom(...a: Parameters<typeof _createUom>) { return guard(_createUom, a); }
export async function updateUom(...a: Parameters<typeof _updateUom>) { return guard(_updateUom, a); }
export async function createItem(...a: Parameters<typeof _createItem>) { return guard(_createItem, a); }
export async function updateItem(...a: Parameters<typeof _updateItem>) { return guard(_updateItem, a); }
