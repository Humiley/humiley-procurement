import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PayReqForm, type PayReqInvoice, type PayReqOpt } from "@/components/payreq/PayReqForm";

/** §10a: new payment request — sources depend on the chosen type. */
export default async function NewPaymentRequestPage() {
  const user = await requireUser();
  const tc = await getTranslations("common");
  const canVendorPayment = hasAnyRole(user, ["ACCOUNTANT", "PURCHASER", "ADMIN"]);

  const [costCenters, vendors, invoices, openPos, myAdvances, carried] = await Promise.all([
    db.costCenter.findMany({ orderBy: { code: "asc" } }),
    db.vendor.findMany({ where: { status: "APPROVED" }, orderBy: { code: "asc" } }),
    canVendorPayment
      ? db.invoice.findMany({
          where: { matchStatus: "MATCHED", paymentStatus: { not: "PAID" } },
          include: { po: { select: { poNumber: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    db.purchaseOrder.findMany({ where: { status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } }, orderBy: { createdAt: "desc" }, select: { id: true, poNumber: true } }),
    db.paymentRequest.findMany({ where: { requesterId: user.id, type: "ADVANCE", status: "PAID" }, select: { id: true, paymentRequestNumber: true, amount: true, settlements: { where: { status: { in: ["SUBMITTED", "APPROVED", "PAID"] } }, select: { id: true } } } }),
    db.paymentRequestLine.findMany({ where: { invoiceId: { not: null }, paymentRequest: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }, select: { invoiceId: true } }),
  ]);
  const carriedIds = new Set(carried.map((c) => c.invoiceId));

  return (
    <div className="space-y-4">
      <Link href="/payment-requests" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <PayReqForm
      canVendorPayment={canVendorPayment}
      costCenters={costCenters.map((c): PayReqOpt => ({ id: c.id, label: `${c.code} · ${c.nameEn}` }))}
      vendors={vendors.map((v): PayReqOpt => ({ id: v.id, label: `${v.code} · ${v.nameEn}` }))}
      invoices={invoices
        .filter((i) => !carriedIds.has(i.id))
        .map((i): PayReqInvoice => ({ id: i.id, vendorId: i.vendorId, label: `${i.invoiceNumber} · ${i.vendorInvoiceNo} · ${i.po.poNumber}`, amount: Number(i.total) }))}
      openPos={openPos.map((p): PayReqOpt => ({ id: p.id, label: p.poNumber }))}
      myPaidAdvances={myAdvances
        .filter((a) => a.settlements.length === 0)
        .map((a): PayReqOpt => ({ id: a.id, label: `${a.paymentRequestNumber} · ${Number(a.amount).toLocaleString("en-US")} ₫` }))}
      />
    </div>
  );
}
