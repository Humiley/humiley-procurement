import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString, formatQty } from "@/lib/money";
import { GrnForm, type GrnPoLine, type GrnPoOpt } from "@/components/grn/GrnForm";

/** §9: new GRN — pick an open PO (?po=<id>), outstanding quantities shown per line. */
export default async function NewGrnPage({ searchParams }: { searchParams: { po?: string } }) {
  await requireRoles("WAREHOUSE", "ADMIN");

  const [openPos, warehouses] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_RECEIVED"] } },
      orderBy: { createdAt: "desc" },
      include: { vendor: { select: { code: true } } },
    }),
    db.warehouse.findMany({ orderBy: { code: "asc" } }),
  ]);

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
    <GrnForm
      pos={openPos.map((p): GrnPoOpt => ({ id: p.id, label: `${p.poNumber} · ${p.vendor.code}` }))}
      warehouses={warehouses.map((w): GrnPoOpt => ({ id: w.id, label: `${w.code} · ${w.nameEn}` }))}
      selectedPoId={searchParams.po || null}
      lines={lines}
    />
  );
}
