import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  MasterDataManager,
  type FieldDef,
  type MdRow,
  type MdColumnSpec,
} from "@/components/admin/MasterDataManager";
import { ExcelImportButton } from "@/components/admin/ExcelImportButton";
import { createVendor, updateVendor } from "@/app/(portal)/vendors/actions";
import { VendorLifecyclePanel, type VendorLcRow } from "@/components/vendors/VendorLifecyclePanel";
import { BankConfirmPanel, type FrozenVendorRow } from "@/components/vendors/BankConfirmPanel";
import { hasAnyRole, requireUser } from "@/lib/rbac";

export default async function VendorsPage() {
  await requireRoles("ADMIN", "PURCHASER", "ACCOUNTANT", "DIRECTOR");
  const me = await requireUser();
  const t = await getTranslations("vendors");
  const f = await getTranslations("vendors.fields");
  const common = await getTranslations("common");

  const vendors = await db.vendor.findMany({ orderBy: { code: "asc" } });

  const rows: MdRow[] = vendors.map((v) => ({
    id: v.id,
    code: v.code,
    nameEn: v.nameEn,
    nameVn: v.nameVn,
    taxCode: v.taxCode ?? "",
    address: v.address ?? "",
    contactName: v.contactName ?? "",
    contactEmail: v.contactEmail ?? "",
    contactPhone: v.contactPhone ?? "",
    contact: [v.contactName, v.contactEmail].filter(Boolean).join(" · ") || "—",
    paymentTermDays: String(v.paymentTermDays),
    bankName: v.bankName ?? "",
    bankAccount: v.bankAccount ?? "",
    categories: v.categories.join(", "),
    status: v.status,
  }));

  const columns: MdColumnSpec[] = [
    { key: "code", header: f("code"), sortable: true },
    { key: "nameEn", header: f("nameEn"), sortable: true },
    { key: "taxCode", header: f("taxCode") },
    { key: "contact", header: f("contactName") },
    { key: "paymentTermDays", header: f("paymentTermDays"), align: "center" },
    { key: "status", header: common("status"), kind: "status", sortable: true },
  ];

  const fields: FieldDef[] = [
    { key: "code", label: f("code"), type: "text", required: true },
    { key: "nameEn", label: f("nameEn"), type: "text", required: true },
    { key: "nameVn", label: f("nameVn"), type: "text", required: true },
    { key: "taxCode", label: f("taxCode"), type: "text" },
    { key: "address", label: f("address"), type: "textarea" },
    { key: "contactName", label: f("contactName"), type: "text" },
    { key: "contactEmail", label: f("contactEmail"), type: "text" },
    { key: "contactPhone", label: f("contactPhone"), type: "text" },
    { key: "paymentTermDays", label: f("paymentTermDays"), type: "number" },
    { key: "bankName", label: f("bankName"), type: "text" },
    { key: "bankAccount", label: f("bankAccount"), type: "text" },
    { key: "categories", label: f("categories"), type: "text" },
  ];

  const lcRows: VendorLcRow[] = vendors.map((v) => ({ id: v.id, code: v.code, nameEn: v.nameEn, status: v.status }));
  const frozen = vendors.filter((v) => v.bankChangeFreeze);
  const changeLogs = frozen.length
    ? await db.auditLog.findMany({
        where: { entityType: "Vendor", entityId: { in: frozen.map((v) => v.id) }, action: "VENDOR_BANK_CHANGE" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      })
    : [];
  const frozenRows: FrozenVendorRow[] = frozen.map((v) => ({
    id: v.id,
    code: v.code,
    nameEn: v.nameEn,
    bankName: v.bankName,
    bankAccount: v.bankAccount,
    changedBy: changeLogs.find((l) => l.entityId === v.id)?.user?.name ?? null,
  }));

  return (
    <>
    <>
      <BankConfirmPanel rows={frozenRows} canConfirm={hasAnyRole(me, ["DIRECTOR", "ADMIN"])} />
      <VendorLifecyclePanel rows={lcRows} canManage={hasAnyRole(me, ["ADMIN", "PURCHASER", "DIRECTOR"])} />
    </>
    <MasterDataManager
      title={t("title")}
      subtitle={t("subtitle")}
      newLabel={t("new")}
      fields={fields}
      rows={rows}
      columns={columns}
      exportFileName="vendors"
      createAction={createVendor}
      updateAction={updateVendor}
      extraToolbar={
        <ExcelImportButton
          kind="vendors"
          label={t("import")}
          templateHeaders={["code", "nameEn", "nameVn", "taxCode", "contactName", "contactEmail", "contactPhone", "paymentTermDays", "bankName", "bankAccount", "categories"]}
        />
      }
    />
    </>
  );
}
