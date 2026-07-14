"use server";

import { revalidatePath } from "next/cache";
import { staleError } from "@/lib/workflow/transition";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { invoiceCreateSchema, type InvoiceCreatePayload } from "@/lib/schemas/grn";
import { guard } from "@/lib/safe-action";

const D = Prisma.Decimal;

/** §9 3-way match tolerances: qty 0%, price 2%. */
const PRICE_TOLERANCE = 0.02;

export type MatchLine = {
  poLineId: string;
  description: string;
  poPrice: string;
  invPrice: string;
  priceDiffPct: string;
  invQty: string;
  matchableQty: string; // GRN accepted − already invoiced
  qtyOk: boolean;
  priceOk: boolean;
  ok: boolean;
};

/** Compare invoice lines against PO price and GRN-accepted quantities. */
async function _computeMatch(invoiceId: string): Promise<{ lines: MatchLine[]; matched: boolean }> {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { include: { poLine: true } } },
  });
  if (!inv) throw new Error("Invoice not found.");
  const others = await db.invoiceLine.findMany({
    where: { poLineId: { in: inv.lines.map((l) => l.poLineId) }, invoiceId: { not: inv.id } },
  });
  const invoicedElsewhere = new Map<string, Prisma.Decimal>();
  for (const o of others) {
    invoicedElsewhere.set(o.poLineId, (invoicedElsewhere.get(o.poLineId) ?? new D(0)).plus(o.qty));
  }
  const lines: MatchLine[] = inv.lines.map((l) => {
    const matchable = new D(l.poLine.receivedQty).minus(invoicedElsewhere.get(l.poLineId) ?? 0);
    const qtyOk = new D(l.qty).greaterThan(0) && new D(l.qty).lessThanOrEqualTo(matchable);
    const diff = new D(l.unitPrice).minus(l.poLine.unitPrice).abs();
    const tol = new D(l.poLine.unitPrice).times(PRICE_TOLERANCE);
    const priceOk = diff.lessThanOrEqualTo(tol);
    const diffPct = new D(l.poLine.unitPrice).isZero() ? new D(0) : diff.div(l.poLine.unitPrice).times(100);
    return {
      poLineId: l.poLineId,
      description: l.poLine.description,
      poPrice: l.poLine.unitPrice.toFixed(0),
      invPrice: l.unitPrice.toFixed(0),
      priceDiffPct: diffPct.toFixed(1),
      invQty: l.qty.toFixed(0),
      matchableQty: matchable.toFixed(0),
      qtyOk,
      priceOk,
      ok: qtyOk && priceOk,
    };
  });
  return { lines, matched: lines.every((l) => l.ok) };
}

/** §9: enter a vendor invoice against a PO (ACCOUNTANT). Due date from the vendor's payment terms. */
async function _createInvoice(input: InvoiceCreatePayload) {
  const user = await requireRoles("ACCOUNTANT", "ADMIN");
  const values = invoiceCreateSchema.parse(input);

  const po = await db.purchaseOrder.findUnique({ where: { id: values.poId }, include: { lines: true, vendor: true } });
  if (!po) throw new Error("Purchase order not found.");
  // §15 SoD: whoever posted a goods receipt on this PO cannot enter its invoice (ADMIN excepted).
  if (!user.roles.includes("ADMIN")) {
    const postedGrn = await db.goodsReceipt.count({ where: { poId: po.id, receivedById: user.id } });
    if (postedGrn > 0) {
      throw new Error("Segregation of duties: the goods-receipt poster cannot enter this PO's invoice (§15).");
    }
  }
  if (!["SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"].includes(po.status)) {
    throw new Error("Invoices can only be entered against a sent or received PO.");
  }
  const lineById = new Map(po.lines.map((l) => [l.id, l]));
  const entering = values.lines.filter((l) => Number(l.qty) > 0);
  for (const l of entering) if (!lineById.has(l.poLineId)) throw new Error("Line does not belong to this PO.");

  const subtotal = entering.reduce((s, l) => s.plus(new D(l.qty).times(l.unitPrice)), new D(0)).toDecimalPlaces(2);
  const vatAmount = subtotal.times(po.vatPct).div(100).toDecimalPlaces(2);
  const invoiceDate = new Date(values.invoiceDate + "T00:00:00");
  const dueDate = new Date(invoiceDate.getTime() + po.vendor.paymentTermDays * 24 * 3600 * 1000);

  const inv = await db.$transaction(async (tx) => {
    const invoiceNumber = await nextDocNumber("INV", tx, { prefix: "INV" });
    return tx.invoice.create({
      data: {
        invoiceNumber,
        vendorInvoiceNo: values.vendorInvoiceNo,
        vendorId: po.vendorId,
        poId: po.id,
        invoiceDate,
        dueDate,
        currency: po.currency,
        fxRate: po.fxRate,
        subtotal,
        vatAmount,
        total: subtotal.plus(vatAmount),
        lines: {
          create: entering.map((l) => ({
            poLineId: l.poLineId,
            qty: new D(l.qty),
            unitPrice: new D(l.unitPrice),
            amount: new D(l.qty).times(l.unitPrice).toDecimalPlaces(2),
          })),
        },
      },
    });
  });

  // first-pass match result stored for the register badge
  const match = await _computeMatch(inv.id);
  await db.invoice.update({ where: { id: inv.id }, data: { matchStatus: match.matched ? "MATCHED" : "MISMATCH" } });

  await audit({ userId: user.id, action: "INVOICE_CREATE", entityType: "Invoice", entityId: inv.id, after: { invoiceNumber: inv.invoiceNumber, po: po.poNumber, total: String(subtotal.plus(vatAmount)), matched: match.matched } });
  revalidatePath("/invoices");
  return { id: inv.id };
}

/**
 * §9 + §19: verify the 3-way match with an electronic signature (meaning VERIFIED).
 * A MISMATCH requires an override comment → Exception TOLERANCE_OVERRIDE.
 * On verify the invoiced quantities post to the PO lines and the budget moves commit → spent.
 */
async function _verifyInvoice(params: { invoiceId: string; password: string; overrideComment?: string; imageData?: string | null }) {
  const user = await requireRoles("ACCOUNTANT", "ADMIN");
  const inv = await db.invoice.findUnique({
    where: { id: params.invoiceId },
    include: { lines: { include: { poLine: true } }, po: { select: { poNumber: true } } },
  });
  if (!inv) throw new Error("Invoice not found.");
  const already = await db.electronicSignature.findFirst({ where: { entityType: "Invoice", entityId: inv.id, meaning: "VERIFIED" } });
  if (already) throw new Error("This invoice is already verified.");

  const match = await _computeMatch(inv.id);
  if (!match.matched && !(params.overrideComment || "").trim()) {
    throw new Error("The 3-way match has mismatches — an override comment is required to verify anyway.");
  }

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "Invoice",
      entityId: inv.id,
      meaning: "VERIFIED",
      reason: params.overrideComment,
      imageData: params.imageData ?? null,
      record: { invoiceNumber: inv.invoiceNumber, vendorInvoiceNo: inv.vendorInvoiceNo, po: inv.po.poNumber, total: inv.total, match: match.lines },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  if (!match.matched) {
    await db.exception.create({
      data: {
        type: "TOLERANCE_OVERRIDE",
        entityType: "Invoice",
        entityId: inv.id,
        justification: params.overrideComment!.trim(),
        approvedById: user.id,
      },
    });
  }

  await db.$transaction(async (tx) => {
    // Atomic claim BEFORE any ledger mutation: only one verify can move the invoice off
    // UNMATCHED. A concurrent second verify (both passed the pre-check, both signed, both
    // reach here) finds count 0 and aborts — no double invoicedQty post, no double spend.
    const claimed = await tx.invoice.updateMany({
      where: { id: inv.id, matchStatus: "UNMATCHED" },
      data: { matchStatus: match.matched ? "MATCHED" : "MISMATCH" },
    });
    if (claimed.count === 0) throw staleError();
    for (const l of inv.lines) {
      await tx.poLine.update({
        where: { id: l.poLineId },
        data: { invoicedQty: { increment: new D(l.qty) } },
      });
    }
  });

  if (match.matched) {
    const { fireWebhook } = await import("@/lib/webhooks");
    await fireWebhook("invoice.matched", { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, total: String(inv.total) });
  }
  try {
    const { spendOnInvoice } = await import("@/lib/budget");
    await spendOnInvoice(inv.id);   // §9: matched invoice moves commitment → spent
  } catch (e) {
    console.warn("budget spend failed:", e);
  }

  await audit({ userId: user.id, action: "INVOICE_VERIFY", entityType: "Invoice", entityId: inv.id, after: { matched: match.matched, override: !match.matched, signatureId: sig.id } });
  revalidatePath(`/invoices/${inv.id}`);
  revalidatePath("/invoices");
  return { matched: match.matched };
}

/** §9 + §19: payment status — PAID / PARTIALLY_PAID with a signature (meaning PAID). */
async function _markInvoicePaid(params: { invoiceId: string; password: string; partial?: boolean; imageData?: string | null }) {
  const user = await requireRoles("ACCOUNTANT", "ADMIN");
  const inv = await db.invoice.findUnique({ where: { id: params.invoiceId }, include: { po: { select: { poNumber: true } } } });
  if (!inv) throw new Error("Invoice not found.");
  if (inv.paymentStatus === "PAID") throw new Error("This invoice is already paid.");
  const verified = await db.electronicSignature.findFirst({ where: { entityType: "Invoice", entityId: inv.id, meaning: "VERIFIED" } });
  if (!verified) throw new Error("Verify the 3-way match before recording a payment.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "Invoice",
      entityId: inv.id,
      meaning: "PAID",
      imageData: params.imageData ?? null,
      record: { invoiceNumber: inv.invoiceNumber, po: inv.po.poNumber, total: inv.total, partial: !!params.partial },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  await db.invoice.update({
    where: { id: inv.id },
    data: params.partial ? { paymentStatus: "PARTIALLY_PAID" } : { paymentStatus: "PAID", paidDate: new Date() },
  });

  await audit({ userId: user.id, action: params.partial ? "INVOICE_PART_PAID" : "INVOICE_PAID", entityType: "Invoice", entityId: inv.id, after: { signatureId: sig.id } });
  revalidatePath(`/invoices/${inv.id}`);
  revalidatePath("/invoices");
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function computeMatch(...a: Parameters<typeof _computeMatch>) { return guard(_computeMatch, a); }
export async function createInvoice(...a: Parameters<typeof _createInvoice>) { return guard(_createInvoice, a); }
export async function verifyInvoice(...a: Parameters<typeof _verifyInvoice>) { return guard(_verifyInvoice, a); }
export async function markInvoicePaid(...a: Parameters<typeof _markInvoicePaid>) { return guard(_markInvoicePaid, a); }
