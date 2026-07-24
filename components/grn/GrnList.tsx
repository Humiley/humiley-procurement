"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityLink } from "@/components/shared/EntityLink";

export type GrnRow = {
  id: string;
  grnNumber: string;
  po: string;
  warehouse: string;
  receivedBy: string;
  receivedDate: string;
  qty: number;
  status: string;
};

export function GrnList({ rows, canCreate }: { rows: GrnRow[]; canCreate: boolean }) {
  const t = useTranslations("grn");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<GrnRow>[] = [
    { key: "grnNumber", header: t("colNo"), sortable: true, render: (r) => <EntityLink href={`/goods-receipts/${r.id}`} number={r.grnNumber} /> },
    { key: "po", header: t("po"), className: "text-xs tabular-nums" },
    { key: "warehouse", header: t("warehouse") },
    { key: "receivedBy", header: t("receivedBy") },
    { key: "receivedDate", header: t("colDate"), sortable: true },
    { key: "qty", header: t("colQty"), align: "right", value: (r) => r.qty, render: (r) => <span className="tabular-nums">{r.qty.toLocaleString("en-US")}</span> },
    { key: "status", header: t("colStatus"), value: (r) => r.status, render: (r) => <StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} /> },
  ];

  const tabs: ListTab<GrnRow>[] = [
    { key: "all", label: tc("all") },
    { key: "DRAFT", label: st("DRAFT"), predicate: (r) => r.status === "DRAFT" },
    { key: "QC_PENDING", label: st("QC_PENDING"), predicate: (r) => r.status === "QC_PENDING" },
    { key: "ACCEPTED", label: st("ACCEPTED"), predicate: (r) => r.status === "ACCEPTED" },
    { key: "PARTIALLY_REJECTED", label: st("PARTIALLY_REJECTED"), predicate: (r) => r.status === "PARTIALLY_REJECTED" },
    { key: "REJECTED", label: st("REJECTED"), predicate: (r) => r.status === "REJECTED" },
  ];

  return (
    <DocListPage
      title={t("listTitle")}
      newHref={canCreate ? "/goods-receipts/new" : undefined}
      newLabel={t("newButton")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="goods-receipts"
    />
  );
}
