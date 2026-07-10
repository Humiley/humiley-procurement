import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ApprovalTimeline } from "@/components/shared/ApprovalTimeline";
import { DecideInline } from "@/components/approvals/DecideInline";
import { GiDetailActions, type GiExecLine } from "@/components/gi/GiDetailActions";
import { LEVEL_LABELS } from "@/lib/workflow/engine";

export default async function GoodsIssueDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("gi");
  const st = await getTranslations("status");

  const gi = await db.goodsIssue.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { id: true, name: true } },
      department: { select: { code: true } },
      costCenter: { select: { code: true, nameEn: true } },
      warehouse: { select: { id: true, code: true, nameEn: true } },
      issuedBy: { select: { name: true } },
      lines: { include: { item: { select: { code: true, nameEn: true } }, uom: { select: { code: true } } } },
    },
  });
  if (!gi) notFound();

  const [steps, signatures, balances] = await Promise.all([
    db.approvalStep.findMany({
      where: { entityType: "GOODS_ISSUE", entityId: gi.id },
      orderBy: { level: "asc" },
      include: { approver: { select: { name: true } } },
    }),
    db.electronicSignature.findMany({ where: { entityType: "GoodsIssue", entityId: gi.id }, orderBy: { signedAt: "asc" } }),
    db.stockBalance.findMany({ where: { warehouseId: gi.warehouseId, itemId: { in: gi.lines.map((l) => l.itemId) } } }),
  ]);
  const onHand = new Map<string, string>();
  for (const b of balances) {
    const prev = Number(onHand.get(b.itemId) ?? 0);
    onHand.set(b.itemId, String(prev + Number(decToString(b.qtyOnHand, 4) ?? 0)));
  }

  const timelineSteps = steps.map((s) => ({
    level: s.level,
    roleLabel: LEVEL_LABELS[s.level] || `Level ${s.level}`,
    approverName: s.approver.name,
    status: s.status,
    actedAt: s.decidedAt,
    slaDueAt: s.slaDueAt,
    comment: s.comment,
  }));
  const activeStep = steps.find((s) => s.status === "PENDING" && !steps.some((o) => o.status === "PENDING" && o.level < s.level));
  const myTurn = gi.status === "SUBMITTED" && activeStep?.approverId === user.id;
  const canExecute = hasAnyRole(user, ["WAREHOUSE", "ADMIN"]);

  const execLines: GiExecLine[] = gi.lines.map((l) => ({
    lineId: l.id,
    label: `${l.item.code} · ${l.item.nameEn}`,
    uom: l.uom.code,
    requested: decToString(l.qtyRequested, 4) ?? "0",
    onHand: onHand.get(l.itemId) ?? "0",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory/issues" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="font-mono text-lg font-bold text-navy">{gi.issueNumber}</h1>
        <StatusBadge status={gi.status} label={st.has(gi.status) ? st(gi.status) : gi.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 card p-4 text-sm sm:grid-cols-4">
        <Field label={t("colRequester")} value={`${gi.requester.name} · ${gi.department.code}`} />
        <Field label={t("warehouse")} value={`${gi.warehouse.code} · ${gi.warehouse.nameEn}`} />
        <Field label={t("costCenter")} value={`${gi.costCenter.code} · ${gi.costCenter.nameEn}`} />
        <Field label={t("projectCode")} value={gi.projectCode || "—"} />
        {gi.issuedBy ? <Field label={t("issuedBy")} value={`${gi.issuedBy.name} · ${gi.issuedAt ? formatVnDateTime(gi.issuedAt) : ""}`} /> : null}
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-xs uppercase tracking-wide text-grey">{t("purpose")}</dt>
          <dd className="mt-0.5">{gi.purpose}</dd>
        </div>
      </div>

      <GiDetailActions
        id={gi.id}
        status={gi.status}
        isRequester={gi.requesterId === user.id}
        canExecute={canExecute}
        execLines={execLines}
      />

      <div className="overflow-x-auto card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-grey">
              <th className="w-8 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">{t("item")}</th>
              <th className="px-3 py-2.5 text-right">{t("requested")}</th>
              <th className="px-3 py-2.5 text-right">{t("issued")}</th>
            </tr>
          </thead>
          <tbody>
            {gi.lines.map((l, i) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 text-grey">{i + 1}</td>
                <td className="px-3 py-2.5">{l.item.code} · {l.item.nameEn}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{Number(decToString(l.qtyRequested, 4)).toLocaleString("en-US")} {l.uom.code}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                  {Number(decToString(l.qtyIssued, 4)) > 0 ? `${Number(decToString(l.qtyIssued, 4)).toLocaleString("en-US")} ${l.uom.code}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("tabApprovals")}</h3>
        {steps.length === 0 ? <p className="text-sm text-grey">{t("approvalsPending")}</p> : <ApprovalTimeline steps={timelineSteps} />}
        {myTurn ? <DecideInline entityType="GOODS_ISSUE" entityId={gi.id} refLabel={gi.issueNumber} /> : null}
        {signatures.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-navy">{s.fullNamePrinted}</span>
                <span className="mx-1.5 rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">{s.meaning}</span>
                <span className="text-grey">{formatVnDateTime(s.signedAt)}</span>
                {s.reason ? <span className="ml-1.5 text-grey">— {s.reason}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-grey">{label}</dt>
      <dd className="mt-0.5 text-body">{value}</dd>
    </div>
  );
}
