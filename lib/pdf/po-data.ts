import "server-only";
import { db } from "@/lib/db";
import { decToString, formatQty } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import type { PoPdfData } from "./PoPdf";

/** Assemble the serializable PDF payload for one PO (Decimal → strings at this boundary). */
export async function poPdfData(poId: string): Promise<PoPdfData | null> {
  const po = await db.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      vendor: true,
      pr: { select: { prNumber: true } },
      lines: { include: { uom: { select: { code: true } }, item: { select: { code: true, nameEn: true } } } },
    },
  });
  if (!po) return null;
  const sigs = await db.electronicSignature.findMany({
    where: { entityType: "PurchaseOrder", entityId: po.id },
    orderBy: { signedAt: "asc" },
  });
  const money = (v: unknown) => `${Number(decToString(v as never, 2) ?? "0").toLocaleString("en-US", { maximumFractionDigits: 0 })} ₫`;
  return {
    poNumber: po.poNumber,
    createdAt: formatVnDate(po.createdAt),
    status: po.status,
    buyer: {
      name: "Humiley Engineering & Solutions Co., Ltd",
      address: "2nd Floor, 68 Nguyen Hue, Sai Gon Ward, Ho Chi Minh City, Vietnam",
    },
    vendor: {
      code: po.vendor.code,
      nameEn: po.vendor.nameEn,
      nameVn: po.vendor.nameVn,
      address: po.vendor.address,
      taxCode: po.vendor.taxCode,
      contact: [po.vendor.contactName, po.vendor.contactEmail].filter(Boolean).join(" · ") || null,
    },
    header: {
      currency: po.currency,
      fxRate: decToString(po.fxRate, 0) ?? "1",
      paymentTerms: po.paymentTerms,
      incoterm: po.incoterm,
      incotermPlace: po.incotermPlace,
      deliveryAddress: po.deliveryAddress,
      expectedDate: po.expectedDate ? formatVnDate(po.expectedDate) : null,
      warrantyTerms: po.warrantyTerms,
      prNumber: po.pr?.prNumber ?? null,
    },
    lines: po.lines.map((l, i) => ({
      no: i + 1,
      description: l.item ? `${l.item.code} · ${l.item.nameEn}` : l.description,
      uom: l.uom.code,
      qty: formatQty(l.qty),
      unitPrice: money(l.unitPrice),
      amount: money(l.amount),
    })),
    totals: {
      subtotal: money(po.subtotal),
      vatPct: decToString(po.vatPct, 0) ?? "10",
      vatAmount: money(po.vatAmount),
      total: money(po.total),
    },
    signatures: sigs.map((g) => ({
      name: g.fullNamePrinted,
      meaning: g.meaning,
      signedAt: formatVnDateTime(g.signedAt),
      reason: g.reason,
    })),
  };
}
