import { NextResponse } from "next/server";
import { currentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const ALLOWED_ENTITIES = new Set(["PurchaseRequisition"]);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const entityType = String(form.get("entityType") ?? "");
  const entityId = String(form.get("entityId") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_ENTITIES.has(entityType) || !entityId) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  // PR: only the requester (in draft) may attach; managers/purchasers/admin may always attach.
  if (entityType === "PurchaseRequisition") {
    const pr = await db.purchaseRequisition.findUnique({ where: { id: entityId } });
    if (!pr) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    const privileged =
      user.roles.includes("ADMIN") ||
      user.roles.includes("PURCHASER") ||
      user.roles.includes("DIRECTOR") ||
      user.roles.includes("DEPT_MANAGER");
    if (pr.requesterId !== user.id && !privileged) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let stored;
  try {
    stored = await saveUpload(file);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }

  const att = await db.attachment.create({
    data: {
      entityType,
      entityId,
      fileName: file.name.slice(0, 255),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: stored.sizeBytes,
      storagePath: stored.storagePath,
      uploadedById: user.id,
    },
  });
  await audit({
    userId: user.id,
    action: "ATTACHMENT_ADD",
    entityType,
    entityId,
    after: { fileName: att.fileName, sizeBytes: att.sizeBytes },
  });

  return NextResponse.json({ id: att.id, fileName: att.fileName, sizeBytes: att.sizeBytes });
}
