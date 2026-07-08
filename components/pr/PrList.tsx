"use client";

import { useTranslations } from "next-intl";
import { DocListPage, type ListColumn, type ListTab } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { EntityLink } from "@/components/shared/EntityLink";

export type PrRow = {
  id: string;
  prNumber: string;
  purpose: string;
  departmentName: string;
  costCenterName: string;
  neededBy: string;
  total: string;
  status: string;
  requesterName: string;
};

export function PrList({ rows }: { rows: PrRow[] }) {
  const t = useTranslations("pr");
  const tc = useTranslations("common");
  const st = useTranslations("status");

  const columns: ListColumn<PrRow>[] = [
    {
      key: "prNumber",
      header: t("number"),
      sortable: true,
      render: (r) => <EntityLink href={`/requisitions/${r.id}`} number={r.prNumber} />,
    },
    { key: "purpose", header: t("purpose") },
    { key: "requesterName", header: t("requester") },
    { key: "departmentName", header: t("department") },
    { key: "neededBy", header: t("neededBy"), sortable: true },
    {
      key: "total",
      header: t("total"),
      align: "right",
      value: (r) => Number(r.total) || 0,
      render: (r) => <VndDisplay value={r.total} />,
    },
    {
      key: "status",
      header: tc("status"),
      value: (r) => r.status,
      render: (r) => (
        <StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} />
      ),
    },
  ];

  const tabs: ListTab<PrRow>[] = [
    { key: "all", label: tc("all") },
    { key: "DRAFT", label: st("DRAFT"), predicate: (r) => r.status === "DRAFT" },
    { key: "SUBMITTED", label: st("SUBMITTED"), predicate: (r) => r.status === "SUBMITTED" },
    { key: "APPROVED", label: st("APPROVED"), predicate: (r) => r.status === "APPROVED" },
    { key: "REJECTED", label: st("REJECTED"), predicate: (r) => r.status === "REJECTED" },
  ];

  return (
    <DocListPage
      title={t("title")}
      subtitle={t("subtitle")}
      newHref="/requisitions/new"
      newLabel={t("new")}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      tabs={tabs}
      searchPlaceholder={tc("search")}
      exportLabel={tc("export")}
      exportFileName="requisitions"
    />
  );
}
