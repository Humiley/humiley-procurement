import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/rbac";
import { canViewPurchaseOrder } from "@/lib/doc-authz";
import { poPdfData } from "@/lib/pdf/po-data";
import { PoPdf } from "@/lib/pdf/PoPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Branded PO PDF (§8/§10) — server-rendered with Vietnamese-safe fonts (§22.4). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canViewPurchaseOrder(user, params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await poPdfData(params.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await renderToBuffer(React.createElement(PoPdf, { d: data }) as never);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.poNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
