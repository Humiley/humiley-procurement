"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { EntityLink } from "@/components/shared/EntityLink";

export type PoRow = {
  id: string;
  poNumber: string;
  vendor: string;
  prNumber: string;
  expectedDate: string;
  total: string;
  status: string;
};

export function PoList({ rows, canCreate }: { rows: PoRow[]; canCreate: boolean }) {
  const t = useTranslations("po");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<PoRow>[] = [
    { key: "poNumber", header: t("colNo"), sortable: true, render: (r) => <EntityLink href={`/purchase-orders/${r.id}`} number={r.poNumber} /> },
    { key: "vendor", header: t("vendor") },
    { key: "prNumber", header: t("colPr"), className: "text-xs tabular-nums" },
    { key: "expectedDate", header: t("expectedDate"), sortable: true },
    { key: "total", header: t("total"), align: "right", value: (r) => Number(r.total) || 0, render: (r) => <VndDisplay value={r.total} /> },
    { key: "status", header: t("colStatus"), value: (r) => r.status, render: (r) => <StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} /> },
  ];

  const tabs: ListTab<PoRow>[] = [
    { key: "all", label: tc("all") },
    { key: "DRAFT", label: st("DRAFT"), predicate: (r) => r.status === "DRAFT" },
    { key: "SENT", label: st("SENT"), predicate: (r) => r.status === "SENT" },
    { key: "PARTIALLY_RECEIVED", label: st("PARTIALLY_RECEIVED"), predicate: (r) => r.status === "PARTIALLY_RECEIVED" },
    { key: "RECEIVED", label: st("RECEIVED"), predicate: (r) => r.status === "RECEIVED" },
    { key: "CLOSED", label: st("CLOSED"), predicate: (r) => r.status === "CLOSED" },
  ];

  return (
    <DocListPage
      title={t("listTitle")}
      newHref={canCreate ? "/purchase-orders/new" : undefined}
      newLabel={t("newButton")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="purchase-orders"
    />
  );
}
