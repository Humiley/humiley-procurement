import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { pendingStepsFor, LEVEL_LABELS } from "@/lib/workflow/engine";
import { decToString } from "@/lib/money";
import { formatVnDate, daysBetween } from "@/lib/dates";
import { ApprovalsQueue, type QueueRow } from "@/components/approvals/ApprovalsQueue";

/**
 * §6 approval queue — "Waiting for me" across every entity the engine routes
 * (PRs, POs, vendors); decisions run through the §19 signing ceremony.
 */
export default async function ApprovalsPage() {
  const user = await requireUser();
  const steps = await pendingStepsFor(user.id);

  const prIds = steps.filter((s) => s.entityType === "PR").map((s) => s.entityId);
  const poIds = steps.filter((s) => s.entityType === "PO").map((s) => s.entityId);
  const vendorIds = steps.filter((s) => s.entityType === "VENDOR").map((s) => s.entityId);

  const [prs, pos, vendors] = await Promise.all([
    prIds.length
      ? db.purchaseRequisition.findMany({
          where: { id: { in: prIds }, status: "SUBMITTED" },
          include: { requester: { select: { name: true } }, department: { select: { code: true } } },
        })
      : [],
    poIds.length
      ? db.purchaseOrder.findMany({
          where: { id: { in: poIds }, status: "PENDING_APPROVAL" },
          include: { vendor: { select: { code: true, nameEn: true } }, createdBy: { select: { name: true } } },
        })
      : [],
    vendorIds.length ? db.vendor.findMany({ where: { id: { in: vendorIds }, status: "PENDING" } }) : [],
  ]);
  const prById = new Map(prs.map((p) => [p.id, p]));
  const poById = new Map(pos.map((p) => [p.id, p]));
  const vById = new Map(vendors.map((v) => [v.id, v]));

  const rows: QueueRow[] = [];
  for (const s of steps) {
    const base = {
      stepId: s.id,
      entityType: s.entityType as QueueRow["entityType"],
      entityId: s.entityId,
      level: s.level,
      levelLabel: LEVEL_LABELS[s.level] || `Level ${s.level}`,
      submitted: formatVnDate(s.createdAt),
      ageDays: daysBetween(s.createdAt, new Date()),
      slaDue: s.slaDueAt ? formatVnDate(s.slaDueAt) : null,
      overdue: !!(s.slaDueAt && s.slaDueAt < new Date()),
    };
    if (s.entityType === "PR" && prById.has(s.entityId)) {
      const pr = prById.get(s.entityId)!;
      rows.push({ ...base, ref: pr.prNumber, title: pr.purpose, who: pr.requester.name, dept: pr.department.code, amount: decToString(pr.totalEstimatedVnd, 0), link: `/requisitions/${pr.id}` });
    } else if (s.entityType === "PO" && poById.has(s.entityId)) {
      const po = poById.get(s.entityId)!;
      rows.push({ ...base, ref: po.poNumber, title: `${po.vendor.code} · ${po.vendor.nameEn}`, who: po.createdBy?.name ?? "—", dept: "—", amount: decToString(po.total, 0), link: `/purchase-orders/${po.id}` });
    } else if (s.entityType === "VENDOR" && vById.has(s.entityId)) {
      const v = vById.get(s.entityId)!;
      rows.push({ ...base, ref: v.code, title: v.nameEn, who: "—", dept: "—", amount: null, link: "/vendors" });
    }
  }

  return <ApprovalsQueue rows={rows} />;
}
