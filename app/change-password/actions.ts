"use server";

import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { hashPassword, signOut } from "@/lib/auth";
import { audit } from "@/lib/audit";

/**
 * Self-service password change. Every provisioned account starts with a random one-time
 * password and mustChangePw=true; the middleware forces this page until the user picks
 * their own. A user who is NOT flagged must supply their current password. Returns an
 * i18n key on failure (translated by the client) so no message is redacted in production.
 */
export async function changePassword(_prev: unknown, formData: FormData): Promise<{ error: string } | never> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 10) return { error: "cp.tooShort" };
  if (!/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next)) return { error: "cp.tooWeak" };
  if (next !== confirm) return { error: "cp.mismatch" };

  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row) return { error: "cp.failed" };

  // A user who already chose their password must prove the current one; a first-login
  // (mustChangePw) user came in with the random temp password and is already authenticated.
  if (!row.mustChangePw) {
    const ok = await bcrypt.compare(current, row.passwordHash);
    if (!ok) return { error: "cp.wrongCurrent" };
  }
  if (await bcrypt.compare(next, row.passwordHash)) return { error: "cp.reuse" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePw: false },
  });
  await audit({ userId: user.id, action: "USER_CHANGE_PASSWORD", entityType: "User", entityId: user.id });
  // Sign out so the next session mints a fresh JWT (the current one still carries the stale
  // mustChangePw=true, which the middleware would otherwise bounce straight back here).
  await signOut({ redirectTo: "/login?changed=1" });
  return { error: "" }; // unreachable — signOut throws a redirect
}
