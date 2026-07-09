import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ContractForm, type CtrOpt } from "@/components/contracts/ContractForm";

/** §9: new framework agreement. PURCHASER/ADMIN. */
export default async function NewContractPage() {
  await requireRoles("PURCHASER", "ADMIN");
  const tc = await getTranslations("common");

  const [vendors, items] = await Promise.all([
    db.vendor.findMany({ where: { status: "APPROVED" }, orderBy: { code: "asc" } }),
    db.item.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/contracts" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <ContractForm
        vendors={vendors.map((v): CtrOpt => ({ id: v.id, label: `${v.code} · ${v.nameEn}` }))}
        items={items.map((i): CtrOpt => ({ id: i.id, label: `${i.code} · ${i.nameEn}` }))}
      />
    </div>
  );
}
