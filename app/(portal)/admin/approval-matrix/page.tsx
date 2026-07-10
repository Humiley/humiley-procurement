import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { MatrixManager, type MatrixRow, type PendingStepRow, type UserOpt } from "@/components/admin/MatrixManager";

/** §6 DoA matrix + §15 delegation console. ADMIN. */
export default async function ApprovalMatrixPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("matrix");

  const [rows, pending, users] = await Promise.all([
    db.approvalMatrix.findMany({ orderBy: [{ entityType: "asc" }, { minAmountVnd: "asc" }, { level: "asc" }] }),
    db.approvalStep.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { approver: { select: { id: true, name: true } } },
      take: 50,
    }),
    db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const matrixRows: MatrixRow[] = rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    min: decToString(r.minAmountVnd, 0) ?? "0",
    max: r.maxAmountVnd ? decToString(r.maxAmountVnd, 0) : null,
    level: r.level,
    approverRole: r.approverRole,
  }));
  const pendingRows: PendingStepRow[] = pending.map((s) => ({
    id: s.id,
    entityType: s.entityType,
    refLabel: s.entityId.slice(-8),
    level: s.level,
    approver: s.approver.name,
    approverId: s.approver.id,
  }));
  const userOpts: UserOpt[] = users.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-grey">{t("subtitle")}</p>
      </div>
      <MatrixManager rows={matrixRows} pending={pendingRows} users={userOpts} />
    </div>
  );
}
