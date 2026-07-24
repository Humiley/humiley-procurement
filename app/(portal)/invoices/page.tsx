import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { decToString } from "@/lib/money";
import { formatVnDate, daysBetween } from "@/lib/dates";
import { InvoiceList, type InvoiceRow } from "@/components/invoice/InvoiceList";

/** §9 invoice register with the aging buckets (0–30 / 31–60 / 61–90 / 90+) for unpaid invoices. */
export default async function InvoicesPage() {
  const user = await requireUser();
  const t = await getTranslations("invoice");
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

  const rows: InvoiceRow[] = invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    vendorInvoiceNo: i.vendorInvoiceNo,
    vendorCode: i.vendor.code,
    poNumber: i.po.poNumber,
    dueDate: formatVnDate(i.dueDate),
    total: decToString(i.total, 0) ?? "0",
    matchStatus: i.matchStatus,
    paymentStatus: i.paymentStatus,
    aging: bucket(i.dueDate, i.paymentStatus) ?? "—",
  }));

  return (
    <div className="space-y-4">
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

      <InvoiceList rows={rows} canCreate={canCreate} />
    </div>
  );
}
