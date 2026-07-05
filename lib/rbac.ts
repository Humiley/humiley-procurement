import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * RBAC layer (spec §12.1 / CLAUDE.md). Every mutation is permission-checked here. Page-level
 * gates treat ADMIN as a superuser for navigation; workflow-level SoD (no self-approval) is
 * enforced separately in lib/workflow + lib/esign (Phase 4), NOT bypassed by ADMIN.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  departmentId: string | null;
  isChief: boolean;
  locale: string;
  mustChangePw: boolean;
};

export function hasRole(u: { roles: Role[] }, r: Role): boolean {
  return u.roles.includes(r);
}

export function hasAnyRole(u: { roles: Role[] }, roles: Role[]): boolean {
  return roles.some((r) => u.roles.includes(r));
}

export function isAdmin(u: { roles: Role[] }): boolean {
  return u.roles.includes(Role.ADMIN);
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Current session user (or null). Use in Server Components / Actions. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name ?? "",
    roles: u.roles ?? [],
    departmentId: u.departmentId ?? null,
    isChief: u.isChief ?? false,
    locale: u.locale ?? "en",
    mustChangePw: u.mustChangePw ?? false,
  };
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/**
 * Require one of `roles` (ADMIN always allowed for page access). Throws ForbiddenError when
 * signed in but unauthorized; redirects to /login when not signed in.
 */
export async function requireRoles(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (roles.length > 0 && !isAdmin(u) && !hasAnyRole(u, roles)) {
    throw new ForbiddenError();
  }
  return u;
}

/** Assert without redirect (for use inside Server Actions after requireUser). */
export function assertRoles(u: SessionUser, ...roles: Role[]): void {
  if (roles.length > 0 && !isAdmin(u) && !hasAnyRole(u, roles)) {
    throw new ForbiddenError();
  }
}
