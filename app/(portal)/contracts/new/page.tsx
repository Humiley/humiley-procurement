import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ContractForm, type CtrOpt } from "@/components/contracts/ContractForm";

/** §9: new framework agreement. PURCHASER/ADMIN. */
export default async function NewContractPage() {
  await requireRoles("PURCHASER", "ADMIN");

  const [vendors, items] = await Promise.all([
    db.vendor.findMany({ where: { status: "APPROVED" }, orderBy: { code: "asc" } }),
    db.item.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <ContractForm
      vendors={vendors.map((v): CtrOpt => ({ id: v.id, label: `${v.code} · ${v.nameEn}` }))}
      items={items.map((i): CtrOpt => ({ id: i.id, label: `${i.code} · ${i.nameEn}` }))}
    />
  );
}
