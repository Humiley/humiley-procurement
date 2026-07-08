import type { Prisma } from "@prisma/client";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { PrList, type PrRow } from "@/components/pr/PrList";

export default async function RequisitionsPage() {
  const user = await requireUser();

  // Role scoping: purchaser/director/admin see all; managers see their department; others their own.
  let where: Prisma.PurchaseRequisitionWhereInput;
  if (hasAnyRole(user, ["ADMIN", "PURCHASER", "DIRECTOR", "ACCOUNTANT"])) {
    where = {};
  } else if (hasAnyRole(user, ["DEPT_MANAGER"]) && user.departmentId) {
    where = { OR: [{ departmentId: user.departmentId }, { requesterId: user.id }] };
  } else {
    where = { requesterId: user.id };
  }

  const prs = await db.purchaseRequisition.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { name: true } },
      department: { select: { code: true, nameEn: true } },
      costCenter: { select: { code: true } },
    },
  });

  const rows: PrRow[] = prs.map((p) => ({
    id: p.id,
    prNumber: p.prNumber,
    purpose: p.purpose,
    departmentName: `${p.department.code}`,
    costCenterName: p.costCenter.code,
    neededBy: formatVnDate(p.neededByDate),
    total: decToString(p.totalEstimatedVnd, 0) ?? "0",
    status: p.status,
    requesterName: p.requester.name,
  }));

  return <PrList rows={rows} />;
}
