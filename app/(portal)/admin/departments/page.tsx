import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  MasterDataManager,
  type FieldDef,
  type MdRow,
  type MdColumnSpec,
} from "@/components/admin/MasterDataManager";
import { createDepartment, updateDepartment } from "@/app/(portal)/admin/masterdata.actions";

export default async function DepartmentsPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("admin.md");
  const f = await getTranslations("admin.md.fields");

  const [departments, users] = await Promise.all([
    db.department.findMany({
      orderBy: { code: "asc" },
      include: { manager: { select: { name: true } } },
    }),
    db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: MdRow[] = departments.map((d) => ({
    id: d.id,
    code: d.code,
    nameEn: d.nameEn,
    nameVn: d.nameVn,
    managerId: d.managerId ?? "",
    managerName: d.manager?.name ?? "—",
  }));

  const columns: MdColumnSpec[] = [
    { key: "code", header: f("code"), sortable: true },
    { key: "nameEn", header: f("nameEn"), sortable: true },
    { key: "nameVn", header: f("nameVn") },
    { key: "managerName", header: f("manager") },
  ];

  const fields: FieldDef[] = [
    { key: "code", label: f("code"), type: "text", required: true },
    { key: "nameEn", label: f("nameEn"), type: "text", required: true },
    { key: "nameVn", label: f("nameVn"), type: "text", required: true },
    {
      key: "managerId",
      label: f("manager"),
      type: "select",
      options: users.map((u) => ({ value: u.id, label: u.name })),
    },
  ];

  return (
    <MasterDataManager
      title={t("departments.title")}
      subtitle={t("departments.subtitle")}
      newLabel={t("departments.new")}
      fields={fields}
      rows={rows}
      columns={columns}
      exportFileName="departments"
      createAction={createDepartment}
      updateAction={updateDepartment}
    />
  );
}
