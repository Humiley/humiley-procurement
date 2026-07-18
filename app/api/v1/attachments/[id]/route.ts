import { NextResponse } from "next/server";
import { currentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";
import { canAccessAttachment } from "@/lib/attachment-authz";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const att = await db.attachment.findUnique({ where: { id: params.id } });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessAttachment(user, att))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buf = await readStored(att.storagePath);
    // Never render a client-supplied MIME inline from our own origin — an uploaded text/html or
    // image/svg+xml (with <script>) would otherwise execute in the app origin when a privileged user
    // opens it (stored XSS). Only a safe allowlist previews inline (with a sanitised type); everything
    // else is forced to download as octet-stream. nosniff blocks MIME-sniffing either way.
    const SAFE_INLINE = new Set([
      "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain",
    ]);
    const stored = (att.mimeType || "").toLowerCase().split(";")[0].trim();
    const inlineOk = SAFE_INLINE.has(stored);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": inlineOk ? stored : "application/octet-stream",
        "Content-Disposition": `${inlineOk ? "inline" : "attachment"}; filename="${encodeURIComponent(att.fileName)}"`,
        "Content-Length": String(att.sizeBytes),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
