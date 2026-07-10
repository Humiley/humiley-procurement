import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InvoiceDetailActions } from "@/components/invoice/InvoiceDetailActions";
import { computeMatch } from "@/app/(portal)/invoices/actions";
import { act } from "@/lib/act";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("invoice");
  const st = await getTranslations("status");

  const inv = await db.invoice.findUnique({
    where: { id: params.id },
    include: {
      vendor: { select: { code: true, nameEn: true } },
      po: { select: { id: true, poNumber: true } },
      lines: { include: { poLine: { select: { description: true } } } },
    },
  });
  if (!inv) notFound();
  const canSee = hasAnyRole(user, ["ACCOUNTANT", "ADMIN", "PURCHASER", "DIRECTOR", "DEPT_MANAGER"]);
  if (!canSee) notFound();

  const [match, signatures] = await Promise.all([
    computeMatch(inv.id).then(act),
    db.electronicSignature.findMany({ where: { entityType: "Invoice", entityId: inv.id }, orderBy: { signedAt: "asc" } }),
  ]);
  const verified = signatures.some((s) => s.meaning === "VERIFIED");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/invoices" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="page-title font-mono">{inv.invoiceNumber}</h1>
        <StatusBadge status={inv.matchStatus} label={st.has(inv.matchStatus) ? st(inv.matchStatus) : inv.matchStatus} />
        <StatusBadge status={inv.paymentStatus} label={st.has(inv.paymentStatus) ? st(inv.paymentStatus) : inv.paymentStatus} />
        <span className="ml-auto text-xs text-grey">
          {inv.vendorInvoiceNo} · {inv.vendor.code} · {t("po")}: <Link className="font-mono text-navy hover:underline" href={`/purchase-orders/${inv.po.id}`}>{inv.po.poNumber}</Link>
          {" · "}{t("colDue")}: <b>{formatVnDate(inv.dueDate)}</b>
          {inv.paidDate ? <> · {t("paidOn")}: {formatVnDate(inv.paidDate)}</> : null}
        </span>
      </div>

      <div className="flex items-center justify-between card px-4 py-3">
        <span className="text-sm text-grey">
          {t("subtotal")}: <b className="text-body">{decToString(inv.subtotal, 0)}</b> · VAT: <b className="text-body">{decToString(inv.vatAmount, 0)}</b>
        </span>
        <span className="text-lg font-bold text-navy">{Number(decToString(inv.total, 0)).toLocaleString("en-US")} ₫</span>
      </div>

      {hasAnyRole(user, ["ACCOUNTANT", "ADMIN"]) ? (
        <InvoiceDetailActions
          invoiceId={inv.id}
          invoiceNumber={inv.invoiceNumber}
          matched={match.matched}
          verified={verified}
          paymentStatus={inv.paymentStatus}
        />
      ) : null}

      {/* §9 3-way match table */}
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="th">
              <th className="px-3 py-2.5">{t("lineDesc")}</th>
              <th className="px-3 py-2.5 text-right">{t("poPrice")}</th>
              <th className="px-3 py-2.5 text-right">{t("invPrice")}</th>
              <th className="px-3 py-2.5 text-right">{t("priceDiff")}</th>
              <th className="px-3 py-2.5 text-right">{t("matchableQty")}</th>
              <th className="px-3 py-2.5 text-right">{t("invQty")}</th>
              <th className="px-3 py-2.5">{t("matchResult")}</th>
            </tr>
          </thead>
          <tbody>
            {match.lines.map((l) => (
              <tr key={l.poLineId} className="border-b border-line last:border-0">
                <td className="max-w-[240px] truncate px-3 py-2.5" title={l.description}>{l.description}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{Number(l.poPrice).toLocaleString("en-US")}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${l.priceOk ? "" : "font-bold text-danger"}`}>{Number(l.invPrice).toLocaleString("en-US")}</td>
                <td className={`px-3 py-2.5 text-right ${l.priceOk ? "text-grey" : "font-bold text-danger"}`}>{l.priceDiffPct}%</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{Number(l.matchableQty).toLocaleString("en-US")}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${l.qtyOk ? "" : "font-bold text-danger"}`}>{Number(l.invQty).toLocaleString("en-US")}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${l.ok ? "bg-emerald/10 text-emerald" : "bg-danger/10 text-danger"}`}>
                    {l.ok ? t("matched") : t("mismatch")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {signatures.length > 0 ? (
        <div>
          <h3 className="label">{t("signatureBlock")}</h3>
          <ul className="space-y-1.5">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-navy">{s.fullNamePrinted}</span>
                <span className="mx-1.5 rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">{s.meaning}</span>
                <span className="text-grey">{formatVnDateTime(s.signedAt)}</span>
                {s.reason ? <span className="ml-1.5 text-grey">— {s.reason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
