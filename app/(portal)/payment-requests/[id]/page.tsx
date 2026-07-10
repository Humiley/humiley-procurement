import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { humanSize } from "@/lib/storage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ApprovalTimeline } from "@/components/shared/ApprovalTimeline";
import { DecideInline } from "@/components/approvals/DecideInline";
import { PayReqDetailActions } from "@/components/payreq/PayReqDetailActions";
import { PrAttachments, type PrAttachment } from "@/components/pr/PrAttachments";
import { LEVEL_LABELS } from "@/lib/workflow/engine";

export default async function PaymentRequestDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("payreq");
  const st = await getTranslations("status");

  const q = await db.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { id: true, name: true } },
      department: { select: { code: true } },
      costCenter: { select: { code: true, nameEn: true } },
      vendor: { select: { code: true, nameEn: true } },
      advance: { select: { id: true, paymentRequestNumber: true, amount: true } },
      lines: { include: { invoice: { select: { id: true, invoiceNumber: true, paymentStatus: true } } } },
    },
  });
  if (!q) notFound();
  const isRequester = q.requesterId === user.id;
  const isAccountant = hasAnyRole(user, ["ACCOUNTANT", "ADMIN"]);
  const canSee = isRequester || isAccountant || hasAnyRole(user, ["PURCHASER", "DIRECTOR", "DEPT_MANAGER"]);
  if (!canSee) notFound();

  const [steps, signatures, attachments] = await Promise.all([
    db.approvalStep.findMany({
      where: { entityType: "PAYMENT_REQUEST", entityId: q.id },
      orderBy: { level: "asc" },
      include: { approver: { select: { name: true } } },
    }),
    db.electronicSignature.findMany({ where: { entityType: "PaymentRequest", entityId: q.id }, orderBy: { signedAt: "asc" } }),
    db.attachment.findMany({ where: { entityType: "PaymentRequest", entityId: q.id }, orderBy: { createdAt: "desc" } }),
  ]);

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
  const myTurn = q.status === "SUBMITTED" && activeStep?.approverId === user.id;

  const attRows: PrAttachment[] = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    sizeLabel: humanSize(a.sizeBytes),
    canDelete: a.uploadedById === user.id || isAccountant,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/payment-requests" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="page-title font-mono">{q.paymentRequestNumber}</h1>
        <StatusBadge status={q.status} label={st.has(q.status) ? st(q.status) : q.status} />
        <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">{t(`type.${q.type}`)}</span>
        {q.verifiedById ? <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald">{t("verifiedBadge")}</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 card p-4 text-sm sm:grid-cols-4">
        <Field label={t("colRequester")} value={`${q.requester.name} · ${q.department.code}`} />
        <Field label={t("costCenter")} value={`${q.costCenter.code} · ${q.costCenter.nameEn}`} />
        <Field label={t("colPayee")} value={q.payeeName + (q.vendor ? ` (${q.vendor.code})` : "")} />
        <Field label={t("bank")} value={`${q.payeeBankName || "—"} · ${q.payeeBankAccount || "—"}`} />
        <Field label={t("method")} value={q.paymentMethod === "CASH" ? t("cash") : t("bankTransfer")} />
        <Field label={t("dueDate")} value={q.dueDate ? formatVnDate(q.dueDate) : "—"} />
        {q.advance ? <Field label={t("settleAdvance")} value={`${q.advance.paymentRequestNumber} · ${Number(decToString(q.advance.amount, 0)).toLocaleString("en-US")} ₫`} /> : null}
        {q.paidDate ? <Field label={t("paidOn")} value={`${formatVnDate(q.paidDate)} · ${q.paymentRef || ""}`} /> : null}
        <div className="col-span-2 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-grey">{t("amount")}</dt>
          <dd className="mt-0.5 text-lg font-bold text-navy">{Number(decToString(q.amount, 0)).toLocaleString("en-US")} ₫</dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-xs uppercase tracking-wide text-grey">{t("reason")}</dt>
          <dd className="mt-0.5">{q.reason || "—"}</dd>
        </div>
      </div>

      <PayReqDetailActions
        id={q.id}
        number={q.paymentRequestNumber}
        status={q.status}
        isRequester={isRequester}
        isAccountant={isAccountant}
        verified={!!q.verifiedById}
      />

      <div className="overflow-x-auto card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="th">
              <th className="w-8 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">{t("lineDesc")}</th>
              <th className="px-3 py-2.5 text-right">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 text-grey">{i + 1}</td>
                <td className="px-3 py-2.5">
                  {l.invoice ? (
                    <Link href={`/invoices/${l.invoice.id}`} className="text-navy hover:underline">{l.description}</Link>
                  ) : (
                    l.description
                  )}
                  {l.invoice ? <span className="ml-2 rounded bg-grey/10 px-1.5 py-0.5 text-[10px] font-bold text-grey">{l.invoice.paymentStatus}</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right font-medium">{Number(decToString(l.amount, 0)).toLocaleString("en-US")} ₫</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="label">{t("tabApprovals")}</h3>
          {steps.length === 0 ? <p className="text-sm text-grey">{t("approvalsPending")}</p> : <ApprovalTimeline steps={timelineSteps} />}
          {myTurn ? <DecideInline entityType="PAYMENT_REQUEST" entityId={q.id} refLabel={q.paymentRequestNumber} /> : null}
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
        <div className="card p-4">
          <h3 className="label">{t("attachments")}</h3>
          <PrAttachments
            entityId={q.id}
            entityType="PaymentRequest"
            refreshPath={`/payment-requests/${q.id}`}
            attachments={attRows}
            canUpload={(isRequester && ["DRAFT", "SUBMITTED"].includes(q.status)) || isAccountant}
          />
        </div>
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
