"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { EntityLink } from "@/components/shared/EntityLink";

export type ContractRow = {
  id: string;
  contractNumber: string;
  vendorCode: string;
  vendorName: string;
  title: string;
  startDate: string;
  endDate: string;
  expiring: boolean;
  daysLeft: number;
  value: string;
  poCount: number;
  status: string;
};

export function ContractList({ rows, canCreate }: { rows: ContractRow[]; canCreate: boolean }) {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<ContractRow>[] = [
    { key: "contractNumber", header: t("colNo"), sortable: true, render: (r) => <EntityLink href={`/contracts/${r.id}`} number={r.contractNumber} /> },
    { key: "vendor", header: t("vendor"), value: (r) => `${r.vendorCode} ${r.vendorName}`, render: (r) => <span>{r.vendorCode} <span className="text-grey">· {r.vendorName}</span></span> },
    { key: "title", header: t("title"), className: "max-w-[220px] truncate" },
    {
      key: "validity",
      header: t("validity"),
      className: "whitespace-nowrap",
      value: (r) => r.startDate,
      render: (r) => (
        <span>
          {r.startDate} → {r.endDate}
          {r.expiring ? <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{t("expiresIn", { days: r.daysLeft })}</span> : null}
        </span>
      ),
    },
    { key: "value", header: t("value"), align: "right", value: (r) => Number(r.value) || 0, render: (r) => <VndDisplay value={r.value} /> },
    { key: "poCount", header: t("colPos"), align: "right", value: (r) => r.poCount, render: (r) => <span className="tabular-nums">{r.poCount}</span> },
    { key: "status", header: t("colStatus"), value: (r) => r.status, render: (r) => <StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} /> },
  ];

  const tabs: ListTab<ContractRow>[] = [
    { key: "all", label: tc("all") },
    { key: "ACTIVE", label: st("ACTIVE"), predicate: (r) => r.status === "ACTIVE" },
    { key: "EXPIRED", label: st("EXPIRED"), predicate: (r) => r.status === "EXPIRED" },
    { key: "TERMINATED", label: st("TERMINATED"), predicate: (r) => r.status === "TERMINATED" },
    { key: "DRAFT", label: st("DRAFT"), predicate: (r) => r.status === "DRAFT" },
  ];

  return (
    <DocListPage
      title={t("listTitle")}
      newHref={canCreate ? "/contracts/new" : undefined}
      newLabel={t("newButton")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="contracts"
    />
  );
}
