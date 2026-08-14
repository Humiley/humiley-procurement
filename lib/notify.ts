import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * §6 notifications — in-app (Notification rows, surfaced by the topbar bell) + best-effort
 * email. Email uses SMTP_* from .env when configured; otherwise it logs to the server console
 * (dev transport) so flows stay fully testable without a mail server.
 */

export type { NotifyPayload } from "@/lib/email-shell";

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

import { emailShell, textEmail, notifyEmailHtml, EMAIL_LOGO_CID } from "@/lib/email-shell";
import type { NotifyPayload } from "@/lib/email-shell";
export { emailShell, textEmail, notifyEmailHtml, EMAIL_LOGO_CID };

let _logoBuf: Buffer | null | undefined;
function logoBuffer(): Buffer | null {
  if (_logoBuf !== undefined) return _logoBuf;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    _logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "brand", "Humiley_Logo_White.png"));
  } catch {
    _logoBuf = null;   // missing asset degrades to the styled alt text, never a broken-image box
  }
  return _logoBuf;
}

export async function sendMailRaw(msg: {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  /** Body markup. Omit and the plain text is rendered in the brand frame for you. */
  html?: string;
  /** Set for mail that must stay plain (machine-read, or a deliberate exception). */
  plain?: boolean;
  attachments?: { filename: string; content: Buffer; cid?: string }[];
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
  const { plain, ...rest } = msg;
  // Every email leaves in the company frame unless it explicitly opts out. `text` is kept as the
  // plain-text alternative, so a text-only client still gets a readable message rather than markup.
  const html = plain ? undefined : msg.html || textEmail(msg.text);
  const attachments = [...(msg.attachments || [])];
  // The mark rides along inline, and only when the body actually references it — an email with no
  // logo should not arrive wearing a paperclip.
  const logo = html && html.includes(`cid:${EMAIL_LOGO_CID}`) ? logoBuffer() : null;
  if (logo) {
    attachments.push({ filename: "humiley-logo.png", content: logo, cid: EMAIL_LOGO_CID });
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "procurement@humiley.com",
      ...rest,
      html,
      attachments: attachments.length ? attachments : undefined,
    });
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
  const url = p.link ? `${base}${p.link}` : "";
  await sendMailRaw({
    to: user.email,
    subject: p.titleEn,
    // the plain-text alternative keeps the shape it always had, for text-only clients
    text: [p.titleEn, p.titleVn, p.bodyEn, p.bodyVn, url].filter(Boolean).join("\n\n"),
    html: notifyEmailHtml(p, url),
  });
}

/** Notify every active user holding a role (e.g. ADMIN alerts). */
export async function notifyRole(role: Role, p: NotifyPayload) {
  await notifyRoles([role], p);
}

/** Notify everyone holding ANY of these roles — each person ONCE.
 *
 *  `roles` is an array on User, so calling notifyRole twice for the same alert sends a Director who
 *  also purchases the identical email twice, and puts two rows in their bell. Passing the roles
 *  together dedups on the user, which is the only place the duplicate can be seen. */
export async function notifyRoles(roles: Role[], p: NotifyPayload) {
  const users = await db.user.findMany({
    where: { isActive: true, roles: { hasSome: roles } },
    select: { id: true },
  });
  await Promise.all(users.map((u) => notifyUser(u.id, p)));
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}
