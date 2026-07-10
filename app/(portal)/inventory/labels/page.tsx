import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { barcodeDataUri } from "@/lib/barcode";
import { formatVnDate } from "@/lib/dates";
import { PrintButton } from "@/components/inv/PrintButton";

/**
 * §21 label batch print — all lot labels of a GRN (?grn=) or one lot (?lot=), sized 50×30 mm
 * for Zebra stock via @media print CSS. QR payload is the lot barcode code (LOT:<number>).
 */
export default async function LabelsPage({ searchParams }: { searchParams: { grn?: string; lot?: string } }) {
  await requireUser();
  const t = await getTranslations("labels");

  const lots = await db.lot.findMany({
    where: searchParams.grn ? { grnId: searchParams.grn } : searchParams.lot ? { id: searchParams.lot } : { id: "-" },
    include: {
      item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } },
      grn: { select: { grnNumber: true, po: { select: { poNumber: true } } } },
      barcodes: { where: { type: "LOT" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  const labels = await Promise.all(
    lots.map(async (lot) => ({
      lot,
      qr: await barcodeDataUri(lot.barcodes[0]?.code ?? `LOT:${lot.lotNumber}`, "QR"),
    })),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href="/inventory" className="text-sm text-grey hover:text-navy">← {t("back")}</Link>
        <h1 className="page-title">{t("title")}</h1>
        <span className="flex-1" />
        {labels.length > 0 ? <PrintButton label={t("print")} /> : null}
      </div>

      {labels.length === 0 ? (
        <p className="card p-6 text-sm text-grey print:hidden">{t("empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {labels.map(({ lot, qr }) => (
            <div
              key={lot.id}
              className="label-50x30 flex w-[50mm] items-center gap-2 rounded border border-line bg-white p-2"
              style={{ height: "30mm", breakInside: "avoid" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={lot.lotNumber} className="h-[24mm] w-[24mm]" />
              <div className="min-w-0 text-[8pt] leading-tight">
                <div className="font-bold">{lot.lotNumber}</div>
                <div className="truncate">{lot.item.code}</div>
                <div className="truncate text-[7pt]">{lot.item.nameEn}</div>
                {lot.expiryDate ? <div className="font-semibold">EXP {formatVnDate(lot.expiryDate)}</div> : null}
                <div className="text-[7pt]">{lot.grn?.grnNumber ?? ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
