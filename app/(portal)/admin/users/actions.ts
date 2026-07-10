"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  userSchema,
  userUpdateSchema,
  generateTempPassword,
  type UserInput,
  type UserUpdateInput,
} from "@/lib/schemas/user";
import { guard } from "@/lib/safe-action";

async function _createUser(input: UserInput) {
  const admin = await requireRoles("ADMIN");
  const data = userSchema.parse(input);
  const email = data.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists.");

  const tempPassword = generateTempPassword();
  let user;
  try {
    user = await db.user.create({
      data: {
        name: data.name,
        email,
        passwordHash: await hashPassword(tempPassword),
        roles: data.roles,
        departmentId: data.departmentId || null,
        isChief: data.isChief ?? false,
        isActive: data.isActive ?? true,
        mustChangePw: true,
      },
    });
  } catch (e) {
    // Lost a create race (concurrent duplicate) → the unique constraint fired. Surface the SAME
    // friendly message the pre-check gives, not the raw Prisma "Unique constraint failed" string.
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      throw new Error("A user with this email already exists.");
    }
    throw e;
  }
  await audit({
    userId: admin.id,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, roles: user.roles },
  });
  revalidatePath("/admin/users");
  // Returned ONCE so the admin can hand the temp password to the user; never stored in plaintext.
  return { id: user.id, tempPassword };
}

async function _updateUser(id: string, input: UserUpdateInput) {
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

async function _resetUserPassword(id: string) {
  const admin = await requireRoles("ADMIN");
  const tempPassword = generateTempPassword();
  await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(tempPassword),
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
  return { ok: true, tempPassword };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createUser(...a: Parameters<typeof _createUser>) { return guard(_createUser, a); }
export async function updateUser(...a: Parameters<typeof _updateUser>) { return guard(_updateUser, a); }
export async function resetUserPassword(...a: Parameters<typeof _resetUserPassword>) { return guard(_resetUserPassword, a); }
