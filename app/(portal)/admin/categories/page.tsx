import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  MasterDataManager,
  type FieldDef,
  type MdRow,
  type MdColumnSpec,
} from "@/components/admin/MasterDataManager";
import { createCategory, updateCategory } from "@/app/(portal)/admin/masterdata.actions";

export default async function CategoriesPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("admin.md");
  const f = await getTranslations("admin.md.fields");

  const categories = await db.category.findMany({
    orderBy: { code: "asc" },
    include: { parent: { select: { code: true, nameEn: true } } },
  });

  const rows: MdRow[] = categories.map((c) => ({
    id: c.id,
    code: c.code,
    nameEn: c.nameEn,
    nameVn: c.nameVn,
    parentId: c.parentId ?? "",
    parentName: c.parent ? `${c.parent.code} · ${c.parent.nameEn}` : "—",
    isCapex: c.isCapex,
  }));

  const columns: MdColumnSpec[] = [
    { key: "code", header: f("code"), sortable: true },
    { key: "nameEn", header: f("nameEn"), sortable: true },
    { key: "parentName", header: f("parent") },
    { key: "isCapex", header: f("capex"), kind: "flag", boolTrue: "CAPEX" },
  ];

  const fields: FieldDef[] = [
    { key: "code", label: f("code"), type: "text", required: true },
    { key: "nameEn", label: f("nameEn"), type: "text", required: true },
    { key: "nameVn", label: f("nameVn"), type: "text", required: true },
    {
      key: "parentId",
      label: f("parent"),
      type: "select",
      options: categories.map((c) => ({ value: c.id, label: `${c.code} · ${c.nameEn}` })),
    },
    { key: "isCapex", label: f("capex"), type: "checkbox" },
  ];

  return (
    <MasterDataManager
      title={t("categories.title")}
      subtitle={t("categories.subtitle")}
      newLabel={t("categories.new")}
      fields={fields}
      rows={rows}
      columns={columns}
      exportFileName="categories"
      createAction={createCategory}
      updateAction={updateCategory}
    />
  );
}
