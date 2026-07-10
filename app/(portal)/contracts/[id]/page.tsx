import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContractDetailActions } from "@/components/contracts/ContractDetailActions";

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("contracts");
  const st = await getTranslations("status");

  const c = await db.contract.findUnique({
    where: { id: params.id },
    include: {
      vendor: { select: { code: true, nameEn: true } },
      purchaseOrders: { select: { id: true, poNumber: true, status: true, total: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();

  const priceList = (c.priceListJson ?? {}) as Record<string, string>;
  const items = Object.keys(priceList).length
    ? await db.item.findMany({ where: { id: { in: Object.keys(priceList) } }, select: { id: true, code: true, nameEn: true, uom: { select: { code: true } } } })
    : [];
  const canAct = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/contracts" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="page-title font-mono">{c.contractNumber}</h1>
        <StatusBadge status={c.status} label={st.has(c.status) ? st(c.status) : c.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 card p-4 text-sm sm:grid-cols-4">
        <Field label={t("vendor")} value={`${c.vendor.code} · ${c.vendor.nameEn}`} />
        <Field label={t("validity")} value={`${formatVnDate(c.startDate)} → ${formatVnDate(c.endDate)}`} />
        <Field label={t("value")} value={`${Number(decToString(c.valueVnd, 0)).toLocaleString("en-US")} ₫`} />
        <Field label={t("alertDays")} value={String(c.renewalAlertDays)} />
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-xs uppercase tracking-wide text-grey">{t("title")}</dt>
          <dd className="mt-0.5">{c.title}</dd>
        </div>
      </div>

      {canAct ? <ContractDetailActions id={c.id} status={c.status} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="label">{t("priceList")}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-grey">{t("noPrices")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="py-2">{i.code} · {i.nameEn}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {Number(priceList[i.id]).toLocaleString("en-US")} ₫ <span className="text-xs font-normal text-grey">/ {i.uom.code}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card p-4">
          <h3 className="label">{t("linkedPos")}</h3>
          {c.purchaseOrders.length === 0 ? (
            <p className="text-sm text-grey">{t("noPos")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {c.purchaseOrders.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <Link href={`/purchase-orders/${p.id}`} className="font-mono text-xs font-bold text-navy hover:underline">{p.poNumber}</Link>
                  <span className="tabular-nums">{Number(decToString(p.total, 0)).toLocaleString("en-US")} ₫</span>
                  <StatusBadge status={p.status} label={st.has(p.status) ? st(p.status) : p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-grey">{label}</dt>
      <dd className="mt-0.5 text-body">{value}</dd>
    </div>
  );
}
