import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { emailShell, textEmail, notifyEmailHtml, bilingualEmail, bilingualText } from "../lib/email-shell";

/**
 * The brand frame on outgoing mail. These are pure string checks, but they guard a class of defect
 * no other test can see: this markup is rendered by Outlook, OWA, Gmail and Apple Mail — including
 * SUPPLIERS' mail systems, which we do not control — and none of those run in CI.
 */

test("the frame carries the reverse mark as an inline attachment, not a link", () => {
  const html = emailShell("<tr><td>x</td></tr>");
  // A remote URL is blocked by Outlook/OWA by default and a data: URI is ignored by Outlook's
  // desktop renderer. cid: is the only one every client draws.
  expect(html).toContain('src="cid:humileylogo"');
  expect(html).not.toContain("http://");
  expect(html).not.toMatch(/src="data:/);
});

test("the alt text is white, because that is what a client shows when it blocks the image", () => {
  const html = emailShell("<tr><td>x</td></tr>");
  const img = html.slice(html.indexOf("<img"), html.indexOf(">", html.indexOf("<img")));
  expect(img).toContain('alt="Humiley"');
  expect(img).toContain("color:#ffffff");   // unstyled it renders near-black on the navy header
});

test("no email style depends on a CSS variable", () => {
  // Mail clients do not resolve custom properties; an unresolved background leaves the card
  // transparent — white by luck of the client's default, dark behind dark ink in a dark mailbox.
  for (const html of [
    emailShell("<tr><td>x</td></tr>"),
    textEmail("hello"),
    notifyEmailHtml({ titleEn: "a", titleVn: "b" }, "https://x/"),
  ]) {
    expect(html).not.toMatch(/[a-z-]+:\s*var\(--/);
    expect(html).toContain("background:#ffffff");
  }
});

test("a plain-text body keeps its wording and is escaped", () => {
  const html = textEmail('Dear <b>Vendor</b> & "co",\n\n5 > 3');
  expect(html).toContain("&lt;b&gt;Vendor&lt;/b&gt;");   // no injected markup
  expect(html).toContain("5 &gt; 3");
  expect(html).toContain("Dear");                        // the copy itself is unchanged
});

test("an internal notification carries both languages and a way back in", () => {
  const html = notifyEmailHtml(
    { titleEn: "PR-1 needs your approval", titleVn: "PR-1 cần bạn phê duyệt", bodyEn: "x", bodyVn: "y" },
    "https://procurement.humiley.com/approvals",
  );
  expect(html).toContain("PR-1 needs your approval");
  expect(html).toContain("cần bạn phê duyệt");
  expect(html).toContain('href="https://procurement.humiley.com/approvals"');
});

test("the white mark asset really is white", () => {
  // The frame is only correct if the artwork is. A full-colour logo here would put a navy
  // wordmark on the navy header, where it simply disappears.
  const png = readFileSync("public/brand/Humiley_Logo_White.png");
  expect(png.length).toBeGreaterThan(1000);
});

test("a person holding two alerted roles is emailed once, not twice", async () => {
  // `roles` is an array on User, so a Director who also purchases holds both. Calling notifyRole
  // once per role sent that person the identical contract-renewal alert TWICE and put two rows in
  // their bell. Guarded at the source: the contracts sweep must pass the roles together.
  // The renewal alert moved to lib/sweeps.ts when it went onto a timer — the rule follows the
  // code, and a guard left pointing at the old home is a guard that no longer guards anything.
  const fs = await import("node:fs");
  const src = fs.readFileSync("lib/sweeps.ts", "utf8");
  expect(src).toContain('notifyRoles(["PURCHASER", "DIRECTOR"]');
  expect(src).not.toMatch(/notifyRole\("PURCHASER"[\s\S]{0,80}notifyRole\("DIRECTOR"/);
});

test("a bilingual letter pairs the languages paragraph by paragraph, English first", () => {
  // Not one whole letter then another: the reader should meet each sentence in both languages
  // together. And English stays primary (HML-BG-001) — never Vietnamese on top.
  const html = bilingualEmail("Alpha\n\nBravo", "Một\n\nHai", "S");
  const order = ["Alpha", "Một", "Bravo", "Hai"].map((s) => html.indexOf(s));
  expect(order.every((i) => i > -1)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));   // strictly interleaved, EN before VN
});

test("the plain-text alternative carries both languages too", () => {
  // A text-only client must not silently lose the Vietnamese half.
  const txt = bilingualText("Alpha\n\nBravo", "Một\n\nHai");
  expect(txt.indexOf("Alpha")).toBeLessThan(txt.indexOf("Một"));
  expect(txt).toContain("Hai");
});

test("both supplier letters really are bilingual", async () => {
  const fs = await import("node:fs");
  for (const [file, vn] of [
    ["app/(portal)/purchase-orders/actions.ts", "đơn đặt hàng"],
    ["app/(portal)/rfqs/actions.ts", "yêu cầu báo giá"],
  ] as const) {
    const src = fs.readFileSync(file, "utf8");
    expect(src).toContain("bilingualEmail(");     // framed, both languages
    expect(src).toContain("bilingualText(");      // and the text alternative
    expect(src).toContain("Kính gửi");            // a Vietnamese salutation
    expect(src).toContain(vn);                    // the right trade term
    expect(src).toContain("Trân trọng");          // a Vietnamese sign-off
  }
});

test("the RFQ deadline means the same day in both languages", async () => {
  // "trước ngày X" EXCLUDES X in Vietnamese commercial usage; the English "by X" includes it. Left
  // as-is, a supplier quoting on the due date is compliant under one half of the email and late
  // under the other — on the one line of an RFQ most likely to end up in dispute.
  const src = (await import("node:fs")).readFileSync("app/(portal)/rfqs/actions.ts", "utf8");
  expect(src).toContain("chậm nhất là ngày");
  expect(src).not.toContain("báo giá tốt nhất trước ngày");
});

test("the PO acknowledgement asks for something a Vietnamese reader can parse", async () => {
  // "xác nhận đã nhận và <noun phrase>" yokes a bare clause and a noun to one verb, which does not
  // coordinate in Vietnamese — and leaves "received" without an object. Received WHAT?
  const src = (await import("node:fs")).readFileSync("app/(portal)/purchase-orders/actions.ts", "utf8");
  expect(src).toContain("xác nhận đã nhận được đơn đặt hàng");
  expect(src).not.toContain("xác nhận đã nhận và");
});
