import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  MasterDataManager,
  type FieldDef,
  type MdRow,
  type MdColumnSpec,
} from "@/components/admin/MasterDataManager";
import { createCostCenter, updateCostCenter } from "@/app/(portal)/admin/masterdata.actions";

export default async function CostCentersPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("admin.md");
  const f = await getTranslations("admin.md.fields");

  const [costCenters, departments] = await Promise.all([
    db.costCenter.findMany({
      orderBy: { code: "asc" },
      include: { department: { select: { code: true, nameEn: true } } },
    }),
    db.department.findMany({ orderBy: { code: "asc" } }),
  ]);

  const rows: MdRow[] = costCenters.map((c) => ({
    id: c.id,
    code: c.code,
    nameEn: c.nameEn,
    nameVn: c.nameVn,
    departmentId: c.departmentId,
    departmentName: `${c.department.code} · ${c.department.nameEn}`,
  }));

  const columns: MdColumnSpec[] = [
    { key: "code", header: f("code"), sortable: true },
    { key: "nameEn", header: f("nameEn"), sortable: true },
    { key: "nameVn", header: f("nameVn") },
    { key: "departmentName", header: f("department") },
  ];

  const fields: FieldDef[] = [
    { key: "code", label: f("code"), type: "text", required: true },
    { key: "nameEn", label: f("nameEn"), type: "text", required: true },
    { key: "nameVn", label: f("nameVn"), type: "text", required: true },
    {
      key: "departmentId",
      label: f("department"),
      type: "select",
      required: true,
      options: departments.map((d) => ({ value: d.id, label: `${d.code} · ${d.nameEn}` })),
    },
  ];

  return (
    <MasterDataManager
      title={t("costCenters.title")}
      subtitle={t("costCenters.subtitle")}
      newLabel={t("costCenters.new")}
      fields={fields}
      rows={rows}
      columns={columns}
      exportFileName="cost-centers"
      createAction={createCostCenter}
      updateAction={updateCostCenter}
    />
  );
}
