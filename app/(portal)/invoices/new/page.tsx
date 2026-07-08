import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { InvoiceForm, type InvPoLine, type InvPoOpt } from "@/components/invoice/InvoiceForm";

/** §9: new invoice — lines default from received-not-yet-invoiced at PO prices (?po=<id>). */
export default async function NewInvoicePage({ searchParams }: { searchParams: { po?: string } }) {
  await requireRoles("ACCOUNTANT", "ADMIN");

  const pos = await db.purchaseOrder.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_RECEIVED", "RECEIVED"] } },
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { code: true } } },
  });

  let lines: InvPoLine[] = [];
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
          poPrice: decToString(l.unitPrice, 2) ?? "0",
          toInvoice: decToString(new Prisma.Decimal(l.receivedQty).minus(l.invoicedQty), 4) ?? "0",
        }))
        .filter((l) => Number(l.toInvoice) > 0);
    }
  }

  return (
    <InvoiceForm
      pos={pos.map((p): InvPoOpt => ({ id: p.id, label: `${p.poNumber} · ${p.vendor.code}` }))}
      selectedPoId={searchParams.po || null}
      lines={lines}
    />
  );
}
