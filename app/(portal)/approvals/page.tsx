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
export default async function ApprovalsPage({ searchParams }: { searchParams?: { overdue?: string } }) {
  const user = await requireUser();
  const steps = await pendingStepsFor(user.id);

  // §15 SLA sweep (run-on-load like renewals): overdue PENDING steps remind their approver once
  // per breach (deduped on an unread notification carrying the step link).
  try {
    const overdue = await db.approvalStep.findMany({
      where: { status: "PENDING", slaDueAt: { lt: new Date() } },
      include: { approver: { select: { id: true } } },
      take: 25,
    });
    const { notifyUser } = await import("@/lib/notify");
    for (const s of overdue) {
      const link = `/approvals?overdue=${s.id}`;
      const dup = await db.notification.findFirst({ where: { link, isRead: false } });
      if (dup) continue;
      await notifyUser(s.approver.id, {
        titleEn: `Approval overdue: ${s.entityType} level ${s.level}`,
        titleVn: `Phê duyệt quá hạn: ${s.entityType} cấp ${s.level}`,
        bodyEn: "The SLA for this approval step has passed — please decide it.",
        bodyVn: "Bước phê duyệt này đã quá hạn SLA — vui lòng xử lý.",
        link,
      });
    }
  } catch (e) {
    console.warn("SLA sweep failed:", e);
  }

  const prIds = steps.filter((s) => s.entityType === "PR").map((s) => s.entityId);
  const poIds = steps.filter((s) => s.entityType === "PO").map((s) => s.entityId);
  const vendorIds = steps.filter((s) => s.entityType === "VENDOR").map((s) => s.entityId);
  const payIds = steps.filter((s) => s.entityType === "PAYMENT_REQUEST").map((s) => s.entityId);
  const giIds = steps.filter((s) => s.entityType === "GOODS_ISSUE").map((s) => s.entityId);

  const [prs, pos, vendors, preqs, gis] = await Promise.all([
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
    payIds.length
      ? db.paymentRequest.findMany({
          where: { id: { in: payIds }, status: "SUBMITTED" },
          include: { requester: { select: { name: true } }, department: { select: { code: true } } },
        })
      : [],
    giIds.length
      ? db.goodsIssue.findMany({
          where: { id: { in: giIds }, status: "SUBMITTED" },
          include: { requester: { select: { name: true } }, department: { select: { code: true } }, warehouse: { select: { code: true } } },
        })
      : [],
  ]);
  const payById = new Map(preqs.map((p) => [p.id, p]));
  const giById = new Map(gis.map((g) => [g.id, g]));
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
    } else if (s.entityType === "PAYMENT_REQUEST" && payById.has(s.entityId)) {
      const q = payById.get(s.entityId)!;
      rows.push({ ...base, ref: q.paymentRequestNumber, title: `${q.type} · ${q.payeeName}`, who: q.requester.name, dept: q.department.code, amount: decToString(q.amount, 0), link: `/payment-requests/${q.id}` });
    } else if (s.entityType === "GOODS_ISSUE" && giById.has(s.entityId)) {
      const g = giById.get(s.entityId)!;
      rows.push({ ...base, ref: g.issueNumber, title: `${g.warehouse.code} · ${g.purpose}`, who: g.requester.name, dept: g.department.code, amount: null, link: `/inventory/issues/${g.id}` });
    }
  }

  // §15 SLA deep-link: /approvals?overdue=<stepId> highlights the breached step in the queue.
  return <ApprovalsQueue rows={rows} highlightStepId={searchParams?.overdue ?? null} />;
}
