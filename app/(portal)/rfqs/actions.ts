"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { ymdVn } from "@/lib/dates";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { sendMailRaw } from "@/lib/notify";
import { rfqCreateSchema, quoteEntrySchema, type RfqFormPayload, type QuoteEntryPayload } from "@/lib/schemas/rfq";

/** §8 3-quote policy: amounts above this need ≥3 invited vendors (override = justified Exception). */
const THREE_QUOTE_THRESHOLD_VND = 100_000_000;

/** Create an RFQ — from an APPROVED PR (lines copied) or standalone. PURCHASER/ADMIN. */
export async function createRfq(input: RfqFormPayload) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const values = rfqCreateSchema.parse(input);

  const vendors = await db.vendor.findMany({ where: { id: { in: values.vendorIds }, status: "APPROVED" } });
  if (vendors.length !== values.vendorIds.length) {
    throw new Error("Every invited vendor must exist and be APPROVED.");
  }
  if (values.prId) {
    const pr = await db.purchaseRequisition.findUnique({ where: { id: values.prId } });
    if (!pr || pr.status !== "APPROVED") throw new Error("Only an APPROVED requisition can source an RFQ.");
  }

  const rfq = await db.$transaction(async (tx) => {
    const rfqNumber = await nextDocNumber("RFQ", tx, { prefix: "RFQ" });
    return tx.rfq.create({
      data: {
        rfqNumber,
        title: values.title,
        prId: values.prId || null,
        dueDate: new Date(values.dueDate + "T23:59:59"),
        status: "DRAFT",
        createdById: user.id,
        lines: {
          create: values.lines.map((l) => ({
            itemId: l.itemId || null,
            description: l.description,
            qty: new Prisma.Decimal(l.qty),
            uomId: l.uomId || null,
          })),
        },
        vendors: { create: values.vendorIds.map((vendorId) => ({ vendorId })) },
      },
    });
  });

  await audit({ userId: user.id, action: "RFQ_CREATE", entityType: "Rfq", entityId: rfq.id, after: { rfqNumber: rfq.rfqNumber, vendors: vendors.map((v) => v.code) } });
  revalidatePath("/rfqs");
  return { id: rfq.id };
}

/**
 * DRAFT → SENT: emails the RFQ PDF to every invited vendor and stamps sentAt.
 * §8 3-quote rule: >100M estimate with <3 vendors requires a justification → Exception SINGLE_SOURCE.
 */
export async function sendRfq(id: string, justification?: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const rfq = await db.rfq.findUnique({
    where: { id },
    include: { vendors: { include: { vendor: true } }, pr: { select: { totalEstimatedVnd: true } }, lines: true },
  });
  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status !== "DRAFT") throw new Error("Only a draft RFQ can be sent.");
  if (rfq.lines.length === 0) throw new Error("Add at least one line before sending.");

  const estimate = Number(rfq.pr?.totalEstimatedVnd ?? 0);
  if (estimate > THREE_QUOTE_THRESHOLD_VND && rfq.vendors.length < 3) {
    if (!(justification || "").trim()) {
      throw new Error("Amounts above 100,000,000 ₫ need at least 3 vendors — or provide a justification to override.");
    }
    await db.exception.create({
      data: {
        type: "SINGLE_SOURCE",
        entityType: "Rfq",
        entityId: rfq.id,
        justification: justification!.trim(),
        approvedById: user.id,
      },
    });
  }

  if (!(await transition(db.rfq, id, "DRAFT", "SENT"))) throw staleError();

  // email each vendor its PDF (dev transport logs when SMTP is unset)
  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { rfqPdfData } = await import("@/lib/pdf/rfq-data");
    const { RfqPdf } = await import("@/lib/pdf/RfqPdf");
    for (const rv of rfq.vendors) {
      if (!rv.vendor.contactEmail) continue;
      const data = await rfqPdfData(rfq.id, rv.vendorId);
      if (!data) continue;
      const buf = await renderToBuffer(React.createElement(RfqPdf, { d: data }) as never);
      await sendMailRaw({
        to: rv.vendor.contactEmail,
        cc: user.email,
        subject: `Request for Quotation ${rfq.rfqNumber} — Humiley Engineering & Solutions`,
        text:
          `Dear ${rv.vendor.contactName || rv.vendor.nameEn},\n\n` +
          `Please find attached our request for quotation ${rfq.rfqNumber} ("${rfq.title}").\n` +
          `Kindly return your best offer by ${ymdVn(rfq.dueDate)}.\n\n` +
          `Best regards,\nHumiley Procurement`,
        attachments: [{ filename: `${rfq.rfqNumber}.pdf`, content: buf }],
      });
    }
  } catch (e) {
    console.warn("RFQ send email failed:", e instanceof Error ? e.message : e);
  }
  await db.rfqVendor.updateMany({ where: { rfqId: id }, data: { sentAt: new Date() } });

  await audit({ userId: user.id, action: "RFQ_SEND", entityType: "Rfq", entityId: id, after: { vendors: rfq.vendors.length, estimate } });
  revalidatePath(`/rfqs/${id}`);
  revalidatePath("/rfqs");
  return { id };
}

/** Record a vendor's quote (re-entering replaces the previous one). Marks the vendor responded. */
export async function enterQuote(input: QuoteEntryPayload) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const values = quoteEntrySchema.parse(input);

  const rfq = await db.rfq.findUnique({ where: { id: values.rfqId }, include: { lines: true, vendors: true } });
  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status !== "SENT") throw new Error("Quotes can only be entered on a SENT RFQ.");
  if (!rfq.vendors.some((v) => v.vendorId === values.vendorId)) throw new Error("That vendor was not invited.");
  const lineById = new Map(rfq.lines.map((l) => [l.id, l]));
  for (const l of values.lines) if (!lineById.has(l.rfqLineId)) throw new Error("Quote line does not match the RFQ.");

  const total = values.lines
    .reduce((s, l) => s.plus(new Prisma.Decimal(l.unitPrice).times(lineById.get(l.rfqLineId)!.qty)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);

  const quote = await db.$transaction(async (tx) => {
    await tx.quote.deleteMany({ where: { rfqId: values.rfqId, vendorId: values.vendorId } });
    const q = await tx.quote.create({
      data: {
        rfqId: values.rfqId,
        vendorId: values.vendorId,
        quoteRef: values.quoteRef || null,
        validUntil: values.validUntil ? new Date(values.validUntil + "T23:59:59") : null,
        leadTimeDays: values.leadTimeDays ?? null,
        paymentTerms: values.paymentTerms || null,
        totalVnd: total,
        lines: {
          create: values.lines.map((l) => ({
            rfqLineId: l.rfqLineId,
            unitPrice: new Prisma.Decimal(l.unitPrice),
            qty: lineById.get(l.rfqLineId)!.qty,
            amount: new Prisma.Decimal(l.unitPrice).times(lineById.get(l.rfqLineId)!.qty).toDecimalPlaces(2),
          })),
        },
      },
    });
    await tx.rfqVendor.updateMany({ where: { rfqId: values.rfqId, vendorId: values.vendorId }, data: { respondedAt: new Date() } });
    return q;
  });

  await audit({ userId: user.id, action: "RFQ_QUOTE_ENTER", entityType: "Rfq", entityId: values.rfqId, after: { vendorId: values.vendorId, total: String(total) } });
  revalidatePath(`/rfqs/${values.rfqId}`);
  return { id: quote.id };
}

/**
 * §8 whole-quote award: not-lowest needs a justification → Exception NON_LOWEST_AWARD.
 * Creates the PO prefilled from the winning quote (links PO.quoteId; consumes the source PR
 * when it is still APPROVED) and closes the RFQ as AWARDED.
 */
export async function awardQuote(params: { rfqId: string; quoteId: string; justification?: string }) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const rfq = await db.rfq.findUnique({
    where: { id: params.rfqId },
    include: {
      pr: { select: { id: true, status: true } },
      quotes: { include: { lines: { include: { rfqLine: true } }, vendor: true } },
    },
  });
  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status !== "SENT") throw new Error("Only a SENT RFQ can be awarded.");
  const winner = rfq.quotes.find((q) => q.id === params.quoteId);
  if (!winner) throw new Error("Quote not found on this RFQ.");
  if (winner.lines.length === 0) throw new Error("The winning quote has no lines.");

  const lowest = rfq.quotes.reduce((m, q) => (q.totalVnd.lessThan(m.totalVnd) ? q : m), rfq.quotes[0]);
  if (!winner.totalVnd.equals(lowest.totalVnd)) {
    if (!(params.justification || "").trim()) {
      throw new Error("This is not the lowest quote — a short justification is required to award it.");
    }
    await db.exception.create({
      data: {
        type: "NON_LOWEST_AWARD",
        entityType: "Rfq",
        entityId: rfq.id,
        justification: params.justification!.trim(),
        approvedById: user.id,
      },
    });
  }

  // Build the PO from the winning quote (§8: auto-fill vendor + prices).
  const fallbackUom = await db.uom.findFirst({ orderBy: { code: "asc" }, select: { id: true } });
  const { createPo } = await import("@/app/(portal)/purchase-orders/actions");
  const po = await createPo({
    vendorId: winner.vendorId,
    prId: rfq.pr && rfq.pr.status === "APPROVED" ? rfq.pr.id : null,
    quoteId: winner.id,
    currency: winner.currency,
    fxRate: String(winner.fxRate),
    paymentTerms: winner.paymentTerms || null,
    vatPct: "10",
    lines: winner.lines.map((l) => ({
      itemId: l.rfqLine.itemId,
      description: l.rfqLine.description,
      uomId: l.rfqLine.uomId || fallbackUom?.id || "",
      qty: String(l.qty),
      unitPrice: String(l.unitPrice),
    })),
  });

  await db.quote.update({ where: { id: winner.id }, data: { isSelected: true } });
  if (!(await transition(db.rfq, rfq.id, "SENT", "AWARDED"))) throw staleError();

  await audit({
    userId: user.id,
    action: "RFQ_AWARD",
    entityType: "Rfq",
    entityId: rfq.id,
    after: { quoteId: winner.id, vendor: winner.vendor.code, total: String(winner.totalVnd), lowest: winner.totalVnd.equals(lowest.totalVnd), poId: po.id },
  });
  revalidatePath(`/rfqs/${rfq.id}`);
  revalidatePath("/rfqs");
  revalidatePath("/purchase-orders");
  return { poId: po.id };
}

export async function closeRfq(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const rfq = await db.rfq.findUnique({ where: { id } });
  if (!rfq) throw new Error("RFQ not found.");
  if (!["DRAFT", "SENT"].includes(rfq.status)) throw new Error("This RFQ can no longer be closed.");
  if (!(await transition(db.rfq, id, rfq.status, "CLOSED"))) throw staleError();
  await audit({ userId: user.id, action: "RFQ_CLOSE", entityType: "Rfq", entityId: id, before: { status: rfq.status }, after: { status: "CLOSED" } });
  revalidatePath(`/rfqs/${id}`);
  revalidatePath("/rfqs");
}
