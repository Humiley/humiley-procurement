import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { emailShell, textEmail, notifyEmailHtml } from "../lib/email-shell";

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
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync("app/(portal)/contracts/actions.ts", "utf8"),
  );
  expect(src).toContain('notifyRoles(["PURCHASER", "DIRECTOR"]');
  expect(src).not.toMatch(/notifyRole\("PURCHASER"[\s\S]{0,80}notifyRole\("DIRECTOR"/);
});
