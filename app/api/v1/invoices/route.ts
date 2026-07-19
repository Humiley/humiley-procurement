import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { v1List } from "../lib";

export const GET = v1List("invoices", ({ take, skip }) =>
  db.invoice
    .findMany({ take, skip, orderBy: { createdAt: "desc" }, include: { vendor: { select: { code: true } }, po: { select: { poNumber: true } } } })
    .then((rows) =>
      rows.map((i) => ({
        id: i.id, invoiceNumber: i.invoiceNumber, vendorInvoiceNo: i.vendorInvoiceNo,
        vendorCode: i.vendor.code, poNumber: i.po.poNumber, invoiceDate: i.invoiceDate,
        dueDate: i.dueDate, subtotal: decToString(i.subtotal, 2), vatAmount: decToString(i.vatAmount, 2),
        total: decToString(i.total, 2), matchStatus: i.matchStatus, paymentStatus: i.paymentStatus,
        paidDate: i.paidDate, exportBatchId: i.exportBatchId,
      })),
    ),
);
