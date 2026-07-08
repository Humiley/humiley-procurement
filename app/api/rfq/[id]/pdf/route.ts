import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/rbac";
import { rfqPdfData } from "@/lib/pdf/rfq-data";
import { RfqPdf } from "@/lib/pdf/RfqPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per-vendor RFQ PDF (§8): /api/rfq/<id>/pdf?vendor=<vendorId>. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const vendorId = new URL(req.url).searchParams.get("vendor");
  if (!vendorId) return NextResponse.json({ error: "vendor query param required" }, { status: 400 });
  const data = await rfqPdfData(params.id, vendorId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await renderToBuffer(React.createElement(RfqPdf, { d: data }) as never);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.rfqNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
