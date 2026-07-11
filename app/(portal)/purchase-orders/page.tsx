import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
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
        <h1 className="page-title">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/purchase-orders/new" className="btn-primary">
            {t("newButton")}
          </Link>
        ) : null}
      </div>

      <HowItWorks guide="purchase-orders" />
      {pos.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="th">
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
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 text-sm font-semibold text-navy tabular-nums whitespace-nowrap">
                    <Link href={`/purchase-orders/${p.id}`} className="hover:underline">{p.poNumber}</Link>
                  </td>
                  <td className="px-3 py-2.5">{p.vendor.code} · {p.vendor.nameEn}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums">{p.pr?.prNumber || "—"}</td>
                  <td className="px-3 py-2.5">{p.expectedDate ? formatVnDate(p.expectedDate) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-navy">{Number(decToString(p.total, 0)).toLocaleString("en-US")} ₫</td>
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
