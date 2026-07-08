import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * §6 notifications — in-app (Notification rows, surfaced by the topbar bell) + best-effort
 * email. Email uses SMTP_* from .env when configured; otherwise it logs to the server console
 * (dev transport) so flows stay fully testable without a mail server.
 */

export type NotifyPayload = {
  titleEn: string;
  titleVn: string;
  bodyEn?: string;
  bodyVn?: string;
  link?: string;
};

let _transport: nodemailer.Transporter | null | undefined;
function mailTransport() {
  if (_transport !== undefined) return _transport;
  _transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : null;
  return _transport;
}

async function sendMail(to: string, subject: string, text: string) {
  await sendMailRaw({ to, subject, text });
}

/** Full-control mail (attachments, CC) — e.g. the PO PDF to a vendor. Dev-logs when SMTP is unset. */
export async function sendMailRaw(msg: {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const t = mailTransport();
  if (!t) {
    console.log(
      `[mail:dev] to=${msg.to}${msg.cc ? ` cc=${msg.cc}` : ""} subject="${msg.subject}"` +
        (msg.attachments?.length ? ` attachments=[${msg.attachments.map((a) => a.filename).join(", ")}]` : "") +
        `\n${msg.text}`,
    );
    return;
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || "procurement@humiley.com", ...msg });
  } catch (e) {
    console.warn(`[mail] send failed to ${msg.to}:`, e instanceof Error ? e.message : e);
  }
}

/** Notify one user: in-app row + email (bilingual body EN over VN). */
export async function notifyUser(userId: string, p: NotifyPayload) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return;
  await db.notification.create({
    data: {
      userId,
      titleEn: p.titleEn,
      titleVn: p.titleVn,
      bodyEn: p.bodyEn || null,
      bodyVn: p.bodyVn || null,
      link: p.link || null,
    },
  });
  const base = process.env.APP_URL || "";
  await sendMail(
    user.email,
    p.titleEn,
    [p.bodyEn, p.bodyVn, p.link ? `${base}${p.link}` : ""].filter(Boolean).join("\n\n"),
  );
}

/** Notify every active user holding a role (e.g. ADMIN alerts). */
export async function notifyRole(role: Role, p: NotifyPayload) {
  const users = await db.user.findMany({
    where: { isActive: true, roles: { has: role } },
    select: { id: true },
  });
  await Promise.all(users.map((u) => notifyUser(u.id, p)));
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}
