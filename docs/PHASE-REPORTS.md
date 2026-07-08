# Humiley Procurement Portal — Build Log (Phase Reports)

One-click full build per spec §24. Reports appended per phase; decisions logged instead of asking.

---

## Standing constraints (apply to every phase)

- **Procurement is an APP of the Humiley Portal** (portal.humiley.com), alongside HR / Finance /
  CRM / Projects — not a standalone silo. It remains the dedicated Next.js/Prisma app the spec
  mandates (the portal is a separate Python app; we do NOT rewrite procurement into it). What this
  requires, to be delivered at the Integration phase (§16/§17) and honored throughout:
  1. **Brand consistency** with the portal (navy #205090 / emerald #00B060, bilingual EN/VN) —
     already the case (§10). Keep it.
  2. **Single sign-on** — the portal signs in with **Microsoft 365**. Procurement currently uses
     Auth.js Credentials + bcrypt (spec §22.7 Phase 1). Plan an M365/Entra SSO provider so a
     portal user lands in procurement already authenticated; reconcile the user directory (map
     portal employees ↔ procurement `User`). Build so the auth provider is swappable.
  3. **Launch surface** — a "Procurement" entry in the portal's app launcher/nav that opens this
     app (subpath or subdomain), and app-level access consistent with the portal's apps/permission
     model (opt-in per user, like the HR/Finance apps).
  4. The **FINAL-REPORT** must document the exact integration/embedding + SSO steps.

## Phase 11 — Budget Engine Completion + Contracts (§9) — ✅ COMPLETE

**Summary.** The §9 loop closed on both fronts. **Budget engine:** ADMINs now set budget rows
(costCenter × category × FY) straight on `/budgets`; every row drills into `/budgets/[id]` with the
four-figure ledger (budget / spent / committed / remaining) and every PR line that resolves to it.
The **pre-submit gate** is live: on PR submit the projected commitment is checked per budget row and
the requester department's `overBudgetPolicy` decides — **WARN** lets the submit through while the
PR detail carries a red over-budget banner (visible to every approver until decided), **BLOCK**
refuses the submit with the offending rows spelled out. Departments carry the policy as a new column
managed on the admin screen. **Contracts:** the §9 framework-agreement register is live — vendor,
validity, value, renewal-alert days and an optional contracted price list per item. Creating a PO
for a vendor with an ACTIVE in-validity contract auto-links the contract, **auto-fills contracted
prices** on item lines (emerald hint), and **flags edits** (hint flips red + the deviation lands in
the PO_CREATE audit entry). Renewal alerts notify PURCHASER + DIRECTOR once per breach when an
active contract enters its alert window, and past-end contracts auto-expire.

### Built
- migration `dept_over_budget_policy` (enum BudgetPolicy WARN|BLOCK on Department, default WARN) ·
  lib/budget/check.ts (checkPrBudget — explicit budgetId else costCenter×category×FY, projected
  totals per row) · submitPr gate (BLOCK throws with detail; WARN passes) · PR-detail over-budget
  banner (live on DRAFT/SUBMITTED) · budgets/actions.ts upsertBudget + BudgetUpsertForm (ADMIN,
  on /budgets) · /budgets/[id] drill-down (ledger KPIs + resolved PR lines) · departments admin:
  overBudgetPolicy field (schema+actions+page).
- lib/schemas/contract.ts · contracts/actions.ts (createContract HML-CTR docnum + price list JSON /
  activate / terminate / checkContractRenewals with auto-EXPIRED sweep + unread-deduped alerts) ·
  ContractForm + ContractDetailActions · pages /contracts (register, expiring badge, renewal check
  on load) /contracts/new /contracts/[id] (price list + linked POs) · createPo: ACTIVE-contract
  auto-link + priceDeviations audit · PoForm/new page: contract price prefill + per-line hint ·
  contracts/budgets/po/pr/admin i18n EN/VN · seed: HML-CTR-2026-0001 (ACTIVE, ends in 30d < 60d
  alert, CONS-BOLT-M8 @ 280,000).

### E2E evidence (browser, fresh seed)
- /contracts load fired renewal alerts → notifications to purchaser + both directors ("expires in
  30 day(s)"); register shows the amber "expires in 30d" badge on the ACTIVE row.
- PO from PR-0002 for V-CLEAN01: banner "Contract HML-CTR-2026-0001 — contracted prices applied
  automatically"; bolt line price auto-filled 280,000 with emerald "Contract: 280,000" hint; editing
  to 300,000 flipped the hint red; created **HML-PO-2026-0003 linked to the contract** with audit
  `priceDeviations: [{poPrice 300000, contractPrice 280000}]`.
- ADMIN set CC-ENG × CONS FY2026 to 1,000,000 ₫ via the /budgets form (row confirmed in DB).
- **BLOCK proven:** with ENG policy BLOCK, submitting a 30M bolt PR was refused: "Over budget —
  submission blocked by department policy: CC-ENG×CONS (remaining 1,000,000 ₫, requested
  30,000,000 ₫)" — PR stayed DRAFT.
- **WARN proven:** policy back to WARN → same PR submitted successfully (SUBMITTED) and the red
  over-budget banner stays on the detail for approvers.
- /budgets/[id] drill-down: BUDGET 1,000,000 / SPENT 0 / COMMITTED 0 / REMAINING 1,000,000 + all
  four CONS-resolving PR lines with statuses.

### §23 decisions (spec didn't specify — decided and logged)
1. **Budget entry is a form, not xlsx** — §9 allows "xlsx import or form"; the import lands with the
   exceljs toolchain in Phase 12 (reports/exports) so the dependency arrives once.
2. **The gate runs at submit, banner at render** — no stored warn-state; the banner recomputes live
   so approvers always see the current ledger, not a stale snapshot.
3. **Unbudgeted lines never block** (no matching budget row ⇒ skip), consistent with the §9
   best-effort ledger from Phase 7.
4. **REIMBURSEMENT / non-PO ADVANCE payment requests do NOT hit the Budget ledger** — the ledger is
   keyed costCenter × item-category and payment-request lines carry no category. Their spend shows
   in the Phase-12 spend-by-cost-center reports instead (deferred from Phase 8, now resolved as a
   reporting concern, not a ledger hack).
5. **Renewal check runs on register load** (deduped on unread notifications), same pattern as the
   reorder check; a nightly sweep belongs to the API/scheduling phase.
6. **Contract price deviations are flagged, not blocked** — §9 says "price edits are flagged"; the
   flag lives in the form hint + PO_CREATE audit (`priceDeviations`), leaving commercial judgment
   with the purchaser.
7. **One ACTIVE contract per vendor is assumed** (findFirst by validity); multiple concurrent
   frameworks per vendor would need a picker — out of v1 scope.

---

## Phase 10 — Inventory Extended (§10b) — ✅ COMPLETE

**Summary.** The stock layer is now operationally complete. **Transfers** (Chuyển kho) move goods
between warehouses in two signed steps: dispatch posts `TRANSFER_OUT` at the source's average cost
(ISSUED signature, status → IN_TRANSIT) and the receiving keeper's confirmation posts `TRANSFER_IN`
at the SAME unit cost (RECEIVED signature) — value is preserved end to end. **Stock counts** (Kiểm
kê) snapshot every balance line into a count sheet; the keeper enters counted quantities (variances
compute live and persist), and POSTING is a DIRECTOR-signed act (§19 meaning COUNTED) that turns
variances into `ADJUST_IN`/`ADJUST_OUT` movements at the line's current average cost. **Reorder
automation** closes the §10b loop: after every OUT movement (goods issue or transfer dispatch),
`ItemStockPolicy` is checked — when on-hand + open-PO < min, PURCHASERs get a bilingual
notification (deduped on unread) and the `/inventory/reorder` console shows every breach with a
one-click **Generate draft PR** (source=REORDER, reorderQty lines priced from the catalog).
The `/inventory` overview became the §10b dashboard: value KPIs + below-min and in-transit cards,
a below-min banner, stock value by warehouse, and a zero-movement-in-90-days panel.

### Built
- transfers: lib/schemas/transfer.ts · inventory/transfers/actions.ts (create TRF docnum /
  dispatch ISSUED-signed OUT + IN_TRANSIT / receive RECEIVED-signed IN at dispatch cost /
  cancel) · TransferForm + TransferDetailActions · pages list/new/[id] (movements + signatures).
- counts: inventory/counts/actions.ts (createCount snapshot COUNTING / saveCounts variance /
  postCount DIRECTOR+ADMIN, COUNTED signature, ADJUST movements) · CountSheet + NewCountButton ·
  pages list/[id].
- reorder: lib/stock/reorder.ts (findReorderBreaches + checkReorderAfterOut, hooked into GI
  execute AND transfer dispatch) · inventory/reorder/actions.ts (generateReorderPr → DRAFT PR
  source=REORDER) · ReorderPanel + /inventory/reorder page.
- dashboard: /inventory extended (below-min + in-transit KPIs, banner, value-by-warehouse,
  slow movers) · seed: WH-SITE warehouse + HVAC-DMPR-30 policy (min 5 / max 40 / reorder 20) ·
  trf + cnt + reorder i18n EN/VN + statuses IN_TRANSIT/COUNTING/POSTED.

### E2E evidence (browser, fresh seed)
- GRN 10 pcs @ 1M into WH-MAIN, then transfer HML-TRF-2026-0001 of 6 pcs WH-MAIN → WH-SITE:
  dispatch (ISSUED sig) → TRANSFER_OUT 6 @ 1,000,000, WH-MAIN 4, IN_TRANSIT; receive (RECEIVED
  sig) → TRANSFER_IN 6 @ 1,000,000, **WH-SITE 6 @ avg 1,000,000 — cost preserved**.
- **Reorder fired on the dispatch OUT**: 4 on hand + 0 open PO < min 5 → notification to
  purchaser@humiley.com; /inventory/reorder showed the breach (4 | 0 | 5 | 20 PCS); Generate
  draft PR → **HML-PR-2026-0004, DRAFT, source=REORDER, 20 pcs @ 950,000 (catalog last price),
  total 19,000,000 ₫**.
- Count HML-CNT-2026-0001 on WH-SITE: counted 5 vs system 6 → variance −1 (live + persisted);
  Finance Director posted with COUNTED signature + reason ("1 damper damaged on site") →
  **ADJUST_OUT 1 @ 1,000,000, WH-SITE 6 → 5, count POSTED**.
- Movement ledger reads GRN_IN 10 → TRANSFER_OUT 6 → TRANSFER_IN 6 → ADJUST_OUT 1 (MOV-000001…4).
- Dashboard verified: KPIs (32,140,000 ₫ total, below-min 1, in-transit live), below-min banner,
  value by warehouse (WH-MAIN 27.14M / WH-SITE 5M), slow-movers panel (seed-only lines).

### §23 decisions (spec didn't specify — decided and logged)
1. **Transfer signatures**: dispatch = ISSUED, receipt = RECEIVED (§19 "every consequential act");
   the spec lists no explicit transfer signature but stock leaves/enters a warehouse.
2. **Counts skip DRAFT**: a count is created directly in COUNTING with the snapshot taken at
   creation (a count sheet without its snapshot has no meaning). countedQty starts at systemQty.
3. **Count posting authority** = role gate (DIRECTOR or ADMIN signs COUNTED) rather than an
   approval-matrix flow — §10b says "requires DIRECTOR approval", the signature IS the approval.
4. **ADJUST_IN cost** = the line's current average cost (gains don't change avgCost, they extend it),
   keeping valuation consistent; ADJUST_OUT posts at avg like every OUT.
5. **Open-PO quantity in the reorder check is company-wide** (POs carry no destination warehouse).
6. **Reorder dedupe** = skip while an UNREAD notification exists for the same warehouse+item link;
   once read, a persisting breach may notify again (safety over silence). Nightly job deferred to
   the governance/API phase — every OUT already triggers the check, so a scheduled sweep adds
   little in v1 (logged as future work §17).
7. **xlsx import for counted quantities deferred** to the reports/xlsx phase (12) where the xlsx
   toolchain lands; v1 enters counts in the sheet UI.

---

## Phase 9 — Inventory Core (§10b) — ✅ COMPLETE

**Summary.** Stock is live on a single-writer architecture: `lib/stock/post-movement.ts` is the ONLY
code allowed to touch `StockBalance` — every change posts a `StockMovement` AND updates the balance
(+ moving-average cost) in one transaction with the balance row locked (`SELECT … FOR UPDATE`).
IN movements (GRN/transfer/adjust/return) recompute the moving average; OUT movements are refused
beyond on-hand and post at the CURRENT average cost. GRN acceptance now feeds stock automatically:
each accepted, item-linked line posts `GRN_IN` into the GRN's warehouse at the PO line price.
Goods issues (Phiếu xuất kho) run the full lifecycle — request (warehouse + cost center + purpose +
item lines with live on-hand hints) → dept-manager approval through the §6 engine (`GOODS_ISSUE`
entity, §19 signed decisions, wired into the same approvals queue) → warehouse executes under an
ISSUED signature, per-line quantity ≤ requested and ≤ on-hand, stock OUT at average cost, and the
issued cost charges the cost center's budget (`spendFromStock`). Stock Balances page (warehouse ×
item, on-hand / avg cost / value + totals KPI) and a Stock Card ledger (running balance per
movement) complete §10b's visibility.

### Built
- lib/stock/post-movement.ts (single writer; StockError; moving-average; FOR-UPDATE lock; HML-MOV
  docnum pad 6; runs standalone or inside an outer tx) · migration `stock_balance_nolot_unique`
  (partial unique index for NULL-lot rows) · GRN acceptGrn posts GRN_IN per accepted line ·
  lib/schemas/gi.ts · inventory/issues/actions.ts (create HML-GI docnum / submit → engine steps /
  decide = sign → applyDecision → transition / execute = pre-check + ISSUED signature + ISSUE_OUT
  + budget) · lib/budget spendFromStock (OUT movements × avg cost → spentVnd) · approvals
  dispatcher + queue + DecideInline extended to GOODS_ISSUE · pages: /inventory (balances + KPIs),
  /inventory/card (running-balance ledger), /inventory/issues (register / new / detail with exec
  panel) · seed: GOODS_ISSUE matrix + HML-PO-2026-0002 (SENT, 10 pcs @ 1,000,000) · gi + inventory
  i18n EN/VN + status.ISSUED.

### E2E evidence (browser, fresh seed)
- Warehouse keeper received 10 pcs HVAC-DMPR-30 @ 1,000,000 on PO-0002 (GRN QC accept 10/0, RECEIVED
  signature) → **balance 10.0000, avgCost 1,000,000, value 10M** (HML-MOV-2026-000001 GRN_IN).
- Requester created HML-GI-2026-0001 (4 pcs, on-hand hint showed "10 PCS") → submit → L1 step routed
  to mgr.eng → approved from the queue (signed) → warehouse executed 4 (ISSUED signature) →
  **balance 6.0000, avg unchanged 1,000,000** (HML-MOV-2026-000002 ISSUE_OUT @ avg cost).
- **Stock card shows both rows with running balance 10 → 6**, each referencing its document.
- Budget: CC-ENG × HVAC spentVnd = 4,000,000 (4 × avg 1M) via spendFromStock.
- **Over-issue guard proven:** GI-2026-0002 (100 pcs, approved) execution refused with
  "Insufficient stock: 6 on hand, 100 requested." — no movement, no balance change, and (after the
  pre-sign check) no signature row.

### §23 decisions (spec didn't specify — decided and logged)
1. **Free-text GRN lines skip stock** — only PO lines with a catalog `itemId` post GRN_IN (no item ⇒
   nothing to keep a balance for).
2. **GOODS_ISSUE approval band** = single L1 DEPT_MANAGER for any value (engine gets amountVnd 0 —
   an issue request has no monetary amount at request time).
3. **Issue cost → budget** via new `spendFromStock`: resolves (issue costCenter × item.category ×
   FY) per OUT movement and adds qty × avgCost to spentVnd — best-effort like the other §9 hooks.
4. **Partial issue v1 = single execution**: warehouse may issue ≤ requested once; the remainder does
   not stay open as a back-order (transfers/counts arrive in Phase 10).
5. **NULL-lot balances**: Postgres treats NULLs as distinct in the 3-column unique key, so no-lot
   rows get a partial unique index (`StockBalance_wh_item_nolot_key`) and a branched ON CONFLICT —
   race-safe upsert either way.
6. **No orphan signatures**: execution pre-checks on-hand BEFORE signRecord (the in-tx FOR-UPDATE
   guard remains authoritative). One orphan ISSUED signature from pre-fix guard testing stays in the
   chain — §19 signatures are append-only, never deleted.
7. **Routes** live under `/inventory/issues` to match the §11 nav (actions colocated).

---

## Phase 8 — Payment Request Module (§10a) — ✅ COMPLETE

**Summary.** Đề nghị thanh toán is live with all four types: VENDOR_PAYMENT (Accounting/Purchasing
pick a vendor → open MATCHED-unpaid invoices with amounts → combine 1+; payee bank auto-fills from
the vendor master; invoices already on an open request are blocked), ADVANCE (any user; optional PO
reference; §10a advance control — an unsettled PAID advance older than 30 days blocks new ones),
REIMBURSEMENT (free expense lines; receipts REQUIRED before submit via the generalized attachment
panel), and ADVANCE_SETTLEMENT (links one of the requester's own PAID advances). Approval runs the
§6 engine on §10a bands (<20M DM · 20–200M +Chief Accountant · >200M +Director; the ACCOUNTANT
resolver prefers isChief) with §19 signatures, PLUS the mandatory accounting verification: the
FINAL approval is refused until an ACCOUNTANT has signed VERIFIED. Payment execution is a PAID
signature capturing the bank reference and cascades PAID to every linked invoice. The register
carries the accountant's daily payment run (approved-not-paid by due date) and the voucher PDF
prints the brand letterhead with Requester / Chief Accountant / Approver signature blocks.

### Built
- lib/schemas/payreq.ts (type-specific superRefine) · payment-requests/actions.ts (create/submit/
  verify/decide/markPaid/cancel; HML-PAY docnum; advance-block query; invoice double-carry guard;
  verification gate on the last pending step; PAID cascade via updateMany) · engine: ACCOUNTANT
  resolver prefers isChief · approvals queue + decideEntity + DecideInline extended to
  PAYMENT_REQUEST · attachments API + PrAttachments generalized (entityType prop; PaymentRequest
  whitelisted with requester/accountant guard) · PayReqPdf + /api/payment-request/[id]/pdf ·
  pages: register (+payment-run panel), type-driven create form, detail (meta, lines with invoice
  links + live payment badges, approval timeline + inline decide, signatures, attachments panel) ·
  seed: PAYMENT_REQUEST matrix + two MATCHED UNPAID invoices on the received demo PO · full
  payreq i18n EN/VN.

### E2E evidence (browser, fresh seed)
- Purchaser combined BOTH matched invoices (13.2M + 19.8M) into HML-PAY-2026-0001 = 33,000,000 ₫;
  payee + bank auto-filled from the vendor.
- Submit → steps L1 mgr.eng + L2 accountant (chief) per the 20–200M band.
- L1 approved (signed). **Guard proven:** the chief accountant's L2 approval BEFORE verification
  was refused with "Accounting must verify this payment request before the final approval."
- Verified (VERIFIED signature) → badge shows; L2 approved → APPROVED; Execute payment with bank
  ref VCB-FT26190-889021 (PAID signature) → request PAID with paidDate;
  **cascade: both invoices → PAID with paid dates.**
- Signature trail: APPROVED (manager) → VERIFIED (chief) → APPROVED (chief) → PAID.
- Voucher PDF text-verified: "PAYMENT REQUEST / Đề nghị thanh toán", payee, 33,000,000 total,
  "Kế toán trưởng" + "Người duyệt" blocks with the chief's printed name.

### ⚠️ Decisions made without asking (§23)
1. **Bank reference entry** rides the PAID SignatureDialog's reason field (labelled accordingly) —
   one ceremony, one dialog.
2. **Requester signature block** on the voucher falls back to the requester's printed name when no
   AUTHORED signature exists (submission is not a §19 ceremony in this build).
3. **Budget hooks for REIMBURSEMENT / non-PO ADVANCE deferred to Phase 11** (the dedicated budget
   phase): payment-request lines carry no item/category, so §10a's commitment rule needs the
   category-mapping decision that Phase 11 owns. PO-backed payments are already counted via the PO
   (no double-count).
4. **Advance-settlement difference** (payable/refundable) is represented by the settlement's own
   line total; no separate net-off posting in v1.
5. VENDOR_PAYMENT creation is also allowed to ADMIN (spec: ACCOUNTANT or PURCHASER).

### ⚠️ Known limitations
- "Outstanding advances" dashboard widget lands with Phase 12 (dashboards).
- Partial payment of a payment request is out of scope (invoices cascade fully PAID per the
  acceptance test; PARTIALLY_PAID stays available on invoices from Phase 7).

---

## Phase 7 — GRN · Invoice · 3-Way Match · Payments · Budget — ✅ COMPLETE

**Summary.** The §9 receiving-to-payment loop is live end to end: WAREHOUSE receives against open
POs with outstanding quantities shown and over-receipt hard-blocked (tolerance 0%); QC splits each
receipt into accepted/rejected (reason required) and the acceptance is a §19 signature (RECEIVED)
— accepted quantities post to the PO lines, rejected quantities keep the line open, and the PO
auto-moves SENT → PARTIALLY_RECEIVED → RECEIVED. ACCOUNTANT enters vendor invoices with lines
defaulted from received-not-yet-invoiced at PO prices; the 3-way match compares PO price/qty ↔ GRN
accepted ↔ invoice per line (tolerances: qty 0%, price 2%) with per-line diffs; verifying is a
signature (VERIFIED) and a MISMATCH can only be verified with an override comment that lands in
the Exception register (TOLERANCE_OVERRIDE). Payments: due date derives from the vendor's terms,
mark paid / partially paid are PAID signatures, and the register shows overdue aging buckets
(0–30/31–60/61–90/90+). The §9 budget ledger runs on real hooks: PR approval commits, PO approval
moves commitment PR→PO, verified invoices move commitment→spent, closing a PO releases the rest —
visualised on the /budgets dashboard (spent/committed/remaining bars per cost center × category).

### Built
- **lib/budget/index.ts** — the ledger: `commitPr`, `moveCommitmentPrToPo`, `spendOnInvoice`,
  `releaseOnPoClose`; per-line budget resolution (explicit PrLine.budgetId, else cost center ×
  item category × FY), zero-clamped, best-effort on missing rows. Hooks wired into decidePr /
  decidePo / verifyInvoice / closePo.
- **GRN** (`goods-receipts/`): createGrn (open-PO guard, outstanding math, over-receipt block,
  HML-GRN docnum, QC_PENDING), acceptGrn (accepted+rejected must equal received; reject reason
  required; RECEIVED signature; PoLine.receivedQty += accepted; GRN → ACCEPTED /
  PARTIALLY_REJECTED / REJECTED; PO status auto-update). Register + receive form (PO picker with
  outstanding) + detail with QC panel and signature block.
- **Invoice** (`invoices/`): createInvoice (received-not-invoiced defaults, vendor-terms due date,
  PO VAT, HML-INV docnum, first-pass match stored), computeMatch (per-line price Δ% vs 2% + qty vs
  GRN-accepted-uninvoiced at 0%), verifyInvoice (VERIFIED signature; mismatch needs override →
  Exception TOLERANCE_OVERRIDE; posts invoicedQty; budget spend), markInvoicePaid (PAID signature;
  PAID/PARTIALLY_PAID; requires prior verification). Register with aging chips + match/payment
  badges; detail with the full match table (per-line diffs highlighted) and signature block.
- **Budgets dashboard** (`/budgets`): FY rows with navy spent / amber committed bars, remaining,
  over-budget flag.
- Seed: HML-PR-2026-0003 (CONVERTED) + HML-PO-2026-0001 (SENT, PR-linked, item-linked line) so the
  whole loop is demoable at once; CC-ENG × CONS budget row added.
- i18n: full grn / invoice / budgets namespaces + GRN/match/payment status labels (EN/VN).

### E2E evidence (browser, fresh seed)
- Over-receipt of 150 vs 100 outstanding → blocked with the tolerance-0% error.
- GRN-0001: received 60 → QC accepted 55 / rejected 5 ("Hộp móp, bu lông gỉ sét…") → RECEIVED
  signature by the warehouse keeper → PoLine.receivedQty 55, GRN PARTIALLY_REJECTED, PO
  PARTIALLY_RECEIVED. GRN-0002: +20 accepted.
- INV-0001: defaults 55 @ 300,000 → MATCHED → VERIFIED signature → invoicedQty 55 → budget
  CC-ENG×CONS spent 16.5M → PAID signature + paidDate; due = invoice date + 30d vendor terms.
- INV-0002: 20 @ 320,000 (Δ 6.7% > 2%) → MISMATCH badge + per-line diff; verify without a comment
  correctly REFUSED; override with justification → Exception TOLERANCE_OVERRIDE + VERIFIED-with-
  reason signature → invoicedQty 75 → spend 22.9M.
- Budget commit: approving the 50M PR (L1+L2 signed) committed its three lines by item category —
  CC-ENG×HVAC 16.8M, ×ELEC 2.56M, ×CONS 1.45M. /budgets renders the bars (screenshot-verified).
- Zero console errors; `npm run check` clean.

### ⚠️ Decisions made without asking (§23)
1. **Partial payments are a status only** — Invoice has no paidAmount column; PARTIALLY_PAID marks
   the state (full amount tracking can add a column in a later phase if needed).
2. **Invoice "verified" = the VERIFIED signature's existence** (no extra schema flag); markPaid
   requires it.
3. **Budget effects skip non-item lines** and pairs without a budget row (best-effort ledger);
   §9's WARN/BLOCK over-budget gating on submit is deferred to the governance phase (§15) where
   the per-department config model lands.
4. **Stock posting deferred** — GRN acceptance does not yet write StockMovement/StockBalance;
   that is Module I (§10b/§21) territory where lib/stock/post-movement.ts becomes the single
   writer. GRN ↔ stock wiring lands there.
5. **QC is one step with the receipt** (create QC_PENDING → accept/reject+sign) rather than a
   separately-routed QC role — matches "optional QC step" with the §19 ceremony.
6. **Invoice register visible** to ACCOUNTANT/ADMIN/PURCHASER/DIRECTOR/DEPT_MANAGER; create/verify/
   pay restricted to ACCOUNTANT/ADMIN.

### ⚠️ Known limitations
- Invoice XML import (§16 e-invoice) and the invoice-file attachment reuse land with governance/
  compliance (Phase 15 per §12 numbering).
- releaseOnPoClose is unit-consistent with the ledger but exercised via code path only (no UI E2E
  this round — closing the demo PO would have blocked further invoicing demos).
- Aging buckets compute on render; a scheduled digest email of overdue invoices belongs to the
  notifications hardening.

---

## Phase 6 — RFQ / Sourcing — ✅ COMPLETE

**Summary.** The §8 sourcing loop is live: RFQs are created from an approved PR (lines copied) or
standalone and sent to ≥1 APPROVED vendors — each vendor gets a bilingual branded RFQ PDF by email;
the 3-quote rule (>100M ₫ needs ≥3 vendors) can be overridden only with a justification that lands
in the Exception register as SINGLE_SOURCE. Received quotes are entered per vendor (line prices,
lead time, terms, validity) and meet in a comparison matrix — lines × vendors with the lowest price
per line and the lowest total highlighted emerald, plus totals / lead-time / terms rows. Awarding a
quote that is NOT the lowest requires a justification (Exception NON_LOWEST_AWARD). The award
creates the PO prefilled from the winning quote (linked via PO.quoteId; consumes the source PR →
CONVERTED) and the RFQ closes as AWARDED. E2E-verified in the browser.

### Built
- **lib/schemas/rfq.ts** — rfqCreateSchema (title, dueDate, vendorIds ≥1, lines) + quoteEntrySchema.
- **rfqs/actions.ts** — `createRfq` (docnum HML-RFQ-2026-####, APPROVED-vendor guard, PR guard),
  `sendRfq` (DRAFT→SENT; 3-quote override → Exception SINGLE_SOURCE; per-vendor PDF email via
  sendMailRaw; sentAt stamps), `enterQuote` (replace-on-reentry; Decimal line totals; respondedAt),
  `awardQuote` (lowest-total comparison; NON_LOWEST_AWARD exception; PO via createPo with quote
  prices/vendor/currency/fx/terms + quoteId; RFQ SENT→AWARDED; quote.isSelected), `closeRfq`.
- **lib/pdf/RfqPdf.tsx + rfq-data.ts + /api/rfq/[id]/pdf?vendor=** — per-vendor RFQ PDF on the
  §10 letterhead: blank price/lead-time columns to fill, bilingual ask ("Vui lòng báo giá…"),
  terms-requested block, Page X/Y footer. Be Vietnam Pro fonts (§22.4).
- **UI** — RFQ register (quotes n/m column), create form (vendor chip multi-select with the
  3-quote hint; lines from PR or manual), detail page: invited-vendors panel (sent/responded
  badges, per-vendor PDF links, quote entry/edit), quote-entry panel, the comparison matrix with
  emerald lowest-per-line + lowest-total, award buttons, close. "Create RFQ" button on approved
  PRs beside Create PO.
- **PO link** — poCreateSchema + createPo accept `quoteId`; award populates it.
- i18n: full `rfq` namespace EN/VN + status AWARDED.

### E2E evidence (browser, fresh seed)
- Approved PR (30M) → Create RFQ: lines prefilled, 3 vendor chips selected, due 15/07/2026.
- Send → 3 dev-log emails, each `attachments=[HML-RFQ-2026-0001.pdf]`; all vendors stamped sent.
- RFQ PDF text-verified via pdf.js: "REQUEST FOR QUOTATION", "Yêu cầu báo giá", "Vui lòng báo
  giá…", doc number + due date.
- 3 quotes entered (unit 320k / 295k / 310k × 100) → matrix totals 32M / 29.5M / 31M with 295,000
  and 29,500,000 ₫ emerald-highlighted.
- Awarded the NON-lowest (V-FRT01, 31M — shorter lead time): justification captured →
  Exception NON_LOWEST_AWARD row; RFQ AWARDED; quote.isSelected on the 31M quote only; redirected
  to the created PO: HML-PO-2026-0001, vendor V-FRT01, subtotal 31,000,000 + VAT 10% =
  34,100,000 ₫, PO.quoteId + PO.prId set, source PR → CONVERTED; PO PDF downloads (36 KB, %PDF).

### ⚠️ Decisions made without asking (§23)
1. **3-quote rule enforcement point** — at SEND (invited-vendor count vs the source PR estimate),
   since quotes don't exist yet at that moment; awards additionally police NON_LOWEST_AWARD.
   Standalone RFQs have no estimate (0) and don't trigger the rule.
2. **Award is audited, not e-signed** — §19's controlled-action list doesn't name quote awards, and
   the resulting PO immediately routes through the §6 engine with full signatures; the award writes
   an AuditLog row (+ Exception when not lowest). Can be upgraded to a signature in the governance
   phase if audits want it.
3. **Quote attachment upload deferred** — the Quote model carries attachmentId; wiring the file
   upload reuses the Phase-3 attachment panel and lands with the invoice work in Phase 7.
4. **Re-entering a vendor's quote replaces it** (delete + recreate in one transaction) — keeps one
   live quote per vendor per RFQ, matching the whole-quote-award v1 model.
5. **Award VAT default 10%** — the PO from a quote starts at the default VAT rate; the purchaser
   can adjust on the PO before submitting it for approval.
6. **RfqLine.uomId fallback** — quote-award PO lines fall back to the first UoM when an RFQ line
   has no unit (standalone free-text lines).

### ⚠️ Known limitations
- Per-line awards are v2 (spec: whole-quote award for v1).
- Quote-file attachments + the RFQ responded-tracking UI beyond badges come with Phase 7's
  document work.
- The award justification uses window.prompt (same pattern as blacklist; a styled dialog is a
  UI-polish item).

---

## Phase 5 — Purchase Order Module — ✅ COMPLETE

**Summary.** The §8 PO module is live end to end: POs are created from an APPROVED PR (lines,
prices and department prefilled; the PR flips to CONVERTED) or standalone (PURCHASER/ADMIN);
they route through the Phase-4 approval engine on the same amount bands; approval decisions are
§19 electronic signatures with the hash chain; an APPROVED PO is SENT to the vendor by email with
the branded PDF attached (CC the purchaser); the PDF is Vietnamese-safe on bundled Be Vietnam Pro
fonts with the §10 letterhead style. The §7 vendor lifecycle (DRAFT → PENDING → APPROVED by a
Director signature; APPROVED → BLACKLISTED with reason) runs through the same engine. The
approvals queue now serves PRs, POs and vendors from one screen.

### Built
- **Schema:** `PurchaseOrder.createdById` (+ `User.purchaseOrders` relation) — migration
  `po_created_by`. Needed for no-self-approval, notifications and PO list scoping.
- **lib/pdf/** — `fonts.ts` registers bundled Be Vietnam Pro Regular/Bold/Italic TTFs (§22.4
  gotcha: default PDF fonts break ế/ữ/đ) with hyphenation disabled; `PoPdf.tsx` = the branded
  A4 document (two-tone emerald/navy bar, wordmark, doc no + `HML-PO · Rev 01.0` top-right,
  bilingual EN·VN field labels with VN italic, navy table headers, totals block, §19 signature
  block, fixed footer `Page X / Y`); `po-data.ts` assembles the serializable payload (Decimal →
  grouped strings at the boundary). Route: `GET /api/po/[id]/pdf` (auth-guarded, nodejs runtime).
- **PO lifecycle** (`purchase-orders/actions.ts`): `createPo` (Zod schema `lib/schemas/po.ts` with
  the 11 Incoterms 2020 + VAT 0/5/8/10; vendor must be APPROVED; docnum `HML-PO-2026-####` inside
  the create transaction; subtotal/VAT/total computed in Decimal; PR APPROVED→CONVERTED),
  `submitPo` (rollback-safe step creation; department = source PR's dept, else creator's),
  `decidePo` (sign → engine → PENDING_APPROVAL→APPROVED / back to DRAFT), `sendPo` (APPROVED→SENT,
  emails the PDF via nodemailer with attachment + CC), `cancelPo` (blocked once a GRN exists),
  `closePo`.
- **Vendor lifecycle** (`vendors/actions.ts`): `submitVendorForApproval` (DRAFT→PENDING, VENDOR
  matrix row: one Director level), `decideVendor` (signature + engine; PENDING→APPROVED/DRAFT),
  `blacklistVendor` (reason required); `VendorLifecyclePanel` on the vendors page.
- **UI:** PO register (role-scoped), PO create form (from-PR prefill via `?fromPr=`, incoterm +
  named place, VAT select, live totals), PO detail (meta, lines, approval timeline + inline
  decision bar + signature block with chain, audit tab, PDF/Submit/Send/Close/Cancel actions),
  "Create PO from this PR" button on approved PRs; the approvals queue generalized with a Type
  column (PR/PO/Vendor) and a `decideEntity` dispatcher; `DecideInline` made entity-generic.
- **Seed:** PO matrix (same bands as PR) + VENDOR matrix (Director, any amount); demo PR
  HML-PR-2026-0002 seeded APPROVED (completed steps) so Create-PO is demoable immediately.
- i18n: full `po` namespace + vendors.lifecycle + approvals type labels + PO/vendor status labels
  (EN/VN).

### E2E evidence (browser, fresh seed)
- Purchaser → approved PR → Create PO: form prefilled (30,000,000 ₫ line), DAP + named place
  "Nhà máy Long Thành, Đồng Nai", VAT 10% → PO HML-PO-2026-0001 DRAFT with subtotal 30,000,000 /
  VAT 3,000,000 / total 33,000,000; source PR → CONVERTED.
- Submit → steps L1 mgr.eng (the PR's department manager) + L2 director.fin; approvals queue
  showed the PO row typed "PO"; both approved via the signing ceremony → PO APPROVED; signature
  #2 chains to #1.
- Send to vendor → SENT; dev mail log shows `to=sales@cleanair.vn cc=purchaser@…
  attachments=[HML-PO-2026-0001.pdf]`.
- PDF text-extracted via pdf.js: "PURCHASE ORDER / Đơn đặt hàng", "NHÀ CUNG CẤP", Vietnamese
  diacritics correct, both signature names present, `Page 1 / 1`, grouped totals (33,000,000).
- Vendor V-E2E01: DRAFT → submitted (PENDING, "awaiting Director") → approved from the queue with
  a Director signature → APPROVED.

### ⚠️ Decisions made without asking (§23)
1. **PO rejection state** — PoStatus has no REJECTED; Reject and Return both transition the PO
   back to DRAFT (the decided step + signature + comment retain the full history; purchaser can
   fix and resubmit).
2. **PO approval department** — the matrix's DEPT_MANAGER level resolves against the source PR's
   department; a standalone PO uses the creator's department.
3. **PDF wordmark** — no logo asset exists in the repo (`public/` holds no logo.png); the PDF uses
   the same typographic wordmark as the app shell. Drop `public/logo.png` in later and swap.
4. **RFQ path deferred** — §8's create-from-awarded-quote lands with Phase 6 (RFQ module); the
   create form covers from-PR + standalone now.
5. **Vendor approval snapshot** — signs over code/name/taxCode/bankAccount/status (the §15
   bank-change control fields), not the full profile.
6. **Demo vendor E2E row** inserted via SQL for the lifecycle test (UI create works the same
   path through MasterDataManager).

### ⚠️ Known limitations
- PO PDF is EN-labeled with VN sublines per §10; a locale-driven full-VN variant can come with
  the reports phase if wanted.
- Contract price auto-fill (§9) and GRN-driven status updates (PARTIALLY_RECEIVED/RECEIVED) land
  in Phase 7; budget commitment move PR→PO in Phase 7's budget work.
- Blacklist uses window.prompt for the reason (functional; a styled dialog can replace it in the
  UI-polish pass).

---

## Phase 4 — Approval Engine + E-Signature Core — ✅ COMPLETE

**Summary.** The §6 approval workflow and §19 Part 11-aligned e-signature core are live and wired
into the PR lifecycle. Submitting a PR builds a sequential approval chain from the admin-configurable
ApprovalMatrix; every decision (Approve / Return / Reject) executes as an electronic signature with
password re-auth, snapshot hashing and a tamper-evident hash chain; approvers work from a
"Waiting for me" queue or inline on the PR detail page; in-app + email notifications fire at every
hand-off. E2E-verified in the browser end to end.

### Built
- **lib/esign/sign.ts** — `signRecord` (bcrypt password re-auth; SignatureFailure on wrong password;
  3 failures / 15 min ⇒ 15-min account lock + ADMIN alert; SHA-256 `recordSnapshotHash` of the
  canonical document JSON; `prevSignatureHash` chain per entity), `canonicalJson`, `signatureHash`,
  `verifyChain` (re-computes a chain; nightly job hook for the governance phase).
- **lib/workflow/engine.ts** — `createSteps` (matrix band match by entityType+amount, dept-scoped
  row preference, approver resolution: DEPT_MANAGER → the document department's manager first;
  DIRECTOR level 2 → non-chief director, level 3 → the chief/MD; **no-self-approval** skips the
  requester to the next eligible approver + audit entry; SLA due = +2 business days),
  `applyDecision` (sequential advance / reject / return; deletes not-yet-actioned later steps;
  notifies next approver or requester), `pendingStepsFor` (only the lowest pending level is
  actionable), `LEVEL_LABELS`.
- **lib/notify.ts** — Notification rows (bilingual EN/VN) + nodemailer email (SMTP_* from .env;
  console dev-transport when unset), `notifyRole` for ADMIN alerts, `unreadCount`.
- **/approvals** — the §6 queue: amount, requester, dept, level, age + SLA-overdue flag;
  Approve / Return / Reject through the SignatureDialog ceremony.
- **/notifications** — bilingual inbox behind the topbar bell; mark-read / mark-all-read.
- **PR wiring** — `submitPr` computes the chain and activates level 1 (rolls back to DRAFT if no
  matrix band/approver); new `decidePr` action (sign → decide → transition SUBMITTED→APPROVED/
  REJECTED/DRAFT with optimistic guards → audit incl. signature id); `recallPr` reworked: recallable
  until the first decision (steps now exist from submit); PR detail shows the live ApprovalTimeline,
  the signature block (name · meaning · time · reason · hash chain link) and a "waiting for YOUR
  decision" bar for the active approver.
- **Seed** — §6 default matrix (PR: <20M ⇒ L1; 20–200M ⇒ L1+L2; >200M ⇒ L1+L2+L3), new
  `director.fin@humiley.com` (Finance Director, L2), `director@humiley.com` marked chief (MD, L3);
  demo PR now carries its L1+L2 steps so the queue has data out of the box.
- i18n: full `approvals` + `notifications` namespaces (EN/VN) + `pr.signatureBlock`.

### E2E evidence (browser, fresh seed)
- 50,000,000 ₫ PR submitted by req.eng → steps L1 mgr.eng + L2 director.fin, level 1 active,
  SLA 2 business days, mgr.eng notified. **§6 acceptance:** L1 approval alone left the PR
  SUBMITTED (not approved).
- Wrong password in the dialog → "Password is incorrect. This attempt has been recorded." +
  SignatureFailure row. Correct password → step 1 APPROVED, snapshotHash stored, level → 2,
  director.fin notified.
- Director approval → PR **APPROVED**, requester notified; signature #2 carries the hash of
  signature #1 (chain verified in DB).

### ⚠️ Decisions made without asking (§23)
1. **L2 vs L3 director resolution** — the Role enum has one DIRECTOR value; §6 needs Director (L2)
   and Managing Director (L3). Resolution: matrix rows keep role DIRECTOR; the engine prefers a
   non-chief director at L2 and the `isChief` director (MD) at L3. Seeded a second director
   (Finance Director) so the two levels are distinct people.
2. **Signature failure lockout counter** — counted from SignatureFailure rows in the last 15 min
   (3 ⇒ lock), independent of the login `failedLogins` counter, so signing failures can't be
   reset by a successful login.
3. **Hash chain shape** — the schema stores `recordSnapshotHash` + `prevSignatureHash` only, so the
   chain links via `signatureHash(prevRow)` = SHA-256 over the previous row's canonical core fields
   (incl. its own prevSignatureHash); `signedAt` is written explicitly so re-hashing at verify time
   is deterministic.
4. **Reject/Return step disposal** — ApprovalStepStatus has no CANCELLED; not-yet-actioned later
   steps are deleted (the decided step keeps the full history; a resubmit builds a fresh chain).
5. **Delegation & SLA escalation deferred** — `delegatedFromId` exists on ApprovalStep, and slaDueAt
   is stamped; the delegation date-range model + reminder/escalation job belong to the governance
   phase (§15) with the nightly chain-integrity job.
6. **Boundary semantics** — bands seeded as integers: ≤19,999,999 / 20,000,000–200,000,000 /
   ≥200,000,001 (VND has no minor units in practice).

### ⚠️ Known limitations
- No-self-approval verified by code path + audit hook, not E2E (requires a manager-authored PR;
  covered when Playwright OQ pack lands in the validation phase).
- Daily digest email + SLA reminder/escalation (§6) and the nightly chain-integrity job (§19) are
  scheduled-job features — deferred to the governance phase alongside delegation.
- Approval matrix admin CRUD UI not yet built (seeded defaults; admin edits via DB/seed for now) —
  planned with the admin area completion.

---

## Phase 3 — Purchase Requisitions — ✅ COMPLETE

**Summary.** The PR module per §5: list, create/edit, detail, lifecycle actions, attachments,
audit, doc numbering and the free-stock hint — all requester-self-service, on the shared
components, bilingual, with money kept in Decimal on the server.

### ✅ Built
- **List** `/requisitions` — status tabs (All/Draft/Submitted/Approved/Rejected), search,
  Excel export, PR-number monospace chip, VND totals; staff see their own + their department's.
- **Create / edit** `/requisitions/new` + `/[id]/edit` — department locked to the requester,
  cost centers scoped to that department, needed-by date, purpose, project code, and a
  multi-line editor (`components/pr/PrLinesEditor`): catalog item picker (UoM auto-locked,
  last purchase price auto-filled) or free-text lines, qty × unit price = live VND amounts +
  estimated total. **§5 stock hint:** picking a catalog item shows the free stock on hand
  (aggregated across warehouses from `StockBalance`) as an emerald "In stock: N" note so
  requesters check the shelf before buying.
- **Detail** `/requisitions/[id]` — meta grid (requester/department/cost center/needed-by/
  project/created/estimated total), status badge, tabs: Details (lines), Approvals & Signatures
  (placeholder until Phase 4), Attachments (upload/download/delete), Audit (trail from
  `AuditLog`).
- **Lifecycle** (`app/(portal)/requisitions/actions.ts`) — `createPr` (docnum
  `HML-PR-YYYY-NNNN` via `lib/docnum` inside the same transaction as the insert), `updatePr`
  (DRAFT only, owner only, replaces lines), `submitPr` (owner, ≥1 line), `recallPr`
  (SUBMITTED + no approval started), `cancelPr` (DRAFT/SUBMITTED). All Zod-validated
  (`lib/schemas/pr.ts`), RBAC-checked, audited (`lib/audit`), revalidated.
- **`lib/workflow/transition.ts` (hard rule §22.2) — created and enforced.** Every status
  change goes through one optimistic-guarded conditional UPDATE (`WHERE id AND status IN from…`,
  count 0 ⇒ friendly stale error). Recall additionally re-checks `currentApprovalLevel = 0`
  inside the guard, so a racing approval blocks a recall at the DB, not just at read time.
- **Attachments** — `lib/storage` local-disk adapter (20 MB cap, uuid names, path-traversal
  guard, deliberately swappable for S3/SharePoint later), `POST /api/v1/attachments` (multipart)
  + `GET/DELETE /api/v1/attachments/[id]` (auth-gated), `Attachment` rows linked to the PR,
  uploader-or-admin delete, wired into the detail tab.
- **Seed** — `WH-MAIN` warehouse + 3 stock balances (gloves 120, HEPA 4, LED 25 — drives the
  stock hint) and demo PR `HML-PR-2026-0001` (3 lines, SUBMITTED, idempotent).

### 🔎 Verified
`npm run check` clean; production build compiles all routes; in-browser: login → list →
detail → **Recall → Draft → Submit → Submitted** through the guarded transitions; new-PR form
shows the stock hint + auto price (screenshot in session log); `transition()` proven to block a
wrong-from update and allow the right-from one against the live DB.

### ⚠️ Decisions made without asking (§23)
1. **Transition helper shape** — a tiny delegate-typed `transition(delegate, id, from, to,
   {data, where})` returning a boolean, rather than a string-keyed model registry; Phase 4's
   engine composes `data`/`where` for approval-level bumps.
2. **Stock hint scope** — free stock = SUM(`StockBalance.qtyOnHand`) across all warehouses
   (no reservation netting yet — reservations arrive with inventory in Phase 9); hidden when 0.
3. **Attachment storage** — local disk under `STORAGE_DIR` (default `./storage`, gitignored)
   behind the small adapter interface; SharePoint/S3 is a portal-integration decision, deferred.
4. **Seeded stock quantities** are deliberately small (HEPA = 4 < PR qty 6) so the Phase 9
   shortage/reservation flows will have a realistic demo case.

### ⚠️ Known limitations
- Approvals tab is a placeholder; `submitPr` does not yet generate approval steps or run the
  §9 budget check — both land with the Phase 4 engine (next).
- Action error messages are English-only strings surfaced by the client toast (i18n of server
  errors is a follow-up noted for the polish phase).
- Excel export exports the visible list (client-side), not a server-side full export.

---

## Phase 2 — Master Data — ✅ COMPLETE

**Summary.** CRUD for all master data — departments, cost centers, categories (tree + CAPEX
flag), units of measure, catalog items, and vendors — built on the §22.3 shared components, plus
Excel/CSV importers for items and vendors (§17). Seed extended with the full master-data set.

### Definition of Done (§22.6)
- ✅ `npm run check` — 0 type errors, 0 lint errors.
- ✅ `npm run seed` — OK (8 UoM, 5 categories, 5 cost centers, 20 items, 3 approved vendors,
  7 budgets FY2026, + Phase 1 depts/users).
- ✅ `npm run build` — all new routes compile.
- ✅ Acceptance demonstrated against seed data (authenticated runtime smoke test):
  - `/admin/{departments,cost-centers,categories,uom,items}` + `/vendors` all → 200, render
    seeded rows (verified `HVAC-AHU-05`, `V-CLEAN01`, `CC-ENG`).
  - Items import CSV → `{created:1, updated:1, skipped:0}`; vendors import → `{created:1}`.
  - Unauthenticated `POST /api/admin/import` → blocked (307 → login; route also `isAdmin`-guards).
- ✅ New strings in BOTH `messages/en.json` and `messages/vi.json` (`admin.md.*`, `vendors.*`).
- ✅ Every mutation: Zod (`lib/schemas/masterdata.ts`) + RBAC (`requireRoles`) + audit.

### Acceptance criteria (§22.7 prompt 2)
- ✅ Master-data CRUD (departments, cost centers, categories, items, UoM, vendors — no approval
  flow yet) using DocListPage-based lists. · ✅ xlsx importers for items and vendors (§17).

### Files of note
- `components/admin/MasterDataManager.tsx` — generic list + modal-form CRUD driven by a
  **serializable** column spec (`MdColumnSpec` with a `kind` discriminator) + field config.
- `components/admin/ExcelImportButton.tsx` + `app/api/admin/import/route.ts` — .xlsx (exceljs) /
  .csv importer with header mapping, upsert-by-code, per-row error report, template download.
- `lib/schemas/masterdata.ts`; `app/(portal)/admin/masterdata.actions.ts`;
  `app/(portal)/admin/{departments,cost-centers,categories,uom,items}/page.tsx`;
  `app/(portal)/vendors/{page,actions}.ts`.

### ⚠️ Decisions (this phase)
- **Serializable column spec** — the initial design passed `render`/`value` closures from Server
  Components into the client `MasterDataManager`, which is illegal across the RSC boundary
  (three pages 500'd). Refactored so pages pass a plain `MdColumnSpec` (`kind: text|money|status|
  bool|flag`) and the client builds the render closures. (Caught + fixed by runtime smoke test.)
- **Importers accept .xlsx and .csv**, keyed by header names; upsert by `code`; the "template"
  download is a header-only CSV (opens in Excel). Server-side parse (exceljs for xlsx). exceljs's
  bundled `Buffer` type lags `@types/node` 20 — cast to its own param type at the call site.
- **Vendors are created `DRAFT`** (default) and seeded `APPROVED`; the vendor **approval flow**
  (status transitions, evaluation) is Phase 5. Vendor CRUD allowed for ADMIN + PURCHASER; the
  vendor **detail page** (`/vendors/[id]` with DocDetailLayout) also lands in Phase 5.
- **Seed grows** — Phase 2 added master data + budgets. Budgets are per cost-center × category for
  the machine's current fiscal year.

### ⚠️ Known limitations
- Categories support a parent (tree) but the list is flat (indented tree view is cosmetic, later).
- Item stock policies / warehouses are NOT seeded yet (Phase 9 inventory).
- Master-data lists use client-side filter/sort/CSV-export (as in Phase 1); server pagination is
  layered if any list outgrows one page.

---

## Phase 1 — Foundation — ✅ COMPLETE

**Summary.** Project scaffold, full Prisma schema (all §4 entities) + migration, Auth.js v5
credentials auth with bcrypt + account lockout, RBAC + edge middleware gate, next-intl EN/VI,
the navy app shell (§11 nav, §10 brand), a role-aware dashboard, admin user CRUD, the seed
script (§13 departments + all role logins), and every §22.3 shared component.

### Definition of Done (§22.6)
- ✅ `npm run check` — 0 type errors, 0 lint errors.
- ✅ `npm run seed` — migrate reset + seed OK (5 departments, 9 users).
- ✅ `npm run build` — all routes + middleware compile.
- ✅ Acceptance demonstrated against seed data (runtime smoke test):
  - `/login` → 200, renders brand + form.
  - `/dashboard` unauth → 307 → `/login?callbackUrl=…` (middleware gate).
  - Real login `admin@humiley.com / Humiley@2026` → 302 + session `{roles:["ADMIN"], isChief,
    departmentId, locale, mustChangePw}`.
  - Wrong password → `?error=CredentialsSignin`, no session.
- ✅ New strings in BOTH `messages/en.json` and `messages/vi.json`.
- ✅ Admin user mutations have Zod (`lib/schemas/user.ts`) + RBAC (`requireRoles("ADMIN")`) +
  audit (`lib/audit`). (E-signature applies from Phase 4.)

### Acceptance criteria (§12.1)
- ✅ Auth + RBAC middleware · ✅ app shell (§11 nav, §10 brand) · ✅ i18n en/vi ·
  ✅ full Prisma schema up front · ✅ seed script · ✅ admin user CRUD · ✅ all §22.3 shared
  components built once for reuse.

### Files of note
- lib: `db, money, dates, docnum (SELECT FOR UPDATE), audit, rbac, auth(.config), cn, status,
  schemas/user`.
- shell: `components/shell/{nav,Sidebar,Topbar,AppShell,LocaleSwitcher,UserMenu}`.
- shared (§22.3): `DocListPage, DocDetailLayout, StatusBadge, ApprovalTimeline, SignatureDialog,
  LineItemsEditor, AttachmentPanel, MoneyInput, VndDisplay, BilingualLabel, EntityLink, Logo,
  KpiCard`.
- routes: `app/login`, `app/(portal)/{layout,dashboard,admin/users}`, `app/api/auth/[...nextauth]`.

### ⚠️ Decisions (this phase)
- **i18n without route prefix** — next-intl cookie-based locale (`NEXT_LOCALE`) instead of
  `[locale]` segments, matching §11's flat routes. Switcher sets the cookie + `router.refresh()`.
- **Auth.js v5 split** — edge-safe `lib/auth.config.ts` (no Prisma/bcrypt) for middleware;
  full `lib/auth.ts` (Credentials + bcrypt + lockout after 5 fails / 15 min) node-side. Session
  augmented via `types/next-auth.d.ts`; token reads cast in the session callback (beta typing
  gap). Session strategy JWT, 12h.
- **DocListPage filtering is client-side** over server-provided rows; Export emits UTF-8 CSV
  (BOM, Excel-compatible). True server pagination + `exceljs` xlsx are layered per-register /
  in the reports phase (§12.12). Recorded so it isn't mistaken for "done".
- **SignatureDialog / AttachmentPanel** are the reusable UI shells; the esign crypto
  (`lib/esign/sign.ts`) lands in Phase 4 and the storage adapter (`lib/storage`) from Phase 3.
- **Seed is phased** — Phase 1 seeds departments + the 9 §13 login accounts (all roles, password
  `Humiley@2026`, `mustChangePw`). Master data / warehouses / reference / demo chain are seeded
  by their owning phases (2, 9, 14, +final).
- **`npm run seed` consent** — Prisma 6.19's AI-agent guard on `migrate reset` was satisfied by
  passing the user's standing master-prompt authorization via
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`; target is the local dev DB
  `localhost:5432/humiley_procurement` (no production data). Future phases do the same for seed.

### ⚠️ Known limitations
- Dashboard shows foundational KPIs (my PRs, pending approvals, open POs, unread) + recent audit
  activity; the full role-aware charts/reports (§10) are Phase 12.
- Nav links to not-yet-built routes (requisitions, rfqs, …) will 404 until their phase.
- First-login forced password change is flagged (`mustChangePw`) but the change-password screen
  is a small follow-up (added with the account/profile area).

---

## Phase 1 — Foundation — (build log)

### ✅ Built so far
- Dedicated Next.js 14.2.35 project (TypeScript, Tailwind, App Router, no `src/`) in its own git repo.
- All runtime deps installed: Prisma 6, Auth.js v5 (`next-auth@beta`), Zod, react-hook-form, TanStack Table, next-intl, exceljs, @react-pdf/renderer, recharts, bwip-js, @zxing/browser, nodemailer, decimal.js, date-fns(-tz), lucide-react.
- Dev deps: tsx, @playwright/test, @types/*.
- **Full Prisma schema (§4)** — all ~50 models + enums, indexes on status/number/FK. `prisma validate` clean; `migrate dev --name init` applied — all tables created in Postgres.
- Prisma client generated; `lib/db.ts` singleton.
- Config: `CLAUDE.md` (§22.1), `.claude/settings.json` (§23), `.env`/`.env.example`, package.json scripts (`check`, `seed`, `test:e2e`), §22.2 folder skeleton.
- `npm run check` passes (0 type errors, 0 lint errors).

### ▶️ Remaining in Phase 1 (nextAction)
auth (Auth.js Credentials + bcrypt) → RBAC (`lib/rbac.ts`) → core lib (`money`, `dates`, `docnum`, `audit`) → i18n (next-intl en/vi + middleware + `(portal)` route group) → app shell (sidebar nav §11, brand §10 Tailwind theme) → seed script (§13) → admin user CRUD → the §22.3 shared components. Then finalize this Phase 1 report + `phase-1` commit.

### ⚠️ Decisions made without asking (§23)
1. **Build location** — a dedicated `humiley-procurement/` folder with its **own git repo**, isolated from the parent Humiley TimeKeeping (Python single-file) app that the spec was dropped into. Rationale: unrelated stacks/histories; §24 setup itself assumes a dedicated folder. Spec copied into the folder.
2. **Next.js pinned to 14.2.35** — spec says "Next.js 14+"; chose stable 14 (not 15) for library/Node-26 compatibility.
3. **Prisma pinned to v6.19.3** — `npm install` pulled v7 (breaking changes: config file, generator, client output); downgraded to stable v6 to de-risk a large build. Classic `@prisma/client` import pattern.
4. **Database** — local Homebrew **PostgreSQL 16** at `localhost:5432`, database `humiley_procurement`, trust auth for local dev (a Dockerized Postgres is also available as fallback).
5. **Money/precision** — `Decimal(18,2)` amounts, `Decimal(18,4)` qty & precise unit prices, `Decimal(18,6)` FX; VND formatting at display (`lib/money.ts`).
6. **IDs** — `cuid()` string primary keys throughout.
7. **Schema extensions beyond §4's shorthand** (implied by later sections): `ApprovalEntityType` extended with `PAYMENT_REQUEST`/`GOODS_ISSUE`/`STOCK_COUNT`; `ExceptionType` + `FEFO_OVERRIDE`/`EXPIRED_ISSUE`; added `RfqLine` model (required by `QuoteLine.rfqLineId`); `User.isChief`/`mustChangePw`/bank/lockout fields (§10a/§19); PO landed-cost header fields + `cooFormTypeId` (§20); `StockBalance`/`StockMovement`/line lot fields (§21).

### ⚠️ Known limitations / TODOs
- Phase 1 not yet complete (auth/shell/seed/components pending) — see nextAction. This report will be finalized to the §23 format at the `phase-1` commit.
