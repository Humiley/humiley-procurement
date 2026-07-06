import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import {
  MasterDataManager,
  type FieldDef,
  type MdRow,
  type MdColumnSpec,
} from "@/components/admin/MasterDataManager";
import { ExcelImportButton } from "@/components/admin/ExcelImportButton";
import { createItem, updateItem } from "@/app/(portal)/admin/masterdata.actions";

export default async function ItemsPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("admin.md");
  const f = await getTranslations("admin.md.fields");
  const common = await getTranslations("common");

  const [items, categories, uoms] = await Promise.all([
    db.item.findMany({
      orderBy: { code: "asc" },
      include: {
        category: { select: { code: true, nameEn: true } },
        uom: { select: { code: true } },
      },
    }),
    db.category.findMany({ orderBy: { code: "asc" } }),
    db.uom.findMany({ orderBy: { code: "asc" } }),
  ]);

  const rows: MdRow[] = items.map((i) => ({
    id: i.id,
    code: i.code,
    nameEn: i.nameEn,
    nameVn: i.nameVn,
    categoryId: i.categoryId,
    categoryName: `${i.category.code} · ${i.category.nameEn}`,
    uomId: i.uomId,
    uomCode: i.uom.code,
    specDescription: i.specDescription ?? "",
    lastPriceVnd: decToString(i.lastPriceVnd, 0) ?? "",
    isLotTracked: i.isLotTracked,
    isActive: i.isActive,
  }));

  const columns: MdColumnSpec[] = [
    { key: "code", header: f("code"), sortable: true },
    { key: "nameEn", header: f("nameEn"), sortable: true },
    { key: "categoryName", header: f("category") },
    { key: "uomCode", header: f("uom"), align: "center" },
    { key: "lastPriceVnd", header: f("price"), kind: "money" },
    {
      key: "isActive",
      header: f("active"),
      kind: "bool",
      boolTrue: common("yes"),
      boolFalse: common("no"),
    },
  ];

  const fields: FieldDef[] = [
    { key: "code", label: f("code"), type: "text", required: true },
    { key: "nameEn", label: f("nameEn"), type: "text", required: true },
    { key: "nameVn", label: f("nameVn"), type: "text", required: true },
    {
      key: "categoryId",
      label: f("category"),
      type: "select",
      required: true,
      options: categories.map((c) => ({ value: c.id, label: `${c.code} · ${c.nameEn}` })),
    },
    {
      key: "uomId",
      label: f("uom"),
      type: "select",
      required: true,
      options: uoms.map((u) => ({ value: u.id, label: `${u.code} · ${u.nameEn}` })),
    },
    { key: "specDescription", label: f("spec"), type: "textarea" },
    { key: "lastPriceVnd", label: f("price"), type: "number" },
    { key: "isLotTracked", label: f("lotTracked"), type: "checkbox" },
    { key: "isActive", label: f("active"), type: "checkbox" },
  ];

  return (
    <MasterDataManager
      title={t("items.title")}
      subtitle={t("items.subtitle")}
      newLabel={t("items.new")}
      fields={fields}
      rows={rows}
      columns={columns}
      exportFileName="items"
      createAction={createItem}
      updateAction={updateItem}
      extraToolbar={
        <ExcelImportButton
          kind="items"
          label={t("items.import")}
          templateHeaders={["code", "nameEn", "nameVn", "categoryCode", "uomCode", "specDescription", "lastPriceVnd", "isLotTracked"]}
        />
      }
    />
  );
}
