import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { PayReqList, type PayReqRow } from "@/components/payreq/PayReqList";

/** §10a register + the accountant's daily payment run (approved-not-paid, by due date). */
export default async function PaymentRequestsPage() {
  const user = await requireUser();
  const t = await getTranslations("payreq");
  const seeAll = hasAnyRole(user, ["ACCOUNTANT", "ADMIN", "DIRECTOR", "PURCHASER"]);
  // Visibility: staff see their own; a dept manager sees their department (+ own); Finance/PO/Director/Admin see all.
  const where: Prisma.PaymentRequestWhereInput = seeAll
    ? {}
    : hasAnyRole(user, ["DEPT_MANAGER"]) && user.departmentId
      ? { OR: [{ departmentId: user.departmentId }, { requesterId: user.id }] }
      : { requesterId: user.id };

  const preqs = await db.paymentRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { requester: { select: { name: true } }, vendor: { select: { code: true } } },
  });
  const toPay = preqs
    .filter((q) => q.status === "APPROVED")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  const rows: PayReqRow[] = preqs.map((q) => ({
    id: q.id,
    paymentRequestNumber: q.paymentRequestNumber,
    type: q.type,
    payeeName: q.payeeName,
    vendorCode: q.vendor?.code ?? "",
    requesterName: q.requester.name,
    dueDate: q.dueDate ? formatVnDate(q.dueDate) : "—",
    amount: decToString(q.amount, 0) ?? "0",
    status: q.status,
  }));

  return (
    <div className="space-y-4">
      <HowItWorks guide="payment-requests" />

      {seeAll && toPay.length > 0 ? (
        <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-3">
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald">{t("paymentRun")}</h2>
          <ul className="space-y-1">
            {toPay.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/payment-requests/${q.id}`} className="text-sm font-semibold text-navy tabular-nums whitespace-nowrap hover:underline">{q.paymentRequestNumber}</Link>
                <span className="min-w-0 flex-1 truncate">{q.payeeName}</span>
                <span className="text-xs text-grey">{q.dueDate ? formatVnDate(q.dueDate) : "—"}</span>
                <b className="text-navy tabular-nums">{Number(decToString(q.amount, 0)).toLocaleString("en-US")} ₫</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PayReqList rows={rows} />
    </div>
  );
}
