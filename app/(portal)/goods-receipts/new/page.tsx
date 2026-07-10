import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString, formatQty } from "@/lib/money";
import { GrnForm, type GrnPoLine, type GrnPoOpt } from "@/components/grn/GrnForm";

/** §9: new GRN — pick an open PO (?po=<id>), outstanding quantities shown per line. */
export default async function NewGrnPage({ searchParams }: { searchParams: { po?: string } }) {
  await requireRoles("WAREHOUSE", "ADMIN");
  const tc = await getTranslations("common");

  const [openPos, warehouses] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_RECEIVED"] } },
      orderBy: { createdAt: "desc" },
      include: { vendor: { select: { code: true } } },
    }),
    db.warehouse.findMany({ orderBy: { code: "asc" } }),
  ]);

  // §22 prerequisite empty state: nothing to receive without an open (SENT/PARTIALLY_RECEIVED) PO.
  if (openPos.length === 0) {
    const tp = await getTranslations("prereq");
    return (
      <div className="space-y-4">
        <Link href="/goods-receipts" className="btn-ghost -ml-3 w-fit">
          <ArrowLeft className="h-4 w-4" /> {tc("back")}
        </Link>
        <div className="card mx-auto max-w-lg p-6 text-center">
          <h1 className="page-title">{tp("title")}</h1>
          <p className="mt-2 text-sm text-grey">{tp("grnBody")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link href="/goods-receipts" className="btn-ghost">{tp("backToList")}</Link>
          </div>
        </div>
      </div>
    );
  }

  let lines: GrnPoLine[] = [];
  if (searchParams.po) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: searchParams.po },
      include: { lines: { include: { uom: { select: { code: true } } } } },
    });
    if (po) {
      lines = po.lines
        .map((l) => ({
          poLineId: l.id,
          description: l.description,
          uom: l.uom.code,
          ordered: formatQty(l.qty),
          outstanding: decToString(new Prisma.Decimal(l.qty).minus(l.receivedQty), 4) ?? "0",
        }))
        .filter((l) => Number(l.outstanding) > 0);
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/goods-receipts" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <GrnForm
        pos={openPos.map((p): GrnPoOpt => ({ id: p.id, label: `${p.poNumber} · ${p.vendor.code}` }))}
        warehouses={warehouses.map((w): GrnPoOpt => ({ id: w.id, label: `${w.code} · ${w.nameEn}` }))}
        selectedPoId={searchParams.po || null}
        lines={lines}
      />
    </div>
  );
}
