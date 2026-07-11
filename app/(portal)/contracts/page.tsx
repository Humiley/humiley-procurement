import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { checkContractRenewals } from "./actions";

const DAY = 24 * 3600 * 1000;

/** §9 contract register — renewal alerts run on load; expiring rows are badged. */
export default async function ContractsPage() {
  const user = await requireUser();
  const t = await getTranslations("contracts");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  await checkContractRenewals();

  const contracts = await db.contract.findMany({
    orderBy: { endDate: "asc" },
    include: { vendor: { select: { code: true, nameEn: true } }, purchaseOrders: { select: { id: true } } },
  });
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/contracts/new" className="btn-primary">
            {t("newButton")}
          </Link>
        ) : null}
      </div>
      {contracts.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="th">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("vendor")}</th>
                <th className="px-3 py-2.5">{t("title")}</th>
                <th className="px-3 py-2.5">{t("validity")}</th>
                <th className="px-3 py-2.5 text-right">{t("value")}</th>
                <th className="px-3 py-2.5 text-right">{t("colPos")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const daysLeft = Math.ceil((c.endDate.getTime() - now) / DAY);
                const expiring = c.status === "ACTIVE" && daysLeft <= c.renewalAlertDays;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                    <td className="px-3 py-2.5 text-sm font-semibold text-navy tabular-nums whitespace-nowrap">
                      <Link href={`/contracts/${c.id}`} className="hover:underline">{c.contractNumber}</Link>
                    </td>
                    <td className="px-3 py-2.5">{c.vendor.code} <span className="text-grey">· {c.vendor.nameEn}</span></td>
                    <td className="max-w-[220px] truncate px-3 py-2.5">{c.title}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatVnDate(c.startDate)} → {formatVnDate(c.endDate)}
                      {expiring ? <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{t("expiresIn", { days: daysLeft })}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{Number(decToString(c.valueVnd, 0)).toLocaleString("en-US")} ₫</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.purchaseOrders.length}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={c.status} label={st.has(c.status) ? st(c.status) : c.status} /></td>
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
