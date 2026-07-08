import "server-only";
import { db } from "@/lib/db";
import { formatQty } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import type { RfqPdfData } from "./RfqPdf";

/** Assemble the per-vendor RFQ PDF payload (serializable strings only). */
export async function rfqPdfData(rfqId: string, vendorId: string): Promise<RfqPdfData | null> {
  const rfq = await db.rfq.findUnique({ where: { id: rfqId }, include: { lines: true } });
  if (!rfq) return null;
  const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return null;
  const uomIds = rfq.lines.map((l) => l.uomId).filter((v): v is string => !!v);
  const itemIds = rfq.lines.map((l) => l.itemId).filter((v): v is string => !!v);
  const [uoms, items] = await Promise.all([
    uomIds.length ? db.uom.findMany({ where: { id: { in: uomIds } } }) : [],
    itemIds.length ? db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, nameEn: true } }) : [],
  ]);
  const uomById = new Map(uoms.map((u) => [u.id, u.code]));
  const itemById = new Map(items.map((it) => [it.id, it]));
  return {
    rfqNumber: rfq.rfqNumber,
    title: rfq.title,
    createdAt: formatVnDate(rfq.createdAt),
    dueDate: formatVnDate(rfq.dueDate),
    vendor: {
      nameEn: vendor.nameEn,
      nameVn: vendor.nameVn,
      contact: [vendor.contactName, vendor.contactEmail].filter(Boolean).join(" · ") || null,
    },
    buyer: {
      name: "Humiley Engineering & Solutions Co., Ltd",
      address: "2nd Floor, 68 Nguyen Hue, Sai Gon Ward, Ho Chi Minh City, Vietnam",
      email: "procurement@humiley.com",
    },
    lines: rfq.lines.map((l, i) => ({
      no: i + 1,
      description: l.itemId && itemById.get(l.itemId) ? `${itemById.get(l.itemId)!.code} · ${itemById.get(l.itemId)!.nameEn}` : l.description,
      uom: (l.uomId && uomById.get(l.uomId)) || "—",
      qty: formatQty(l.qty),
    })),
  };
}
