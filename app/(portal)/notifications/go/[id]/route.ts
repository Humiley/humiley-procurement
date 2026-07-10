import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { withBase } from "@/lib/base-path";

/**
 * Notification click-through: mark the notification read, THEN land on its document.
 * Rows link here instead of directly to `link` so opening a notification clears it
 * from the unread count (previously reading one never marked it read).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const n = await db.notification.findFirst({ where: { id: params.id, userId: user.id } });
  if (n && !n.isRead) {
    await db.notification.update({ where: { id: n.id }, data: { isRead: true } });
  }
  // req.url carries the basePath in its path; an absolute path in new URL() would drop it, so
  // prefix the stored (root-relative) link with the basePath.
  return NextResponse.redirect(new URL(withBase(n?.link || "/notifications"), req.url));
}
