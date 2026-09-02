/**
 * The two money-path properties that were wrong for months, asserted against the source.
 *
 * Neither can be caught by `tsc` or by the e2e suite: the first is an ABSENCE (a ledger effect that
 * silently did nothing for a whole class of document) and the second is a SWALLOWED ERROR (a
 * `catch (console.warn)` that made a failure indistinguishable from success). Both compiled, both
 * passed every test, and both were live.
 *
 * Runs with no database and no server: `node scripts/check-money-paths.mjs`.
 */
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const budget = read("lib/budget/index.ts");
const poActions = read("app/(portal)/purchase-orders/actions.ts");
const prActions = read("app/(portal)/approvals/actions.ts");
const invActions = read("app/(portal)/invoices/actions.ts");
const giActions = read("app/(portal)/inventory/issues/actions.ts");
const schema = read("prisma/schema.prisma");
const poSchema = read("lib/schemas/po.ts");

console.log("\nthe budget ledger runs in the caller's transaction");

check("every effect accepts the caller's transaction", () => {
  for (const fn of ["commitPr", "moveCommitmentPrToPo", "spendOnInvoice", "spendFromStock",
                    "releaseOnPoClose"]) {
    const m = budget.match(new RegExp(`export async function ${fn}\\(([^)]*)\\)`));
    assert(m, `${fn} is gone`);
    assert(/tx\?: Tx/.test(m[1]), `${fn} cannot join the caller's transaction: (${m[1]})`);
  }
});

check("no effect opens its own transaction unconditionally", () => {
  // `inTx` uses db.$transaction only when the caller has none. A bare db.$transaction inside an
  // effect would commit independently of the operation that asked for it — which is the bug.
  const body = budget.slice(budget.indexOf("export async function commitPr"));
  assert(!/db\.\$transaction/.test(body),
    "an effect still opens db.$transaction directly instead of going through inTx");
  assert(/async function inTx/.test(budget), "the inTx helper is gone");
});

check("no caller swallows a ledger failure", () => {
  // The whole point. `catch (e) { console.warn(...) }` around a money effect makes a ledger that
  // failed indistinguishable from one that worked, and the document has already moved.
  for (const [name, src] of [["purchase-orders", poActions], ["approvals", prActions],
                             ["invoices", invActions], ["inventory/issues", giActions]]) {
    for (const fn of ["commitPr", "moveCommitmentPrToPo", "spendOnInvoice", "spendFromStock",
                      "releaseOnPoClose"]) {
      const i = src.indexOf(`await ${fn}(`);
      if (i < 0) continue;
      const around = src.slice(Math.max(0, i - 700), i + 200);
      assert(!/catch\s*\([^)]*\)\s*\{[^}]*console\.warn/.test(around),
        `${name}: a failure of ${fn} is swallowed by a console.warn`);
    }
  }
});

check("the status change and its ledger effect are one transaction", () => {
  for (const [name, src, fn] of [
    ["PO approve", poActions, "moveCommitmentPrToPo"],
    ["PO cancel", poActions, "releaseOnPoClose"],
    ["PO close", poActions, "releaseOnPoClose"],
    ["PR approve", prActions, "commitPr"],
  ]) {
    const i = src.indexOf(`await ${fn}(`, name === "PO close" ? src.indexOf("_closePo") : 0);
    assert(i > 0, `${name}: ${fn} is no longer called`);
    const around = src.slice(Math.max(0, i - 800), i + 100);
    assert(/db\.\$transaction\(async \(tx\)/.test(around),
      `${name}: the ledger effect is not inside a transaction with its status change`);
    assert(new RegExp(`${fn}\\([^)]*tx\\)`).test(around),
      `${name}: ${fn} is called without the surrounding tx, so it commits separately`);
    assert(/transition\(tx\./.test(around),
      `${name}: the status change still uses db. rather than the transaction`);
  }
});

console.log("\na standalone purchase order reaches the budget");

check("a purchase order can carry its own cost centre", () => {
  const model = schema
    .slice(schema.indexOf("model PurchaseOrder "),
           schema.indexOf("model ", schema.indexOf("model PurchaseOrder ") + 10))
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert(/costCenterId\s+String\?/.test(model), "PurchaseOrder has no costCenterId");
  assert(/costCenter\s+CostCenter\?/.test(model), "PurchaseOrder has no costCenter relation");
  // And a migration that creates it, or the column exists only in a file Postgres never reads.
  const migs = readdirSync(new URL("../prisma/migrations", import.meta.url));
  const sql = migs.map((d) => {
    try { return read(`prisma/migrations/${d}/migration.sql`); } catch { return ""; }
  }).join("\n");
  assert(/ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "costCenterId"/.test(sql),
    "no migration adds the column — the schema says it exists and the database disagrees");
});

check("no effect early-returns on a missing requisition any more", () => {
  // `if (!po?.pr) return;` was the bug: every standalone PO's money was invisible to the ledger.
  assert(!/if \(!po\?\.pr\) return;/.test(budget), "moveCommitmentPrToPo/releaseOnPoClose still skip standalone POs");
  assert(!/if \(!inv\?\.po\.pr\) return;/.test(budget), "spendOnInvoice still skips standalone POs");
  assert(/function poBudgetContext/.test(budget), "the shared attribution helper is gone");
});

check("all three PO effects resolve their budget the same way", () => {
  for (const fn of ["moveCommitmentPrToPo", "spendOnInvoice", "releaseOnPoClose"]) {
    const i = budget.indexOf(`export async function ${fn}`);
    const body = budget.slice(i, budget.indexOf("\n}", i));
    assert(/poBudgetContext\(/.test(body),
      `${fn} resolves the cost centre its own way — the three must agree or money commits against one budget and releases against another`);
  }
});

check("a requisition-sourced PO still uses its requisition's cost centre", () => {
  const i = budget.indexOf("function poBudgetContext");
  const body = budget.slice(i, budget.indexOf("\n/**", i));
  assert(/return null;/.test(body), "the slice missed the end of the function — this check reads nothing");
  assert(/if \(po\.pr\) return \{ costCenterId: po\.pr\.costCenterId/.test(body),
    "the requisition no longer wins, so one document would have two attributions");
  assert(/fiscalYearOf\(po\.pr\.createdAt\)/.test(body),
    "the fiscal year no longer comes from the requisition — a December PR cut in January would move year");
});

check("a PO cannot be given two attributions at once", () => {
  assert(/data\.prId && data\.costCenterId/.test(poSchema),
    "the form accepts a requisition AND a cost centre, so a PO can commit against one budget and release against another");
  assert(/costCenterId: pr \? null :/.test(poActions),
    "the action stores a cost centre on a PR-sourced PO, which is a second source of truth");
});

check("the cost centre is offered on the form, not just in the schema", () => {
  const form = read("components/po/PoForm.tsx");
  assert(/costCenters/.test(form), "PoForm never receives the list");
  assert(/costCenterId: fromPr \? null :/.test(form), "the form sends a cost centre alongside a requisition");
  assert(/t\("costCenter"\)/.test(form), "the field is not rendered");
  const page = read("app/(portal)/purchase-orders/new/page.tsx");
  assert(/db\.costCenter\.findMany/.test(page), "the page never loads the cost centres");
  assert(/costCenters=\{ccOpts\}/.test(page), "the page never passes them to the form");
  for (const loc of ["messages/en.json", "messages/vi.json"]) {
    const m = JSON.parse(read(loc));
    assert(m.po?.costCenter && m.po?.costCenterHint, `${loc} has no translation for the field`);
  }
});

console.log(failed ? `\n${failed} FAILED\n` : "\nall money-path checks passed\n");
process.exit(failed ? 1 : 0);
