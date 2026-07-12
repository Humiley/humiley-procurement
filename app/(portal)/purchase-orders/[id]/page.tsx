import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString, formatQty } from "@/lib/money";
import { formatVnDate, formatVnDateTime, ymdVn } from "@/lib/dates";
import { DocDetailLayout } from "@/components/shared/DocDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { ApprovalTimeline } from "@/components/shared/ApprovalTimeline";
import { DecideInline } from "@/components/approvals/DecideInline";
import { PoDetailActions } from "@/components/po/PoDetailActions";
import { ShipmentDocsPanel, type ShipDocRow, type CooOpt } from "@/components/trade/ShipmentDocsPanel";
import { LEVEL_LABELS } from "@/lib/workflow/engine";

export default async function PoDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("po");
  const st = await getTranslations("status");

  const po = await db.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: true,
      pr: { select: { id: true, prNumber: true, departmentId: true } },
      createdBy: { select: { id: true, name: true } },
      lines: { include: { uom: { select: { code: true } }, item: { select: { code: true, nameEn: true } } } },
    },
  });
  if (!po) notFound();

  const canManage = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  const [steps, signatures, audits, shipDocs, cooForms] = await Promise.all([
    db.approvalStep.findMany({
      where: { entityType: "PO", entityId: po.id },
      orderBy: { level: "asc" },
      include: { approver: { select: { name: true } } },
    }),
    db.electronicSignature.findMany({
      where: { entityType: "PurchaseOrder", entityId: po.id },
      orderBy: { signedAt: "asc" },
    }),
    db.auditLog.findMany({
      where: { entityType: "PurchaseOrder", entityId: po.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    db.shipmentDoc.findMany({ where: { poId: po.id }, orderBy: { id: "asc" }, include: { cooFormType: { select: { code: true } } } }),
    db.cooFormType.findMany({ orderBy: { code: "asc" } }),
  ]);

  // An assigned approver can always open the PO they must decide (even without a privileged role).
  const canSee = canManage || hasAnyRole(user, ["DIRECTOR", "ACCOUNTANT", "DEPT_MANAGER"]) || po.createdById === user.id || steps.some((s) => s.approverId === user.id);
  if (!canSee) notFound();

  const shipDocRows: ShipDocRow[] = shipDocs.map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    docNumber: d.docNumber,
    issueDate: d.issueDate ? ymdVn(d.issueDate) : null,
    formCode: d.cooFormType?.code ?? null,
  }));
  const cooOpts: CooOpt[] = cooForms.map((c) => ({ id: c.id, label: `${c.code.replace("_", " ")} — ${c.agreementName}` }));
  const shipDocsTab = (
    <ShipmentDocsPanel poId={po.id} docs={shipDocRows} cooForms={cooOpts} canAct={canManage} />
  );

  const meta = (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      <Field label={t("vendor")} value={`${po.vendor.code} · ${po.vendor.nameEn}`} />
      <Field label={t("colPr")} value={po.pr?.prNumber || "—"} />
      <Field label={t("currency")} value={`${po.currency} / ${decToString(po.fxRate, 0)}`} />
      <Field label={t("expectedDate")} value={po.expectedDate ? formatVnDate(po.expectedDate) : "—"} />
      <Field label={t("paymentTerms")} value={po.paymentTerms || "—"} />
      <Field label={t("incoterm")} value={po.incoterm ? `${po.incoterm}${po.incotermPlace ? " — " + po.incotermPlace : ""}` : "—"} />
      <Field label={t("deliveryAddress")} value={po.deliveryAddress || "—"} />
      <Field label={t("warranty")} value={po.warrantyTerms || "—"} />
      <div className="col-span-2 sm:col-span-4">
        <dt className="text-xs uppercase tracking-wide text-grey">{t("total")}</dt>
        <dd className="mt-0.5 text-lg font-bold text-navy">
          <VndDisplay value={decToString(po.total, 0)} />
          <span className="ml-2 text-xs font-normal text-grey">
            ({t("subtotal")} {Number(decToString(po.subtotal, 0)).toLocaleString("en-US")} + VAT {decToString(po.vatPct, 0)}% = {Number(decToString(po.vatAmount, 0)).toLocaleString("en-US")})
          </span>
        </dd>
      </div>
    </dl>
  );

  const linesTab = (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            <th className="th w-8 text-center">#</th>
            <th className="th">{t("lineDesc")}</th>
            <th className="th w-24 text-center">{t("uom")}</th>
            <th className="th w-28 text-right">{t("qty")}</th>
            <th className="th w-40 text-right">{t("unitPrice")}</th>
            <th className="th w-40 text-right">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l, i) => (
            <tr key={l.id}>
              <td className="td text-center text-grey">{i + 1}</td>
              <td className="td">{l.item ? `${l.item.code} · ${l.item.nameEn}` : l.description}</td>
              <td className="td text-center">{l.uom.code}</td>
              <td className="td text-right tabular-nums">{formatQty(l.qty)}</td>
              <td className="td text-right"><VndDisplay value={decToString(l.unitPrice, 0)} /></td>
              <td className="td text-right font-medium"><VndDisplay value={decToString(l.amount, 0)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const timelineSteps = steps.map((s) => ({
    level: s.level,
    roleLabel: LEVEL_LABELS[s.level] || `Level ${s.level}`,
    approverName: s.approver.name,
    status: s.status,
    actedAt: s.decidedAt,
    slaDueAt: s.slaDueAt,
    comment: s.comment,
  }));
  const activeStep = steps.find(
    (s) => s.status === "PENDING" && !steps.some((o) => o.status === "PENDING" && o.level < s.level),
  );
  const myTurn = po.status === "PENDING_APPROVAL" && activeStep?.approverId === user.id;

  const approvalsTab = (
    <div>
      {steps.length === 0 ? <p className="text-sm text-grey">{t("approvalsPending")}</p> : <ApprovalTimeline steps={timelineSteps} />}
      {myTurn ? <DecideInline entityType="PO" entityId={po.id} refLabel={po.poNumber} /> : null}
      {signatures.length > 0 ? (
        <div className="mt-6">
          <h3 className="label">{t("signatureBlock")}</h3>
          <ul className="space-y-1.5">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-navy">{s.fullNamePrinted}</span>
                <span className="mx-1.5 rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">{s.meaning}</span>
                <span className="text-grey" title={s.signedAt.toISOString()}>{formatVnDateTime(s.signedAt)}</span>
                {s.reason ? <span className="ml-1.5 text-grey">— {s.reason}</span> : null}
                <span className="mt-0.5 block truncate font-mono text-[10px] text-grey/70" title={s.recordSnapshotHash}>
                  #{s.recordSnapshotHash.slice(0, 16)}… {s.prevSignatureHash ? "⛓" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  const auditTab =
    audits.length === 0 ? (
      <p className="text-sm text-grey">—</p>
    ) : (
      <ul className="divide-y divide-line">
        {audits.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-body">
              <span className="font-medium">{a.action}</span>
              {a.user ? <span className="text-grey"> · {a.user.name}</span> : null}
            </span>
            <span className="shrink-0 text-xs text-grey">{formatVnDateTime(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <DocDetailLayout
      backHref="/purchase-orders"
      title={po.poNumber}
      subtitle={`${po.vendor.code} · ${po.vendor.nameEn}`}
      statusSlot={<StatusBadge status={po.status} label={st.has(po.status) ? st(po.status) : po.status} />}
      metaSlot={meta}
      actions={<PoDetailActions id={po.id} status={po.status} canManage={canManage} />}
      tabs={[
        { key: "lines", label: t("tabLines"), content: linesTab, count: po.lines.length },
        { key: "approvals", label: t("tabApprovals"), content: approvalsTab },
        { key: "shipdocs", label: t("tabShipDocs"), content: shipDocsTab, count: shipDocRows.length },
        { key: "audit", label: t("tabAudit"), content: auditTab },
      ]}
    />
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
