"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ShipmentDocType } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { guard } from "@/lib/safe-action";

/** §20 import-document checklist per PO: C/O + B/L + invoice + packing list + customs decl (+ license). */
async function _generateShipmentDocs(params: { poId: string; cooFormTypeId: string | null }) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const po = await db.purchaseOrder.findUnique({
    where: { id: params.poId },
    include: { shipmentDocs: true, lines: { select: { itemId: true } } },
  });
  if (!po) throw new Error("Purchase order not found.");
  if (po.shipmentDocs.length) throw new Error("This PO already has a document checklist.");

  const itemIds = po.lines.map((l) => l.itemId).filter(Boolean) as string[];
  const needsLicense = itemIds.length
    ? (await db.itemTrade.count({ where: { itemId: { in: itemIds }, requiresImportLicense: true } })) > 0
    : false;

  const types: ShipmentDocType[] = ["CO", "BL", "INVOICE", "PACKING_LIST", "CUSTOMS_DECL"];
  if (needsLicense) types.push("IMPORT_LICENSE");

  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { cooFormTypeId: params.cooFormTypeId } });
    for (const type of types) {
      await tx.shipmentDoc.create({
        data: { poId: po.id, type, cooFormTypeId: type === "CO" ? params.cooFormTypeId : null, status: "PENDING" },
      });
    }
  });

  await audit({ userId: user.id, action: "SHIPDOCS_GENERATE", entityType: "PurchaseOrder", entityId: po.id, after: { types, cooFormTypeId: params.cooFormTypeId } });
  revalidatePath(`/purchase-orders/${po.id}`);
  return { count: types.length };
}

const receiveSchema = z.object({
  docId: z.string().min(1),
  docNumber: z.string().trim().optional().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
});
export type ShipDocReceivePayload = z.input<typeof receiveSchema>;

async function _receiveShipmentDoc(input: ShipDocReceivePayload) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const v = receiveSchema.parse(input);
  const doc = await db.shipmentDoc.findUnique({ where: { id: v.docId } });
  if (!doc) throw new Error("Document not found.");
  if (doc.status !== "PENDING") throw new Error("Only a pending document can be marked received.");

  await db.shipmentDoc.update({
    where: { id: doc.id },
    data: { status: "RECEIVED", docNumber: v.docNumber || null, issueDate: v.issueDate ? new Date(v.issueDate + "T00:00:00") : null },
  });
  await audit({ userId: user.id, action: "SHIPDOC_RECEIVE", entityType: "ShipmentDoc", entityId: doc.id, after: { type: doc.type, docNumber: v.docNumber || null } });
  revalidatePath(`/purchase-orders/${doc.poId}`);
  return { id: doc.id };
}

/** VERIFIED is a §19 act — the purchaser signs that the paper matches the shipment. */
async function _verifyShipmentDoc(params: { docId: string; password: string }) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const doc = await db.shipmentDoc.findUnique({ where: { id: params.docId }, include: { po: { select: { poNumber: true } } } });
  if (!doc) throw new Error("Document not found.");
  if (doc.status !== "RECEIVED") throw new Error("Receive the document before verifying it.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "ShipmentDoc",
      entityId: doc.id,
      meaning: "VERIFIED",
      record: { po: doc.po.poNumber, type: doc.type, docNumber: doc.docNumber },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  await db.shipmentDoc.update({ where: { id: doc.id }, data: { status: "VERIFIED" } });
  await audit({ userId: user.id, action: "SHIPDOC_VERIFY", entityType: "ShipmentDoc", entityId: doc.id, after: { type: doc.type, signatureId: sig.id } });
  revalidatePath(`/purchase-orders/${doc.poId}`);
  return { id: doc.id };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function generateShipmentDocs(...a: Parameters<typeof _generateShipmentDocs>) { return guard(_generateShipmentDocs, a); }
export async function receiveShipmentDoc(...a: Parameters<typeof _receiveShipmentDoc>) { return guard(_receiveShipmentDoc, a); }
export async function verifyShipmentDoc(...a: Parameters<typeof _verifyShipmentDoc>) { return guard(_verifyShipmentDoc, a); }
