import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { v1List } from "../lib";

export const GET = v1List("payment-requests", ({ take, skip }) =>
  db.paymentRequest
    .findMany({ take, skip, orderBy: { createdAt: "desc" }, include: { requester: { select: { name: true } }, vendor: { select: { code: true } } } })
    .then((rows) =>
      rows.map((r) => ({
        id: r.id, number: r.paymentRequestNumber, type: r.type, status: r.status,
        requester: r.requester.name, vendorCode: r.vendor?.code ?? null, payeeName: r.payeeName,
        amount: decToString(r.amount, 2), dueDate: r.dueDate, paidDate: r.paidDate,
        paymentRef: r.paymentRef, exportBatchId: r.exportBatchId,
      })),
    ),
);
