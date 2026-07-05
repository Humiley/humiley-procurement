import { getTranslations } from "next-intl/server";
import { FileText, CheckSquare, ShoppingCart, Bell } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatVnDateTime } from "@/lib/dates";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");

  const [myReqs, pendingApprovals, openPos, unread, recent] = await Promise.all([
    db.purchaseRequisition.count({ where: { requesterId: user.id } }),
    db.approvalStep.count({ where: { approverId: user.id, status: "PENDING" } }),
    db.purchaseOrder.count({
      where: { status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } },
    }),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
    db.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-grey">{t("welcome", { name: user.name })}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("myRequisitions")} value={myReqs} icon={FileText} href="/requisitions" />
        <KpiCard
          label={t("pendingApprovals")}
          value={pendingApprovals}
          icon={CheckSquare}
          href="/approvals"
          accent="emerald"
        />
        <KpiCard label={t("openPos")} value={openPos} icon={ShoppingCart} href="/purchase-orders" />
        <KpiCard
          label={t("recentActivity")}
          value={unread}
          icon={Bell}
          href="/notifications"
        />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-grey">
          {t("recentActivity")}
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-grey">{t("nothingYet")}</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-body">
                  <span className="font-medium">{r.action}</span>{" "}
                  <span className="text-grey">· {r.entityType}</span>
                </span>
                <span className="shrink-0 text-xs text-grey">{formatVnDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
