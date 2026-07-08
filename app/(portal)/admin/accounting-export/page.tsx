import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { pendingExportCounts } from "@/app/(portal)/admin/export.actions";
import { ExportPanel } from "@/components/admin/ExportPanel";

/** §17 accounting export console (MISA/Bravo import batches). ACCOUNTANT/ADMIN. */
export default async function AccountingExportPage() {
  await requireRoles("ACCOUNTANT", "ADMIN");
  const t = await getTranslations("acctExport");
  const { invoices, payments, batches } = await pendingExportCounts();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/settings" className="text-sm text-grey hover:text-navy">← {t("back")}</Link>
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
      </div>
      <ExportPanel invoiceCount={invoices} paymentCount={payments} batches={batches} />
    </div>
  );
}
