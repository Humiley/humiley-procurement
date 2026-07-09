import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";

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
  return NextResponse.redirect(new URL(n?.link || "/notifications", req.url));
}
