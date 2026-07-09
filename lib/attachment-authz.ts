import "server-only";
import { db } from "@/lib/db";
import { hasAnyRole, type SessionUser } from "@/lib/rbac";
import type { Attachment } from "@prisma/client";

/**
 * §15 entity-scoped attachment access — ONE policy for download and delete, mirroring the
 * upload rules: the uploader and the document's requester always may; otherwise access follows
 * the entity's visibility (management roles for PRs, accounting for payment requests, and the
 * broad document-handling roles for everything else). ADMIN always may.
 */
export async function canAccessAttachment(user: SessionUser, att: Attachment): Promise<boolean> {
  if (user.roles.includes("ADMIN")) return true;
  if (att.uploadedById === user.id) return true;

  if (att.entityType === "PurchaseRequisition") {
    const pr = await db.purchaseRequisition.findUnique({ where: { id: att.entityId }, select: { requesterId: true } });
    return pr?.requesterId === user.id || hasAnyRole(user, ["PURCHASER", "DIRECTOR", "DEPT_MANAGER", "ACCOUNTANT"]);
  }
  if (att.entityType === "PaymentRequest") {
    const preq = await db.paymentRequest.findUnique({ where: { id: att.entityId }, select: { requesterId: true } });
    return preq?.requesterId === user.id || hasAnyRole(user, ["ACCOUNTANT", "DIRECTOR", "DEPT_MANAGER", "PURCHASER"]);
  }
  // other document families (PO/GRN/invoice/vendor/contract) are handled by document roles
  return hasAnyRole(user, ["PURCHASER", "DIRECTOR", "DEPT_MANAGER", "ACCOUNTANT", "WAREHOUSE"]);
}
