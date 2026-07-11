import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { decToString } from "@/lib/money";
import { formatVnDate, daysBetween } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §9 invoice register with the aging buckets (0–30 / 31–60 / 61–90 / 90+) for unpaid invoices. */
export default async function InvoicesPage() {
  const user = await requireUser();
  const t = await getTranslations("invoice");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["ACCOUNTANT", "ADMIN"]);

  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { code: true } }, po: { select: { poNumber: true } } },
  });

  const now = new Date();
  const bucket = (due: Date, paid: string) => {
    if (paid === "PAID") return null;
    const overdue = daysBetween(due, now);
    if (overdue <= 0) return t("agingCurrent");
    if (overdue <= 30) return "0–30";
    if (overdue <= 60) return "31–60";
    if (overdue <= 90) return "61–90";
    return "90+";
  };
  const agingTotals = new Map<string, number>();
  for (const i of invoices) {
    const b = bucket(i.dueDate, i.paymentStatus);
    if (b && b !== t("agingCurrent")) agingTotals.set(b, (agingTotals.get(b) ?? 0) + Number(i.total));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/invoices/new" className="btn-primary">
            {t("newButton")}
          </Link>
        ) : null}
      </div>

      <HowItWorks guide="invoices" />

      {agingTotals.size > 0 ? (
        <div className="flex flex-wrap gap-2">
          {["0–30", "31–60", "61–90", "90+"].map((b) =>
            agingTotals.has(b) ? (
              <span key={b} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${b === "90+" || b === "61–90" ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning"}`}>
                {t("agingOverdue")} {b}: {agingTotals.get(b)!.toLocaleString("en-US")} ₫
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      {invoices.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="th">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("vendorInvoiceNo")}</th>
                <th className="px-3 py-2.5">{t("po")}</th>
                <th className="px-3 py-2.5">{t("colDue")}</th>
                <th className="px-3 py-2.5 text-right">{t("colTotal")}</th>
                <th className="px-3 py-2.5">{t("colMatch")}</th>
                <th className="px-3 py-2.5">{t("colPayment")}</th>
                <th className="px-3 py-2.5">{t("colAging")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const b = bucket(i.dueDate, i.paymentStatus);
                return (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                    <td className="px-3 py-2.5 text-sm font-semibold text-navy tabular-nums whitespace-nowrap">
                      <Link href={`/invoices/${i.id}`} className="hover:underline">{i.invoiceNumber}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{i.vendorInvoiceNo} <span className="text-grey">· {i.vendor.code}</span></td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{i.po.poNumber}</td>
                    <td className="px-3 py-2.5">{formatVnDate(i.dueDate)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-navy">{Number(decToString(i.total, 0)).toLocaleString("en-US")} ₫</td>
                    <td className="px-3 py-2.5"><StatusBadge status={i.matchStatus} label={st.has(i.matchStatus) ? st(i.matchStatus) : i.matchStatus} /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={i.paymentStatus} label={st.has(i.paymentStatus) ? st(i.paymentStatus) : i.paymentStatus} /></td>
                    <td className="px-3 py-2.5 text-xs">{b ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
