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
    const pr = await db.purchaseRequisition.findUnique({ where: { id: att.entityId }, select: { requesterId: true, departmentId: true } });
    if (pr?.requesterId === user.id) return true;
    if (hasAnyRole(user, ["PURCHASER", "DIRECTOR", "ACCOUNTANT"])) return true;
    // A DEPT_MANAGER may only reach their OWN department's docs — matches the detail-page read boundary
    // (was unconditional, letting any dept manager read every department's PR attachments).
    return user.roles.includes("DEPT_MANAGER") && !!pr && pr.departmentId === user.departmentId;
  }
  if (att.entityType === "PaymentRequest") {
    const preq = await db.paymentRequest.findUnique({ where: { id: att.entityId }, select: { requesterId: true, departmentId: true } });
    if (preq?.requesterId === user.id) return true;
    if (hasAnyRole(user, ["ACCOUNTANT", "DIRECTOR", "PURCHASER"])) return true;
    return user.roles.includes("DEPT_MANAGER") && !!preq && preq.departmentId === user.departmentId;
  }
  // other document families (PO/GRN/invoice/vendor/contract) are handled by document roles
  return hasAnyRole(user, ["PURCHASER", "DIRECTOR", "DEPT_MANAGER", "ACCOUNTANT", "WAREHOUSE"]);
}
