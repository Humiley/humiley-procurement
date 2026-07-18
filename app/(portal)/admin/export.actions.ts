"use server";

import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { decToString } from "@/lib/money";
import { ymdVn, ymdHmVn } from "@/lib/dates";
import { guard } from "@/lib/safe-action";

/**
 * §17 accounting export — MATCHED invoices / PAID payment requests as CSV batches for
 * MISA/Bravo import. Rows are stamped with the batch id so a second run cannot double-export.
 */
const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection: a cell starting with = + - @ (or tab/CR) is executed
  // as a formula by Excel/Sheets on open. Prefix an apostrophe so it's treated as literal text.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header: string[], rows: (string | number)[][]) =>
  [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

async function _exportAccountingBatch(kind: "INVOICES" | "PAYMENT_REQUESTS") {
  const user = await requireRoles("ACCOUNTANT", "ADMIN");

  if (kind === "INVOICES") {
    const rows = await db.invoice.findMany({
      where: { matchStatus: "MATCHED", exportBatchId: null },
      orderBy: { invoiceDate: "asc" },
      include: { vendor: { select: { code: true, nameEn: true, taxCode: true } }, po: { select: { poNumber: true } } },
    });
    if (!rows.length) throw new Error("Nothing to export — every matched invoice is already in a batch.");
    const batch = await db.$transaction(async (tx) => {
      const batchNumber = await nextDocNumber("EXP", tx, { prefix: "EXP" });
      const b = await tx.exportBatch.create({ data: { batchNumber, kind, rowCount: rows.length, createdById: user.id } });
      const stamped = await tx.invoice.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, exportBatchId: null },
        data: { exportBatchId: b.id },
      });
      if (stamped.count !== rows.length) throw new Error("Some rows were just exported by another batch — reload and retry.");
      return b;
    });
    const csv = toCsv(
      ["batch", "invoice_no", "vendor_invoice_no", "invoice_date", "due_date", "vendor_code", "vendor_name", "vendor_tax_code", "po_no", "subtotal_vnd", "vat_vnd", "total_vnd", "payment_status"],
      rows.map((i) => [
        batch.batchNumber, i.invoiceNumber, i.vendorInvoiceNo, ymdVn(i.invoiceDate), ymdVn(i.dueDate),
        i.vendor.code, i.vendor.nameEn, i.vendor.taxCode ?? "", i.po.poNumber,
        decToString(i.subtotal, 2) ?? "0", decToString(i.vatAmount, 2) ?? "0", decToString(i.total, 2) ?? "0", i.paymentStatus,
      ]),
    );
    await audit({ userId: user.id, action: "EXPORT_BATCH", entityType: "ExportBatch", entityId: batch.id, after: { kind, rows: rows.length, batchNumber: batch.batchNumber } });
    return { batchNumber: batch.batchNumber, rowCount: rows.length, csv };
  }

  const rows = await db.paymentRequest.findMany({
    where: { status: "PAID", exportBatchId: null },
    orderBy: { paidDate: "asc" },
    include: { requester: { select: { name: true } }, costCenter: { select: { code: true } }, vendor: { select: { code: true } } },
  });
  if (!rows.length) throw new Error("Nothing to export — every paid payment request is already in a batch.");
  const batch = await db.$transaction(async (tx) => {
    const batchNumber = await nextDocNumber("EXP", tx, { prefix: "EXP" });
    const b = await tx.exportBatch.create({ data: { batchNumber, kind, rowCount: rows.length, createdById: user.id } });
    const stamped = await tx.paymentRequest.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, exportBatchId: null },
      data: { exportBatchId: b.id },
    });
    if (stamped.count !== rows.length) throw new Error("Some rows were just exported by another batch — reload and retry.");
    return b;
  });
  const csv = toCsv(
    ["batch", "payment_no", "type", "paid_date", "payment_ref", "payee", "vendor_code", "cost_center", "requester", "amount_vnd"],
    rows.map((r) => [
      batch.batchNumber, r.paymentRequestNumber, r.type, r.paidDate ? ymdVn(r.paidDate) : "", r.paymentRef ?? "",
      r.payeeName, r.vendor?.code ?? "", r.costCenter.code, r.requester.name, decToString(r.amount, 2) ?? "0",
    ]),
  );
  await audit({ userId: user.id, action: "EXPORT_BATCH", entityType: "ExportBatch", entityId: batch.id, after: { kind, rows: rows.length, batchNumber: batch.batchNumber } });
  return { batchNumber: batch.batchNumber, rowCount: rows.length, csv };
}

async function _pendingExportCounts() {
  await requireRoles("ACCOUNTANT", "ADMIN");
  const [invoices, payments, batches] = await Promise.all([
    db.invoice.count({ where: { matchStatus: "MATCHED", exportBatchId: null } }),
    db.paymentRequest.count({ where: { status: "PAID", exportBatchId: null } }),
    db.exportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { createdBy: { select: { name: true } } } }),
  ]);
  return {
    invoices,
    payments,
    batches: batches.map((b) => ({ batchNumber: b.batchNumber, kind: b.kind, rowCount: b.rowCount, by: b.createdBy.name, at: ymdHmVn(b.createdAt) })),
  };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function exportAccountingBatch(...a: Parameters<typeof _exportAccountingBatch>) { return guard(_exportAccountingBatch, a); }
export async function pendingExportCounts(...a: Parameters<typeof _pendingExportCounts>) { return guard(_pendingExportCounts, a); }
