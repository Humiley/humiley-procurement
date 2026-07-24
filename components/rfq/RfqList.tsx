"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityLink } from "@/components/shared/EntityLink";

export type RfqRow = {
  id: string;
  rfqNumber: string;
  title: string;
  prNumber: string;
  dueDate: string;
  quoteCount: number;
  vendorCount: number;
  status: string;
};

export function RfqList({ rows, canCreate }: { rows: RfqRow[]; canCreate: boolean }) {
  const t = useTranslations("rfq");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<RfqRow>[] = [
    { key: "rfqNumber", header: t("colNo"), sortable: true, render: (r) => <EntityLink href={`/rfqs/${r.id}`} number={r.rfqNumber} /> },
    { key: "title", header: t("title"), className: "max-w-[260px] truncate" },
    { key: "prNumber", header: t("colPr"), className: "text-xs tabular-nums" },
    { key: "dueDate", header: t("dueDate"), sortable: true },
    { key: "quotes", header: t("colQuotes"), align: "center", value: (r) => r.quoteCount, render: (r) => <span className="tabular-nums">{r.quoteCount} / {r.vendorCount}</span> },
    { key: "status", header: t("colStatus"), value: (r) => r.status, render: (r) => <StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} /> },
  ];

  const tabs: ListTab<RfqRow>[] = [
    { key: "all", label: tc("all") },
    { key: "DRAFT", label: st("DRAFT"), predicate: (r) => r.status === "DRAFT" },
    { key: "SENT", label: st("SENT"), predicate: (r) => r.status === "SENT" },
    { key: "CLOSED", label: st("CLOSED"), predicate: (r) => r.status === "CLOSED" },
    { key: "AWARDED", label: st("AWARDED"), predicate: (r) => r.status === "AWARDED" },
  ];

  return (
    <DocListPage
      title={t("listTitle")}
      newHref={canCreate ? "/rfqs/new" : undefined}
      newLabel={t("newButton")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="rfqs"
    />
  );
}
