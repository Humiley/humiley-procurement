import { test, expect } from "@playwright/test";
import { safeCallback } from "../lib/safe-callback";
import { PASSWORD } from "./helpers";

const BP = "/procurement";
const ok = (v: unknown) => safeCallback(v, BP);

/**
 * The post-login destination comes out of the URL bar, so it is attacker input. A login page that
 * forwards to an arbitrary URL is a phishing tool wearing our own logo: the victim sees the real
 * domain, types a real password, and is handed to somebody else's site with the whole visit
 * looking legitimate. Hence: a path, or null.
 */

test("it accepts genuine in-app destinations", () => {
  expect(ok("/procurement/dashboard")).toBe("/procurement/dashboard");
  expect(ok("/procurement/contracts/abc123")).toBe("/procurement/contracts/abc123");
  expect(ok("/procurement/approvals?overdue=x")).toBe("/procurement/approvals?overdue=x");
  expect(ok("/procurement")).toBe("/procurement/");   // app root, canonicalised
});

test("it refuses every way of naming another host", () => {
  for (const bad of [
    "https://evil.example/harvest",
    "http://evil.example",
    "//evil.example",
    "/" + String.fromCharCode(92) + "evil.example", // "/\evil.example" — browsers resolve as //
    String.fromCharCode(92, 92) + "evil.example",
    "/@evil.example",
    "https:/evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ]) {
    expect(ok(bad), "must reject " + JSON.stringify(bad)).toBeNull();
  }
});

test("it normalises a path given with or without the basePath", () => {
  // Next reports the basePath differently in edge middleware vs a server component (production
  // emitted "/procurement/contracts", dev "/contracts" for the SAME navigation). Demanding one
  // shape silently discarded real destinations, so both are accepted and normalised — what makes
  // it safe is the origin, not the prefix.
  expect(ok("/dashboard")).toBe("/procurement/dashboard");
  expect(ok("/procurement/dashboard")).toBe("/procurement/dashboard");
  expect(ok("/contracts/abc")).toBe("/procurement/contracts/abc");
  // "/procurementx" is NOT the basePath, so it is treated as an app-relative path and prefixed —
  // still our own origin, which is the property that matters.
  expect(ok("/procurementx/dashboard")).toBe("/procurement/procurementx/dashboard");
});

test("it refuses control characters that could split a header", () => {
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const TAB = String.fromCharCode(9);
  const NUL = String.fromCharCode(0);
  expect(ok("/procurement/a" + CR + LF + "Location: https://evil.example")).toBeNull();
  expect(ok("/procurement/a" + LF + "b")).toBeNull();
  expect(ok("/procurement/a" + TAB + "b")).toBeNull();
  expect(ok("/procurement/a" + NUL + "b")).toBeNull();
});

test("it refuses to bounce back to the login page", () => {
  // Otherwise signing in returns you to the sign-in page, forever.
  expect(ok("/procurement/login")).toBeNull();
  expect(ok("/procurement/login?callbackUrl=/procurement/dashboard")).toBeNull();
  expect(ok("/login")).toBeNull();          // the un-prefixed shape the middleware emits in dev
});

test("it refuses junk, absent and oversized values", () => {
  for (const bad of [undefined, null, "", 42, {}, [], "/procurement/" + "a".repeat(600)]) {
    expect(ok(bad), "must reject " + JSON.stringify(bad)).toBeNull();
  }
});

test("double encoding does not sneak an origin through", () => {
  // Next decodes searchParams once. A second layer arrives literally and must NOT be decoded again
  // by us — decoding here is what turns %2F%2Fevil into //evil after the checks have run.
  expect(ok("%2F%2Fevil.example")).toBeNull();
  expect(ok("%2Fprocurement%2Fdashboard")).toBeNull();
});

test("both the page and the action validate, not just the page", () => {
  // The callback travels to the action through a HIDDEN FORM FIELD, so it is ordinary user input
  // by the time it arrives. Validating only where it is rendered protects nobody.
  const fs = require("node:fs") as typeof import("node:fs");
  expect(fs.readFileSync("app/login/page.tsx", "utf8")).toContain("safeCallback(");
  expect(fs.readFileSync("app/login/actions.ts", "utf8")).toContain("safeCallback(");
});

/**
 * The SAME validator with an EMPTY basePath. next.config.mjs supports BASE_PATH="" for a
 * standalone-subdomain deploy, and in that shape the "is it inside this app" containment check has
 * nothing to compare against — so every other guard becomes the only thing standing between a
 * crafted link and an off-site redirect. Mutation testing found these unprotected: with only the
 * /procurement suite above, deleting the protocol-relative, backslash, leading-slash, userinfo and
 * origin-probe checks changed NOTHING that any test could see.
 */
const bare = (v: unknown) => safeCallback(v, "");

test("with no basePath it still refuses every off-site form", () => {
  for (const bad of [
    "https://evil.example/harvest",
    "http://evil.example",
    "//evil.example",
    "/" + String.fromCharCode(92) + "evil.example",
    String.fromCharCode(92, 92) + "evil.example",
    "/@evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ]) {
    expect(bare(bad), "must reject " + JSON.stringify(bad)).toBeNull();
  }
});

test("with no basePath it still accepts real in-app paths", () => {
  expect(bare("/dashboard")).toBe("/dashboard");
  expect(bare("/contracts/abc?x=1")).toBe("/contracts/abc?x=1");
});

test("with no basePath it still refuses the login loop and oversized junk", () => {
  expect(bare("/login")).toBeNull();
  expect(bare("/login?callbackUrl=/dashboard")).toBeNull();
  expect(bare("/" + "a".repeat(600))).toBeNull();
});

test("INVARIANT: anything it returns stays on our own origin", () => {
  // The branch-level guards overlap by design, so no single mutation of them is observable. This
  // pins the property they exist to protect, and fails the moment the LAST layer goes.
  const hostile = [
    "https://evil.example/x", "http://evil.example", "//evil.example", "///evil.example",
    "/" + String.fromCharCode(92) + "evil.example", String.fromCharCode(92, 92) + "evil.example",
    "/@evil.example", "//@evil.example", "https:/evil.example", "https:evil.example",
    "javascript:alert(1)", "data:text/html,x", "  //evil.example", "/%2F%2Fevil.example",
    "/..//evil.example", "/./" + String.fromCharCode(92) + "/evil.example",
  ];
  const HOME = "https://portal.humiley.com";
  for (const bp of ["/procurement", ""]) {
    for (const h of hostile) {
      const out = safeCallback(h, bp);
      if (out === null) continue;                       // refused outright — fine
      const resolved = new URL(out, HOME);
      expect(resolved.origin, `"${h}" (bp="${bp}") escaped to ${resolved.origin}`).toBe(HOME);
    }
  }
});

test("a deep link survives the login: you land where you were going", async ({ page }) => {
  // The whole point. Previously every sign-in dumped you on the dashboard and your destination was
  // lost — this walks the real flow in a browser rather than asserting on strings.
  await page.goto("/contracts");
  await expect(page).toHaveURL(/\/login\?/);                       // bounced to sign-in
  // Next reports the basePath differently in dev and production, so assert the DESTINATION, not
  // the exact prefix — the validator normalises both shapes.
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toMatch(/\/contracts$/);

  await page.locator('input[type="email"], input[name="email"]').fill("admin@humiley.com");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/contracts$/, { timeout: 20_000 });  // NOT /dashboard
});

test("a hostile callback is ignored and you land on the dashboard", async ({ page }) => {
  await page.goto("/login?callbackUrl=https://evil.example/harvest");
  await page.locator('input[type="email"], input[name="email"]').fill("admin@humiley.com");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
});
