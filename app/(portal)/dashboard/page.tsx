import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, CheckSquare, ShoppingCart, Bell, TrendingUp, PiggyBank, Timer, Banknote } from "lucide-react";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { managerDashboard } from "@/lib/kpi/dashboard";
import { SpendTrendChart, CategoryDonut, DeptBarChart } from "@/components/charts/DashboardCharts";

/** §10-G role-aware dashboard: requesters see their own pipeline; managers see spend analytics. */
export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const st = await getTranslations("status");
  const isManager = hasAnyRole(user, ["PURCHASER", "DIRECTOR", "ACCOUNTANT", "DEPT_MANAGER", "ADMIN"]);

  const [myPrs, pendingApprovals, openPos, unread, recent, mgr] = await Promise.all([
    db.purchaseRequisition.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, prNumber: true, purpose: true, status: true, createdAt: true },
    }),
    db.approvalStep.count({ where: { approverId: user.id, status: "PENDING" } }),
    db.purchaseOrder.count({ where: { status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } } }),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
    db.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    isManager ? managerDashboard(user.id) : null,
  ]);

  const byStatus = myPrs.reduce<Record<string, number>>((m, p) => ({ ...m, [p.status]: (m[p.status] ?? 0) + 1 }), {});
  const money = (v: number) => `${v.toLocaleString("en-US")}\u00A0₫`;

  return (
    <div className="space-y-[22px]">
      <div>
        <h1 className="page-title">{t("welcome", { name: user.name })}</h1>
        <p className="mt-1 text-sm text-grey">{t("title")}</p>
      </div>

      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("myRequisitions")} value={myPrs.length} icon={FileText} href="/requisitions" />
        <KpiCard label={t("pendingApprovals")} value={pendingApprovals} icon={CheckSquare} href="/approvals" accent="emerald" />
        <KpiCard label={t("openPos")} value={openPos} icon={ShoppingCart} href="/purchase-orders" />
        <KpiCard label={t("notifications")} value={unread} icon={Bell} href="/notifications" />
      </div>

      {mgr ? (
        <>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t("spendMtd")} value={money(mgr.spendMtd)} icon={Banknote} />
            <KpiCard label={t("spendYtd")} value={money(mgr.spendYtd)} icon={TrendingUp} />
            <KpiCard label={t("cycleTime")} value={`${mgr.cycleTimeDays} ${t("days")}`} icon={Timer} />
            <KpiCard label={t("savings")} value={money(mgr.savingsVnd)} icon={PiggyBank} accent="emerald" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-6 lg:col-span-1">
              <h2 className="label">{t("monthlyTrend")}</h2>
              <SpendTrendChart data={mgr.monthlyTrend} />
            </div>
            <div className="card p-6">
              <h2 className="label">{t("byCategory")}</h2>
              <CategoryDonut data={mgr.byCategory} />
            </div>
            <div className="card p-6">
              <h2 className="label">{t("byDepartment")}</h2>
              <DeptBarChart data={mgr.byDepartment} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-6">
              <h2 className="label">{t("topVendors")}</h2>
              {mgr.topVendors.length === 0 ? (
                <p className="text-sm text-grey">{t("nothingYet")}</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {mgr.topVendors.map((v, i) => (
                    <li key={v.name} className="flex items-center justify-between">
                      <span><span className="mr-2 text-xs font-bold text-grey">{i + 1}.</span>{v.name}</span>
                      <span className="tabular-nums">{money(v.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-6">
              <h2 className="label">{t("deliveriesDue")}</h2>
              {mgr.deliveriesDue.length === 0 ? (
                <p className="text-sm text-grey">{t("noDeliveries")}</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {mgr.deliveriesDue.map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <Link href={`/purchase-orders/${d.id}`} className="font-mono text-xs font-bold text-navy hover:underline">{d.poNumber}</Link>
                      <span className="text-grey">{d.vendor}</span>
                      <span>{formatVnDate(d.expected)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-6">
              <h2 className="label">{t("expiringContracts")}</h2>
              {mgr.expiringContracts.length === 0 ? (
                <p className="text-sm text-grey">{t("noExpiring")}</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {mgr.expiringContracts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <Link href={`/contracts/${c.id}`} className="font-mono text-xs font-bold text-navy hover:underline">{c.contractNumber}</Link>
                      <span className="text-grey">{c.vendor}</span>
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{t("inDays", { days: c.daysLeft })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-grey">{t("myPrsByStatus")}</h2>
          {myPrs.length === 0 ? (
            <p className="text-sm text-grey">{t("nothingYet")}</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(byStatus).map(([s, n]) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <StatusBadge status={s} label={st.has(s) ? st(s) : s} />
                    <b className="text-sm">{n}</b>
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-line">
                {myPrs.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/requisitions/${p.id}`} className="font-mono text-xs font-bold text-navy hover:underline">{p.prNumber}</Link>
                    <span className="min-w-0 flex-1 truncate text-grey">{p.purpose}</span>
                    <StatusBadge status={p.status} label={st.has(p.status) ? st(p.status) : p.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-grey">{t("recentActivity")}</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-grey">{t("nothingYet")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-body">
                    <span className="font-medium">{r.action}</span> <span className="text-grey">· {r.entityType}</span>
                  </span>
                  <span className="shrink-0 text-xs text-grey">{formatVnDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
