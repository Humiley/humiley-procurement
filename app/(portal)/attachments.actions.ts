"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { deleteStored } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { canAccessAttachment } from "@/lib/attachment-authz";

export async function deleteAttachment(id: string, revalidate?: string) {
  const user = await requireUser();
  const att = await db.attachment.findUnique({ where: { id } });
  if (!att) throw new Error("Attachment not found.");

  // uploader or ADMIN only — deletion is stricter than viewing (audit evidence must not be
  // removable by unrelated privileged roles)
  if (att.uploadedById !== user.id && !user.roles.includes("ADMIN")) {
    throw new Error("You can only remove attachments you added.");
  }
  if (!(await canAccessAttachment(user, att))) throw new Error("Forbidden.");

  await db.attachment.delete({ where: { id } });
  await deleteStored(att.storagePath);
  await audit({
    userId: user.id,
    action: "ATTACHMENT_REMOVE",
    entityType: att.entityType,
    entityId: att.entityId,
    before: { fileName: att.fileName },
  });
  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}
