import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  MasterDataManager,
  type FieldDef,
  type MdRow,
  type MdColumnSpec,
} from "@/components/admin/MasterDataManager";
import { createUom, updateUom } from "@/app/(portal)/admin/masterdata.actions";

export default async function UomPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("admin.md");
  const f = await getTranslations("admin.md.fields");

  const uoms = await db.uom.findMany({ orderBy: { code: "asc" } });

  const rows: MdRow[] = uoms.map((u) => ({
    id: u.id,
    code: u.code,
    nameEn: u.nameEn,
    nameVn: u.nameVn,
  }));

  const columns: MdColumnSpec[] = [
    { key: "code", header: f("code"), sortable: true },
    { key: "nameEn", header: f("nameEn"), sortable: true },
    { key: "nameVn", header: f("nameVn") },
  ];

  const fields: FieldDef[] = [
    { key: "code", label: f("code"), type: "text", required: true },
    { key: "nameEn", label: f("nameEn"), type: "text", required: true },
    { key: "nameVn", label: f("nameVn"), type: "text", required: true },
  ];

  return (
    <MasterDataManager
      title={t("uom.title")}
      subtitle={t("uom.subtitle")}
      newLabel={t("uom.new")}
      fields={fields}
      rows={rows}
      columns={columns}
      exportFileName="uom"
      createAction={createUom}
      updateAction={updateUom}
    />
  );
}
