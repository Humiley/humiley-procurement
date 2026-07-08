import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString, formatQty } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { humanSize } from "@/lib/storage";
import { DocDetailLayout } from "@/components/shared/DocDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { ApprovalTimeline } from "@/components/shared/ApprovalTimeline";
import { PrAttachments, type PrAttachment } from "@/components/pr/PrAttachments";
import { PrDetailActions } from "@/components/pr/PrDetailActions";

export default async function RequisitionDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("pr");
  const st = await getTranslations("status");

  const pr = await db.purchaseRequisition.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { name: true, id: true } },
      department: { select: { code: true, nameEn: true } },
      costCenter: { select: { code: true, nameEn: true } },
      lines: {
        include: { item: { select: { code: true, nameEn: true } }, uom: { select: { code: true } } },
      },
    },
  });
  if (!pr) notFound();

  const isOwner = pr.requesterId === user.id;
  const privileged = hasAnyRole(user, ["ADMIN", "PURCHASER", "DIRECTOR", "ACCOUNTANT", "DEPT_MANAGER"]);
  if (!isOwner && !privileged) notFound();

  const [attachments, audits] = await Promise.all([
    db.attachment.findMany({
      where: { entityType: "PurchaseRequisition", entityId: pr.id },
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.findMany({
      where: { entityType: "PurchaseRequisition", entityId: pr.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const attRows: PrAttachment[] = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    sizeLabel: humanSize(a.sizeBytes),
    canDelete: a.uploadedById === user.id || hasAnyRole(user, ["ADMIN", "PURCHASER"]),
  }));

  const meta = (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      <Field label={t("requester")} value={pr.requester.name} />
      <Field label={t("department")} value={`${pr.department.code} · ${pr.department.nameEn}`} />
      <Field label={t("costCenter")} value={`${pr.costCenter.code} · ${pr.costCenter.nameEn}`} />
      <Field label={t("neededBy")} value={formatVnDate(pr.neededByDate)} />
      <Field label={t("projectCode")} value={pr.projectCode || "—"} />
      <Field label={t("requestedOn")} value={formatVnDate(pr.createdAt)} />
      <div className="col-span-2 sm:col-span-2">
        <dt className="text-xs uppercase tracking-wide text-grey">{t("total")}</dt>
        <dd className="mt-0.5 text-lg font-bold text-navy">
          <VndDisplay value={decToString(pr.totalEstimatedVnd, 0)} />
        </dd>
      </div>
      <div className="col-span-2 sm:col-span-4">
        <dt className="text-xs uppercase tracking-wide text-grey">{t("purpose")}</dt>
        <dd className="mt-0.5 text-body">{pr.purpose}</dd>
      </div>
    </dl>
  );

  const detailsTab = (
    <div className="overflow-x-auto rounded-card border border-black/5">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            <th className="th w-8 text-center">#</th>
            <th className="th">{t("item")}</th>
            <th className="th w-24 text-center">{t("uom")}</th>
            <th className="th w-28 text-right">{t("qty")}</th>
            <th className="th w-40 text-right">{t("unitPrice")}</th>
            <th className="th w-40 text-right">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {pr.lines.length === 0 ? (
            <tr>
              <td className="td text-center text-grey" colSpan={6}>
                {t("linesEmpty")}
              </td>
            </tr>
          ) : (
            pr.lines.map((l, i) => {
              const amount = new Prisma.Decimal(l.qty).times(l.estUnitPriceVnd);
              return (
                <tr key={l.id}>
                  <td className="td text-center text-grey">{i + 1}</td>
                  <td className="td">
                    {l.item ? (
                      <span>
                        <span className="font-mono text-xs text-grey">{l.item.code}</span> · {l.item.nameEn}
                      </span>
                    ) : (
                      l.freeTextDescription
                    )}
                    {l.note ? <div className="text-xs text-grey">{l.note}</div> : null}
                  </td>
                  <td className="td text-center">{l.uom.code}</td>
                  <td className="td text-right tabular-nums">{formatQty(l.qty)}</td>
                  <td className="td text-right">
                    <VndDisplay value={decToString(l.estUnitPriceVnd, 0)} />
                  </td>
                  <td className="td text-right font-medium">
                    <VndDisplay value={decToString(amount, 0)} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const approvalsTab =
    pr.status === "DRAFT" ? (
      <p className="text-sm text-grey">{t("approvalsPending")}</p>
    ) : (
      <ApprovalTimeline steps={[]} />
    );

  const auditTab =
    audits.length === 0 ? (
      <p className="text-sm text-grey">—</p>
    ) : (
      <ul className="divide-y divide-black/5">
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
      backHref="/requisitions"
      title={pr.prNumber}
      subtitle={pr.purpose}
      statusSlot={
        <StatusBadge status={pr.status} label={st.has(pr.status) ? st(pr.status) : pr.status} />
      }
      metaSlot={meta}
      actions={
        <PrDetailActions
          id={pr.id}
          status={pr.status}
          isOwner={isOwner}
          canRecall={pr.status === "SUBMITTED" && pr.currentApprovalLevel === 0}
        />
      }
      tabs={[
        { key: "details", label: t("tabDetails"), content: detailsTab, count: pr.lines.length },
        { key: "approvals", label: t("tabApprovals"), content: approvalsTab },
        {
          key: "attachments",
          label: t("tabAttachments"),
          count: attRows.length,
          content: (
            <PrAttachments
              entityId={pr.id}
              attachments={attRows}
              canUpload={isOwner || hasAnyRole(user, ["ADMIN", "PURCHASER", "DIRECTOR", "DEPT_MANAGER"])}
            />
          ),
        },
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
