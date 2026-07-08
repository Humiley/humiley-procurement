"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { deleteStored } from "@/lib/storage";
import { audit } from "@/lib/audit";

export async function deleteAttachment(id: string, revalidate?: string) {
  const user = await requireUser();
  const att = await db.attachment.findUnique({ where: { id } });
  if (!att) throw new Error("Attachment not found.");

  const privileged = user.roles.includes("ADMIN") || user.roles.includes("PURCHASER");
  if (att.uploadedById !== user.id && !privileged) {
    throw new Error("You can only remove attachments you added.");
  }

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
