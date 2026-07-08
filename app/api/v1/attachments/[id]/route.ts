import { NextResponse } from "next/server";
import { currentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const att = await db.attachment.findUnique({ where: { id: params.id } });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buf = await readStored(att.storagePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": att.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
        "Content-Length": String(att.sizeBytes),
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
