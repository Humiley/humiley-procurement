import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §8 PO register. Purchaser/Director/Accountant/Admin see all; others see their own POs. */
export default async function PurchaseOrdersPage() {
  const user = await requireUser();
  const t = await getTranslations("po");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);
  const seeAll = hasAnyRole(user, ["ADMIN", "PURCHASER", "DIRECTOR", "ACCOUNTANT"]);

  const pos = await db.purchaseOrder.findMany({
    where: seeAll ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { code: true, nameEn: true } }, pr: { select: { prNumber: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/purchase-orders/new" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            {t("newButton")}
          </Link>
        ) : null}
      </div>
      {pos.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("vendor")}</th>
                <th className="px-3 py-2.5">{t("colPr")}</th>
                <th className="px-3 py-2.5">{t("expectedDate")}</th>
                <th className="px-3 py-2.5 text-right">{t("total")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr key={p.id} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                    <Link href={`/purchase-orders/${p.id}`} className="hover:underline">{p.poNumber}</Link>
                  </td>
                  <td className="px-3 py-2.5">{p.vendor.code} · {p.vendor.nameEn}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{p.pr?.prNumber || "—"}</td>
                  <td className="px-3 py-2.5">{p.expectedDate ? formatVnDate(p.expectedDate) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-navy">{decToString(p.total, 0)} ₫</td>
                  <td className="px-3 py-2.5"><StatusBadge status={p.status} label={st.has(p.status) ? st(p.status) : p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
