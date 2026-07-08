import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { PayReqPdf, type PayReqPdfData } from "@/lib/pdf/PayReqPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** §10a voucher PDF. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = await db.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { name: true } },
      department: { select: { code: true } },
      costCenter: { select: { code: true } },
      lines: true,
    },
  });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sigs = await db.electronicSignature.findMany({
    where: { entityType: "PaymentRequest", entityId: q.id },
    orderBy: { signedAt: "asc" },
  });
  const money = (v: unknown) => `${Number(decToString(v as never, 2) ?? "0").toLocaleString("en-US", { maximumFractionDigits: 0 })} ₫`;
  const d: PayReqPdfData = {
    number: q.paymentRequestNumber,
    createdAt: formatVnDate(q.createdAt),
    status: q.status,
    typeLabel:
      q.type === "VENDOR_PAYMENT" ? "Thanh toán nhà cung cấp" : q.type === "ADVANCE" ? "Tạm ứng" : q.type === "REIMBURSEMENT" ? "Hoàn phí" : "Hoàn ứng",
    requester: q.requester.name,
    department: q.department.code,
    costCenter: q.costCenter.code,
    payee: { name: q.payeeName, bankName: q.payeeBankName, bankAccount: q.payeeBankAccount, method: q.paymentMethod === "CASH" ? "Cash · Tiền mặt" : "Bank transfer · Chuyển khoản" },
    reason: q.reason || "—",
    dueDate: q.dueDate ? formatVnDate(q.dueDate) : null,
    lines: q.lines.map((l, i) => ({ no: i + 1, description: l.description, amount: money(l.amount) })),
    total: money(q.amount),
    signatures: sigs.map((g) => ({ name: g.fullNamePrinted, meaning: g.meaning, signedAt: formatVnDateTime(g.signedAt), reason: g.reason })),
  };
  const buf = await renderToBuffer(React.createElement(PayReqPdf, { d }) as never);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${d.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
