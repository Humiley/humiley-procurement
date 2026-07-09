import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { RfqForm, type RfqFormLine, type RfqFormOpt } from "@/components/rfq/RfqForm";

/** §8: new RFQ — standalone or prefilled from an APPROVED PR via ?fromPr=<id>. */
export default async function NewRfqPage({ searchParams }: { searchParams: { fromPr?: string } }) {
  await requireRoles("PURCHASER", "ADMIN");
  const tc = await getTranslations("common");

  const [vendors, uoms] = await Promise.all([
    db.vendor.findMany({ where: { status: "APPROVED" }, orderBy: { code: "asc" } }),
    db.uom.findMany({ orderBy: { code: "asc" } }),
  ]);

  let fromPr: { id: string; label: string } | null = null;
  let initialLines: RfqFormLine[] = [];
  if (searchParams.fromPr) {
    const pr = await db.purchaseRequisition.findUnique({
      where: { id: searchParams.fromPr },
      include: { lines: { include: { item: { select: { code: true, nameEn: true } } } } },
    });
    if (pr && pr.status === "APPROVED") {
      fromPr = { id: pr.id, label: pr.prNumber };
      initialLines = pr.lines.map((l) => ({
        itemId: l.itemId,
        description: l.item ? `${l.item.code} · ${l.item.nameEn}` : l.freeTextDescription || "",
        uomId: l.uomId,
        qty: decToString(l.qty, 4) ?? "1",
      }));
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/rfqs" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <RfqForm
        vendors={vendors.map((v): RfqFormOpt => ({ id: v.id, label: `${v.code} · ${v.nameEn}` }))}
        uoms={uoms.map((u): RfqFormOpt => ({ id: u.id, label: u.code }))}
        fromPr={fromPr}
        initialLines={initialLines}
      />
    </div>
  );
}
