import "server-only";
import { db } from "@/lib/db";
import { hasAnyRole, type SessionUser } from "@/lib/rbac";

/**
 * Record-level "can view this document" gates, shared by the detail PAGE and its PDF
 * route so the two can never drift. The PDF routes previously authenticated only that a
 * caller was signed in, leaking payee bank details / vendor pricing to any account.
 * Each returns false when the document is missing (→ the caller responds 404).
 */

export async function canViewPaymentRequest(user: SessionUser, id: string): Promise<boolean> {
  const q = await db.paymentRequest.findUnique({ where: { id }, select: { requesterId: true } });
  if (!q) return false;
  return (
    q.requesterId === user.id ||
    hasAnyRole(user, ["ACCOUNTANT", "ADMIN", "PURCHASER", "DIRECTOR", "DEPT_MANAGER"])
  );
}

export async function canViewPurchaseOrder(user: SessionUser, id: string): Promise<boolean> {
  const po = await db.purchaseOrder.findUnique({ where: { id }, select: { createdById: true } });
  if (!po) return false;
  return (
    po.createdById === user.id ||
    hasAnyRole(user, ["PURCHASER", "ADMIN", "DIRECTOR", "ACCOUNTANT", "DEPT_MANAGER"])
  );
}

export function canViewRfq(user: SessionUser): boolean {
  return hasAnyRole(user, ["PURCHASER", "ADMIN", "DIRECTOR", "ACCOUNTANT", "DEPT_MANAGER"]);
}
