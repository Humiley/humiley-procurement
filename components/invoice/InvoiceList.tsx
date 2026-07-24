"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { EntityLink } from "@/components/shared/EntityLink";

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  vendorInvoiceNo: string;
  vendorCode: string;
  poNumber: string;
  dueDate: string;
  total: string;
  matchStatus: string;
  paymentStatus: string;
  aging: string;
};

export function InvoiceList({ rows, canCreate }: { rows: InvoiceRow[]; canCreate: boolean }) {
  const t = useTranslations("invoice");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<InvoiceRow>[] = [
    { key: "invoiceNumber", header: t("colNo"), sortable: true, render: (r) => <EntityLink href={`/invoices/${r.id}`} number={r.invoiceNumber} /> },
    { key: "vendorInvoiceNo", header: t("vendorInvoiceNo"), className: "text-xs", value: (r) => `${r.vendorInvoiceNo} ${r.vendorCode}`, render: (r) => <span>{r.vendorInvoiceNo} <span className="text-grey">· {r.vendorCode}</span></span> },
    { key: "poNumber", header: t("po"), className: "text-xs tabular-nums" },
    { key: "dueDate", header: t("colDue"), sortable: true },
    { key: "total", header: t("colTotal"), align: "right", value: (r) => Number(r.total) || 0, render: (r) => <VndDisplay value={r.total} /> },
    { key: "matchStatus", header: t("colMatch"), value: (r) => r.matchStatus, render: (r) => <StatusBadge status={r.matchStatus} label={st.has(r.matchStatus) ? st(r.matchStatus) : r.matchStatus} /> },
    { key: "paymentStatus", header: t("colPayment"), value: (r) => r.paymentStatus, render: (r) => <StatusBadge status={r.paymentStatus} label={st.has(r.paymentStatus) ? st(r.paymentStatus) : r.paymentStatus} /> },
    { key: "aging", header: t("colAging"), className: "text-xs" },
  ];

  const tabs: ListTab<InvoiceRow>[] = [
    { key: "all", label: tc("all") },
    { key: "UNPAID", label: st("UNPAID"), predicate: (r) => r.paymentStatus === "UNPAID" },
    { key: "PARTIALLY_PAID", label: st("PARTIALLY_PAID"), predicate: (r) => r.paymentStatus === "PARTIALLY_PAID" },
    { key: "PAID", label: st("PAID"), predicate: (r) => r.paymentStatus === "PAID" },
  ];

  return (
    <DocListPage
      title={t("listTitle")}
      newHref={canCreate ? "/invoices/new" : undefined}
      newLabel={t("newButton")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="invoices"
    />
  );
}
