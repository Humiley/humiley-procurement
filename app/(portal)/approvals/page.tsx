import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { pendingStepsFor, LEVEL_LABELS } from "@/lib/workflow/engine";
import { decToString } from "@/lib/money";
import { formatVnDate, daysBetween } from "@/lib/dates";
import { ApprovalsQueue, type QueueRow } from "@/components/approvals/ApprovalsQueue";

/**
 * §6 approval queue — "Waiting for me": the ACTIVE pending steps assigned to the signed-in
 * user, with amount / requester / age; decisions run through the §19 signing ceremony.
 */
export default async function ApprovalsPage() {
  const user = await requireUser();
  const steps = await pendingStepsFor(user.id, "PR");

  const prs = steps.length
    ? await db.purchaseRequisition.findMany({
        where: { id: { in: steps.map((s) => s.entityId) }, status: "SUBMITTED" },
        include: {
          requester: { select: { name: true } },
          department: { select: { code: true } },
        },
      })
    : [];
  const prById = new Map(prs.map((p) => [p.id, p]));

  const rows: QueueRow[] = steps
    .filter((s) => prById.has(s.entityId))
    .map((s) => {
      const pr = prById.get(s.entityId)!;
      return {
        stepId: s.id,
        prId: pr.id,
        prNumber: pr.prNumber,
        purpose: pr.purpose,
        requesterName: pr.requester.name,
        departmentCode: pr.department.code,
        total: decToString(pr.totalEstimatedVnd, 0) ?? "0",
        level: s.level,
        levelLabel: LEVEL_LABELS[s.level] || `Level ${s.level}`,
        submitted: formatVnDate(s.createdAt),
        ageDays: daysBetween(s.createdAt, new Date()),
        slaDue: s.slaDueAt ? formatVnDate(s.slaDueAt) : null,
        overdue: !!(s.slaDueAt && s.slaDueAt < new Date()),
      };
    });

  return <ApprovalsQueue rows={rows} />;
}
