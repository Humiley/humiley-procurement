import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { v1List } from "../lib";

export const GET = v1List("purchase-orders", ({ take, skip }) =>
  db.purchaseOrder
    .findMany({ take, skip, orderBy: { createdAt: "desc" }, include: { vendor: { select: { code: true } }, lines: true } })
    .then((rows) =>
      rows.map((p) => ({
        id: p.id, poNumber: p.poNumber, vendorCode: p.vendor.code, status: p.status,
        currency: p.currency, subtotal: decToString(p.subtotal, 2), vatAmount: decToString(p.vatAmount, 2),
        total: decToString(p.total, 2), expectedDate: p.expectedDate, createdAt: p.createdAt,
        lines: p.lines.map((l) => ({ id: l.id, description: l.description, qty: decToString(l.qty, 4), unitPrice: decToString(l.unitPrice, 2), amount: decToString(l.amount, 2), receivedQty: decToString(l.receivedQty, 4), invoicedQty: decToString(l.invoicedQty, 4) })),
      })),
    ),
);
