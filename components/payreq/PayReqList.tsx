"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { EntityLink } from "@/components/shared/EntityLink";

export type PayReqRow = {
  id: string;
  paymentRequestNumber: string;
  type: string;
  payeeName: string;
  vendorCode: string;
  requesterName: string;
  dueDate: string;
  amount: string;
  status: string;
};

export function PayReqList({ rows }: { rows: PayReqRow[] }) {
  const t = useTranslations("payreq");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<PayReqRow>[] = [
    { key: "paymentRequestNumber", header: t("colNo"), sortable: true, render: (r) => <EntityLink href={`/payment-requests/${r.id}`} number={r.paymentRequestNumber} /> },
    { key: "type", header: t("colType"), value: (r) => r.type, render: (r) => <span>{t(`type.${r.type}`)}</span> },
    { key: "payeeName", header: t("colPayee"), className: "max-w-[200px] truncate", value: (r) => `${r.payeeName} ${r.vendorCode}`, render: (r) => <span>{r.payeeName}{r.vendorCode ? <span className="text-xs text-grey"> · {r.vendorCode}</span> : null}</span> },
    { key: "requesterName", header: t("colRequester") },
    { key: "dueDate", header: t("dueDate"), sortable: true },
    { key: "amount", header: t("amount"), align: "right", value: (r) => Number(r.amount) || 0, render: (r) => <VndDisplay value={r.amount} /> },
    { key: "status", header: t("colStatus"), value: (r) => r.status, render: (r) => <StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} /> },
  ];

  const tabs: ListTab<PayReqRow>[] = [
    { key: "all", label: tc("all") },
    { key: "DRAFT", label: st("DRAFT"), predicate: (r) => r.status === "DRAFT" },
    { key: "SUBMITTED", label: st("SUBMITTED"), predicate: (r) => r.status === "SUBMITTED" },
    { key: "APPROVED", label: st("APPROVED"), predicate: (r) => r.status === "APPROVED" },
    { key: "PAID", label: st("PAID"), predicate: (r) => r.status === "PAID" },
    { key: "REJECTED", label: st("REJECTED"), predicate: (r) => r.status === "REJECTED" },
  ];

  return (
    <DocListPage
      title={t("listTitle")}
      newHref="/payment-requests/new"
      newLabel={t("newButton")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="payment-requests"
    />
  );
}
