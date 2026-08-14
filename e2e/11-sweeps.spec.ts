import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * The SLA and renewal sweeps moved off page renders onto a timer (lib/sweeps.ts, started by
 * instrumentation.ts). These guard the property that matters: a GET must not email anyone, and
 * the sweep must not depend on somebody opening a page.
 */

const page = (p: string) => readFileSync(p, "utf8");

test("no page render notifies anyone", () => {
  // The approver who is LATE is precisely the person not opening the queue, so a render-triggered
  // chase reaches everyone except the one who needs it — and goes silent over a quiet week.
  for (const f of [
    "app/(portal)/approvals/page.tsx",
    "app/(portal)/contracts/page.tsx",
  ]) {
    const src = page(f);
    expect(src, `${f} must not send notifications during a render`).not.toMatch(
      /notifyUser|notifyRole|notifyRoles|checkContractRenewals/,
    );
  }
});

test("the sweeps are started by the server, not by a request", () => {
  const inst = page("instrumentation.ts");
  expect(inst).toContain("setInterval");
  expect(inst).toContain('process.env.NEXT_RUNTIME !== "nodejs"');   // edge has no db and no timers
  expect(page("next.config.mjs")).toContain("instrumentationHook: true");  // Next 14 flags it
});

test("instrumentation stays free of Node-only imports", () => {
  // It is compiled for the EDGE runtime too. Importing the sweeps (Prisma, nodemailer) or even
  // node:crypto from here fails to resolve and 500s EVERY PAGE — not just the mail path. That is
  // why the timer pokes a Node-runtime route instead of calling the sweeps directly.
  // Assert on IMPORTS, not on the substring anywhere: both files explain in prose why node: is
  // banned here, and a test that reads its own rationale as a violation is a test that cries wolf.
  const nodeImport = /(?:from|import)\s*\(?\s*["']node:/;
  for (const f of ["instrumentation.ts", "lib/sweep-token.ts"]) {
    expect(page(f), `${f} is reachable from the edge build`).not.toMatch(nodeImport);
  }
  expect(page("instrumentation.ts")).not.toMatch(/from "@\/lib\/(sweeps|notify|db)"|require\(/);
});

test("the internal sweep route is Node-runtime and token-guarded", () => {
  const r = page("app/api/internal/sweeps/route.ts");
  expect(r).toContain('export const runtime = "nodejs"');
  expect(r).toContain("x-sweep-token");
  expect(r).toContain("404");                                        // unauthorised looks absent
  // and the auth middleware must not bounce the timer to /login. Check the MATCHER, not the file:
  // the prose above it names the route too, so a substring test passes even after the exemption
  // is deleted.
  const matcher = page("middleware.ts").match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  expect(matcher, "the middleware matcher must exempt /api/internal").toContain("api/internal");
});

test("a failed tick cannot kill the server", () => {
  // An unhandled rejection inside a timer takes the process down; a missed reminder must never
  // cost the app its availability.
  const inst = page("instrumentation.ts");
  expect(inst).toMatch(/catch \(e\)/);
  expect(inst).toContain("Never throw from a timer");
});

test("the sweep batch cap is reported, never silent", () => {
  // A cap that drops work quietly is how "it stopped chasing overdue approvals" goes unnoticed.
  expect(page("lib/sweeps.ts")).toContain("capped:");        // the sweep says it hit the cap
  expect(page("instrumentation.ts")).toContain("CAPPED");    // and the runner logs that it did
});

test("both sweeps still dedup on an unread notification", () => {
  // Idempotence is what makes a timer safe: a restart, a manual call and an overlapping tick must
  // not produce a second email for the same thing.
  const src = page("lib/sweeps.ts");
  expect(src.match(/isRead: false/g) ?? []).toHaveLength(2);   // one per sweep
});
