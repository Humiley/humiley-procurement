"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  userSchema,
  userUpdateSchema,
  DEFAULT_PASSWORD,
  type UserInput,
  type UserUpdateInput,
} from "@/lib/schemas/user";

export async function createUser(input: UserInput) {
  const admin = await requireRoles("ADMIN");
  const data = userSchema.parse(input);
  const email = data.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists.");

  const user = await db.user.create({
    data: {
      name: data.name,
      email,
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      roles: data.roles,
      departmentId: data.departmentId || null,
      isChief: data.isChief ?? false,
      isActive: data.isActive ?? true,
      mustChangePw: true,
    },
  });
  await audit({
    userId: admin.id,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, roles: user.roles },
  });
  revalidatePath("/admin/users");
  return { id: user.id };
}

export async function updateUser(id: string, input: UserUpdateInput) {
  const admin = await requireRoles("ADMIN");
  const data = userUpdateSchema.parse(input);

  const before = await db.user.findUnique({ where: { id } });
  if (!before) throw new Error("User not found.");

  const user = await db.user.update({
    where: { id },
    data: {
      name: data.name,
      roles: data.roles,
      departmentId: data.departmentId || null,
      isChief: data.isChief ?? false,
      isActive: data.isActive ?? true,
    },
  });
  await audit({
    userId: admin.id,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: id,
    before: { roles: before.roles, isActive: before.isActive, departmentId: before.departmentId },
    after: { roles: user.roles, isActive: user.isActive, departmentId: user.departmentId },
  });
  revalidatePath("/admin/users");
  return { id: user.id };
}

export async function resetUserPassword(id: string) {
  const admin = await requireRoles("ADMIN");
  await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      mustChangePw: true,
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  await audit({
    userId: admin.id,
    action: "USER_RESET_PASSWORD",
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
