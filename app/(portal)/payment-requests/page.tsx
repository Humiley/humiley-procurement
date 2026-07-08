import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §10a register + the accountant's daily payment run (approved-not-paid, by due date). */
export default async function PaymentRequestsPage() {
  const user = await requireUser();
  const t = await getTranslations("payreq");
  const st = await getTranslations("status");
  const seeAll = hasAnyRole(user, ["ACCOUNTANT", "ADMIN", "DIRECTOR", "PURCHASER"]);

  const preqs = await db.paymentRequest.findMany({
    where: seeAll ? {} : { requesterId: user.id },
    orderBy: { createdAt: "desc" },
    include: { requester: { select: { name: true } }, vendor: { select: { code: true } } },
  });
  const toPay = preqs
    .filter((q) => q.status === "APPROVED")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">{t("listTitle")}</h1>
        <Link href="/payment-requests/new" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
          {t("newButton")}
        </Link>
      </div>

      {seeAll && toPay.length > 0 ? (
        <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-3">
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald">{t("paymentRun")}</h2>
          <ul className="space-y-1">
            {toPay.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/payment-requests/${q.id}`} className="font-mono text-xs font-bold text-navy hover:underline">{q.paymentRequestNumber}</Link>
                <span className="min-w-0 flex-1 truncate">{q.payeeName}</span>
                <span className="text-xs text-grey">{q.dueDate ? formatVnDate(q.dueDate) : "—"}</span>
                <b className="text-navy">{decToString(q.amount, 0)} ₫</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preqs.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("colType")}</th>
                <th className="px-3 py-2.5">{t("colPayee")}</th>
                <th className="px-3 py-2.5">{t("colRequester")}</th>
                <th className="px-3 py-2.5">{t("dueDate")}</th>
                <th className="px-3 py-2.5 text-right">{t("amount")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {preqs.map((q) => (
                <tr key={q.id} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                    <Link href={`/payment-requests/${q.id}`} className="hover:underline">{q.paymentRequestNumber}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{t(`type.${q.type}`)}</td>
                  <td className="max-w-[200px] truncate px-3 py-2.5">{q.payeeName}{q.vendor ? <span className="text-xs text-grey"> · {q.vendor.code}</span> : null}</td>
                  <td className="px-3 py-2.5">{q.requester.name}</td>
                  <td className="px-3 py-2.5">{q.dueDate ? formatVnDate(q.dueDate) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-navy">{decToString(q.amount, 0)} ₫</td>
                  <td className="px-3 py-2.5"><StatusBadge status={q.status} label={st.has(q.status) ? st(q.status) : q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
