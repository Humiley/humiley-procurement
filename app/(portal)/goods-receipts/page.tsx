import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §9 GRN register. */
export default async function GoodsReceiptsPage() {
  const user = await requireUser();
  const t = await getTranslations("grn");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["WAREHOUSE", "ADMIN"]);

  const grns = await db.goodsReceipt.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      po: { select: { poNumber: true, vendor: { select: { code: true } } } },
      warehouse: { select: { code: true } },
      receivedBy: { select: { name: true } },
      lines: { select: { qtyReceived: true, qtyAccepted: true, qtyRejected: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/goods-receipts/new" className="btn-primary">
            {t("newButton")}
          </Link>
        ) : null}
      </div>

      <HowItWorks guide="goods-receipts" />
      {grns.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="th">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("po")}</th>
                <th className="px-3 py-2.5">{t("warehouse")}</th>
                <th className="px-3 py-2.5">{t("receivedBy")}</th>
                <th className="px-3 py-2.5">{t("colDate")}</th>
                <th className="px-3 py-2.5 text-right">{t("colQty")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {grns.map((g) => {
                const rec = g.lines.reduce((s, l) => s + Number(l.qtyReceived), 0);
                return (
                  <tr key={g.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                    <td className="px-3 py-2.5 text-sm font-semibold text-navy tabular-nums whitespace-nowrap">
                      <Link href={`/goods-receipts/${g.id}`} className="hover:underline">{g.grnNumber}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{g.po.poNumber} <span className="text-grey">· {g.po.vendor.code}</span></td>
                    <td className="px-3 py-2.5">{g.warehouse.code}</td>
                    <td className="px-3 py-2.5">{g.receivedBy.name}</td>
                    <td className="px-3 py-2.5">{formatVnDate(g.receivedDate)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{rec.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={g.status} label={st.has(g.status) ? st(g.status) : g.status} /></td>
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
