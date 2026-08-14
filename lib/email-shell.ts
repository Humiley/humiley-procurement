/* The company brand frame for procurement email — PURE string building, no server imports, so it
   can be unit-tested directly. The send path (lib/notify.ts) supplies the logo bytes.

   Sibling implementations that must stay in step: app.py `_email_shell` and index.html
   `_tkMailShell` in the main portal. */

export type NotifyPayload = {
  titleEn: string;
  titleVn: string;
  bodyEn?: string;
  bodyVn?: string;
  link?: string;
};

/* ══════════ The frame ══════════
   The portal wraps its mail in a navy header with the REVERSE (all-white) mark; this app is a
   separate deployment with its own SMTP stack, so it carries its own copy of the same frame.
   Keep the two in step — app.py `_email_shell` / index.html `_tkMailShell` are the siblings.

   The logo rides as a `cid:` inline attachment, not a URL and not a data: URI: Outlook and OWA
   block remote images by default and Outlook's desktop renderer ignores base64 data: URIs. These
   emails go to SUPPLIERS on mail systems we do not control, so the most compatible option wins.

   Literal colours only. Mail clients do not resolve CSS custom properties. */
const BRAND = { navy: "#205090", emerald: "#00B060", ink: "#1F2937", mut: "#5C6470", line: "#E5E9F0", panel: "#F7F9FC" };
export const EMAIL_LOGO_CID = "humileylogo";

function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wrap body markup in the branded frame. `strap` is the small line under the logo. */
export function emailShell(inner: string, strap = "Procurement · Creating Sustainable Value") {
  return (
    `<div style="background:${BRAND.panel};padding:22px 0;font-family:Segoe UI,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BRAND.line};border-radius:14px;overflow:hidden">` +
    `<tr><td style="background:${BRAND.navy};padding:16px 26px">` +
    // the alt text is white too: it is all a client shows when it declines the image, and
    // unstyled it renders near-black on navy — the same defect one layer down.
    `<img src="cid:${EMAIL_LOGO_CID}" alt="Humiley" height="30" style="height:30px;width:auto;display:block;border:0;color:#ffffff;font:800 20px Segoe UI,Arial,sans-serif">` +
    `<div style="font:600 12px Segoe UI,Arial,sans-serif;color:#B5C8E5;margin-top:5px">${strap}</div></td></tr>` +
    `<tr><td style="height:4px;background:${BRAND.emerald}"></td></tr>` +
    inner +
    `<tr><td style="border-top:1px solid ${BRAND.line};padding:16px 26px">` +
    `<div style="font:700 13px Segoe UI,Arial,sans-serif;color:${BRAND.navy}">Humiley Group Inc.</div>` +
    `<div style="font:11px Segoe UI,Arial,sans-serif;color:${BRAND.mut};margin-top:2px">Creating Sustainable Value · Procurement</div>` +
    `</td></tr></table></td></tr></table></div>`
  );
}

/** A plain-text body rendered in the frame. The wording is untouched — copy that was written and
 *  reviewed as text does not silently change, it only gains a header. */
export function textEmail(text: string, strap?: string) {
  const paras = String(text || "")
    .split(/\n\s*\n/)
    .filter((s) => s.trim())
    .map(
      (pg) =>
        `<p style="font:14px/1.7 Segoe UI,Arial,sans-serif;color:${BRAND.ink};margin:0 0 14px">` +
        esc(pg.trim()).replace(/\n/g, "<br>") +
        `</p>`,
    )
    .join("");
  return emailShell(`<tr><td style="padding:24px 26px 10px">${paras}</td></tr>`, strap);
}

/** A letter in two languages, paired paragraph by paragraph.
 *
 *  English is the PRIMARY line and Vietnamese sits beneath it in the muted style — never the other
 *  way round (HML-BG-001). Suppliers here are mostly Vietnamese companies, and a purchase order is
 *  a commercial instruction: the person reading it should not have to translate it to know what
 *  they are being asked to confirm.
 *
 *  `en` and `vn` are split on blank lines and zipped, so the two languages stay adjacent instead of
 *  the reader meeting one full letter and then another.
 */
export function bilingualEmail(en: string, vn: string, strap?: string) {
  const split = (s: string) => String(s || "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const [E, V] = [split(en), split(vn)];
  const line = (s: string) => esc(s).replace(/\n/g, "<br>");
  let body = "";
  for (let i = 0; i < Math.max(E.length, V.length); i++) {
    if (E[i]) body += `<p style="font:14px/1.7 Segoe UI,Arial,sans-serif;color:${BRAND.ink};margin:0 0 2px">${line(E[i])}</p>`;
    if (V[i]) body += `<p style="font:13px/1.7 Segoe UI,Arial,sans-serif;color:${BRAND.mut};margin:0 0 14px">${line(V[i])}</p>`;
  }
  return emailShell(`<tr><td style="padding:24px 26px 10px">${body}</td></tr>`, strap);
}

/** The plain-text alternative for a bilingual letter — the same pairing, for text-only clients. */
export function bilingualText(en: string, vn: string) {
  const split = (s: string) => String(s || "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const [E, V] = [split(en), split(vn)];
  const out: string[] = [];
  for (let i = 0; i < Math.max(E.length, V.length); i++) {
    if (E[i]) out.push(E[i]);
    if (V[i]) out.push(V[i]);
  }
  return out.join("\n\n");
}

/** A bilingual notification: English heading, Vietnamese beneath, and a way back into the app. */
export function notifyEmailHtml(p: NotifyPayload, url: string) {
  const body =
    `<tr><td style="padding:24px 26px 6px">` +
    `<h1 style="font:600 19px Segoe UI,Arial,sans-serif;color:${BRAND.ink};margin:0 0 4px">${esc(p.titleEn)}</h1>` +
    `<div style="font:13px Segoe UI,Arial,sans-serif;color:${BRAND.mut};margin:0 0 16px">${esc(p.titleVn)}</div>` +
    (p.bodyEn ? `<p style="font:14px/1.7 Segoe UI,Arial,sans-serif;color:${BRAND.ink};margin:0 0 6px">${esc(p.bodyEn)}</p>` : "") +
    (p.bodyVn ? `<p style="font:13px/1.7 Segoe UI,Arial,sans-serif;color:${BRAND.mut};margin:0 0 6px">${esc(p.bodyVn)}</p>` : "") +
    (url
      ? `<p style="margin:18px 0 0"><a href="${esc(url)}" style="display:inline-block;background:${BRAND.navy};color:#ffffff;text-decoration:none;font:600 14px Segoe UI,Arial,sans-serif;padding:11px 24px;border-radius:9px">Open in Procurement · M\u1edf c\u1ed5ng</a></p>`
      : "") +
    `<p style="font:12px Segoe UI,Arial,sans-serif;color:${BRAND.mut};margin:18px 0 0;line-height:1.6">Automated message from the Humiley Procurement portal — please do not reply.</p>` +
    `</td></tr>`;
  return emailShell(body);
}

/** Full-control mail (attachments, CC) — e.g. the PO PDF to a vendor. Dev-logs when SMTP is unset. */
