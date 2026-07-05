# Humiley Procurement Portal — Build Specification

> **Instruction to Claude Code:** Read §22 (Execution Guide) FIRST — create CLAUDE.md, scaffold
> the §22.2 structure, and build the §22.3 shared components before any module. Then build
> module by module in the §12 phase order. After each phase, run `npm run check` + seed and
> verify the phase's acceptance criteria before moving on (§22.6). §22.5 lists what NOT to
> build. **If invoked with the §24 master prompt or script: one-click mode — run all phases
> 1→17 without stopping or asking; log everything to docs/PHASE-REPORTS.md and finish with
> docs/FINAL-REPORT.md.**

---

## 1. Project Overview

| Item | Value |
|---|---|
| Product | Procurement module for the Humiley Engineering & Solutions internal portal |
| Company | Humiley Engineering & Solutions (HVAC / cleanroom / GMP engineering, Vietnam) |
| Users | ~30–100 staff: requesters, department managers, purchasing team, directors, accounting, warehouse |
| Stack | Next.js 14+ (App Router, TypeScript), PostgreSQL 15+, Prisma ORM, Tailwind CSS, NextAuth.js |
| Language | Bilingual EN/VN — every UI label has both; English primary, Vietnamese secondary |
| Currency | VND primary (no decimals), USD secondary (2 decimals). Store currency + FX rate per document |
| Timezone | Asia/Ho_Chi_Minh |

## 2. Tech Stack & Conventions

- **Next.js App Router** with Server Components; Server Actions for mutations; Route Handlers only for file download/upload and webhooks.
- **Prisma** for schema + migrations. Seed script `prisma/seed.ts` with demo users, vendors, items, and one full PR→PO→GRN→Invoice chain.
- **NextAuth.js** — Credentials provider (email + bcrypt password) now; structure so Google/Microsoft SSO can be added later.
- **Zod** for all input validation (shared schemas between client forms and server actions).
- **react-hook-form** for forms; **TanStack Table** for data grids (server-side pagination, sorting, filtering).
- **File storage:** local `./storage` folder behind a storage interface (so S3/MinIO can swap in later). Attachments on PR, RFQ, PO, GRN, Invoice, Vendor, Contract.
- **PDF generation:** `@react-pdf/renderer` for PO and RFQ documents (see §10 brand rules).
- **Email:** Nodemailer with SMTP env vars; all notifications also stored in an in-app notification table.
- **i18n:** `next-intl` with `en` and `vi` message files; locale switcher in the header; persist per user.
- **Audit:** every create/update/status-change writes an `AuditLog` row (who, when, entity, before/after JSON).
- Env vars in `.env.example`: `DATABASE_URL`, `NEXTAUTH_SECRET`, `SMTP_*`, `APP_URL`, `DEFAULT_VAT_PCT=10`.

## 3. Roles & Permissions (RBAC)

| Role | Can do |
|---|---|
| `REQUESTER` | Create/edit own draft PRs, view own documents |
| `DEPT_MANAGER` | Everything REQUESTER + approve/reject PRs of own department (level 1) |
| `PURCHASER` | Manage vendors, items, RFQs, quotes, POs; convert approved PR → RFQ/PO |
| `DIRECTOR` | Approve level 2/3 (amount thresholds), approve vendors, approve contracts, view all |
| `ACCOUNTANT` | Invoice entry, 3-way match, payment requests (verify + mark paid), view all financials; `isChief` flag for Chief Accountant approval step |
| `WAREHOUSE` | Create GRNs against POs, quality-check results; goods issue execution, stock transfers, stock counts for own warehouse |
| `ADMIN` | User management, role assignment, approval-matrix config, budget config, master data, warehouses & stock policies |

Any authenticated user can create `ADVANCE` / `REIMBURSEMENT` payment requests and goods-issue requests.

A user can hold multiple roles. Permissions enforced in server actions (never UI-only).

## 4. Data Model (Prisma — core entities)

```
User(id, email, name, passwordHash, roles[], departmentId, locale, isActive)
Department(id, code, nameEn, nameVn, managerId)
CostCenter(id, code, nameEn, nameVn, departmentId)
Budget(id, costCenterId, fiscalYear, categoryId, amountVnd, committedVnd, spentVnd)

Category(id, code, nameEn, nameVn, parentId)            // material/service categories
Item(id, code, nameEn, nameVn, categoryId, uom, specDescription, lastPriceVnd, isActive)
Uom(id, code, nameEn, nameVn)

Vendor(id, code, nameEn, nameVn, taxCode, address, contactName, contactEmail, contactPhone,
       paymentTermDays, bankName, bankAccount, status[DRAFT|PENDING|APPROVED|BLACKLISTED],
       rating, categories[])
VendorEvaluation(id, vendorId, period, qualityScore, deliveryScore, priceScore, serviceScore,
       overall, evaluatorId, notes)

PurchaseRequisition(id, prNumber, requesterId, departmentId, costCenterId, neededByDate,
       purpose, projectCode?, status[DRAFT|SUBMITTED|APPROVED|REJECTED|CANCELLED|CONVERTED],
       totalEstimatedVnd, currentApprovalLevel)
PrLine(id, prId, itemId?, freeTextDescription?, qty, uomId, estUnitPriceVnd, budgetId?, note)

ApprovalMatrix(id, minAmountVnd, maxAmountVnd, level, approverRole|approverUserId, departmentId?)
ApprovalStep(id, entityType[PR|PO|VENDOR|CONTRACT|INVOICE], entityId, level, approverId,
       status[PENDING|APPROVED|REJECTED], decidedAt, comment, delegatedFromId?)

Rfq(id, rfqNumber, prId?, title, dueDate, status[DRAFT|SENT|CLOSED|AWARDED], createdById)
RfqVendor(id, rfqId, vendorId, sentAt, respondedAt)
Quote(id, rfqId, vendorId, quoteRef, validUntil, currency, fxRate, leadTimeDays,
       paymentTerms, totalVnd, attachmentId?, isSelected)
QuoteLine(id, quoteId, rfqLineId, unitPrice, qty, amount)

PurchaseOrder(id, poNumber, vendorId, prId?, quoteId?, contractId?, currency, fxRate,
       paymentTerms, deliveryAddress, expectedDate, status[DRAFT|PENDING_APPROVAL|APPROVED|
       SENT|PARTIALLY_RECEIVED|RECEIVED|CLOSED|CANCELLED], subtotal, vatPct, vatAmount, total)
PoLine(id, poId, prLineId?, itemId?, description, qty, uomId, unitPrice, amount,
       receivedQty, invoicedQty)

GoodsReceipt(id, grnNumber, poId, receivedById, receivedDate,
       status[DRAFT|QC_PENDING|ACCEPTED|PARTIALLY_REJECTED|REJECTED], notes)
GrnLine(id, grnId, poLineId, qtyReceived, qtyAccepted, qtyRejected, rejectReason?)

Invoice(id, invoiceNumber, vendorInvoiceNo, vendorId, poId, invoiceDate, dueDate,
       currency, fxRate, subtotal, vatAmount, total,
       matchStatus[UNMATCHED|MATCHED|MISMATCH], paymentStatus[UNPAID|PARTIALLY_PAID|PAID],
       paidDate?, attachmentId)
InvoiceLine(id, invoiceId, poLineId, qty, unitPrice, amount)

Contract(id, contractNumber, vendorId, title, startDate, endDate, valueVnd, priceListJson?,
       status[DRAFT|ACTIVE|EXPIRED|TERMINATED], renewalAlertDays, attachmentId)

PaymentRequest(id, paymentRequestNumber, type[VENDOR_PAYMENT|ADVANCE|REIMBURSEMENT|ADVANCE_SETTLEMENT],
       requesterId, departmentId, costCenterId, vendorId?, payeeName, payeeBankName, payeeBankAccount,
       currency, fxRate, amount, paymentMethod[BANK_TRANSFER|CASH], dueDate, reason,
       status[DRAFT|SUBMITTED|APPROVED|REJECTED|PAID|CANCELLED], paidDate?, paidById?,
       advanceRequestId?)                       // links a settlement back to its advance
PaymentRequestLine(id, paymentRequestId, invoiceId?, poId?, description, amount)

Warehouse(id, code, nameEn, nameVn, address, keeperId, isActive)
StockBalance(id, warehouseId, itemId, qtyOnHand, avgCostVnd)         // unique(warehouseId, itemId)
StockMovement(id, movementNumber, type[GRN_IN|ISSUE_OUT|TRANSFER_IN|TRANSFER_OUT|ADJUST_IN|ADJUST_OUT|RETURN_IN],
       warehouseId, itemId, qty, unitCostVnd, refEntityType?, refEntityId?, note, createdById, postedAt)
GoodsIssue(id, issueNumber, warehouseId, requesterId, departmentId, costCenterId, projectCode?,
       purpose, status[DRAFT|SUBMITTED|APPROVED|ISSUED|REJECTED|CANCELLED], issuedById?, issuedAt?)
GoodsIssueLine(id, issueId, itemId, qtyRequested, qtyIssued, uomId, note)
StockTransfer(id, transferNumber, fromWarehouseId, toWarehouseId,
       status[DRAFT|IN_TRANSIT|RECEIVED|CANCELLED], createdById, receivedById?)
StockTransferLine(id, transferId, itemId, qty)
StockCount(id, countNumber, warehouseId, countDate, status[DRAFT|COUNTING|POSTED], notes)
StockCountLine(id, countId, itemId, systemQty, countedQty, varianceQty)   // posting creates ADJUST movements
ItemStockPolicy(id, itemId, warehouseId, minQty, maxQty, reorderQty)      // reorder alerts

Exception(id, type[SINGLE_SOURCE|NON_LOWEST_AWARD|TOLERANCE_OVERRIDE|OVER_BUDGET|URGENT|
       RETROSPECTIVE_PO|BANK_CHANGE], entityType, entityId, justification, approvedById, createdAt)
FxRate(id, currency, rateDate, rateToVnd, source[MANUAL|AUTO])

ElectronicSignature(id, userId, entityType, entityId, meaning[AUTHORED|REVIEWED|APPROVED|REJECTED|
       VERIFIED|RECEIVED|ISSUED|COUNTED|PAID], signedAt, fullNamePrinted, reason?,
       recordSnapshotHash, prevSignatureHash)        // hash-chained; append-only, no update/delete
SignatureFailure(id, userId, entityType, entityId, attemptedAt, ip)   // failed re-auth attempts

HsCode(id, code, descriptionEn, descriptionVn, uomCustoms, mfnDutyPct, vatImportPct, notes)
CooFormType(id, code[FORM_E|FORM_D|FORM_AK|FORM_AJ|FORM_AANZ|EUR1|CPTPP|FORM_S|FORM_VK],
       agreementName, countries[], preferentialDutyNote)
HsCodeDuty(id, hsCodeId, cooFormTypeId, preferentialDutyPct, conditions?)
ItemTrade(id, itemId, hsCodeId, originCountry, requiresImportLicense, licenseNote?)
ShipmentDoc(id, poId, type[CO|BL|AWB|INVOICE|PACKING_LIST|CQ|CA|MSDS|IMPORT_LICENSE|CUSTOMS_DECL],
       cooFormTypeId?, docNumber, issueDate, attachmentId, status[PENDING|RECEIVED|VERIFIED])

Lot(id, itemId, lotNumber, mfgDate?, expiryDate?, vendorId?, grnId?)   // lot/batch tracking
Barcode(id, code, type[ITEM|LOT|LOCATION|DOCUMENT], itemId?, lotId?, warehouseId?, binCode?,
       entityType?, entityId?, format[CODE128|QR], isActive)
// StockBalance + StockMovement + GrnLine + GoodsIssueLine + StockTransferLine + StockCountLine
// each gain optional lotId; movements gain scannedBarcodeId? for scan-audit

Attachment(id, entityType, entityId, fileName, mimeType, sizeBytes, storagePath, uploadedById)
Notification(id, userId, titleEn, titleVn, bodyEn, bodyVn, link, isRead)
AuditLog(id, userId, entityType, entityId, action, beforeJson, afterJson, createdAt)
Sequence(id, key, year, lastValue)   // for document numbering
```

**Document numbering** (reset yearly, via `Sequence` with row lock):
`PR-YYYY-#####`, `RFQ-YYYY-####`, `PO-YYYY-#####`, `GRN-YYYY-#####`, `INV-YYYY-#####`, `CTR-YYYY-####`,
`PMT-YYYY-#####` (payment request), `GI-YYYY-#####` (goods issue), `TRF-YYYY-####` (transfer),
`CNT-YYYY-####` (stock count).

## 5. Module A — Purchase Requisition (PR)

- Requester creates PR: header (department auto from user, cost center, needed-by date, purpose, optional project code) + lines (pick item from catalog OR free text, qty, UoM, estimated unit price; line total and PR total auto-calc).
- Attachments (spec sheets, drawings) required optional per line.
- Status flow: `DRAFT → SUBMITTED → APPROVED / REJECTED → CONVERTED (to RFQ or PO) / CANCELLED`.
- Requester can edit/cancel only in DRAFT; can recall from SUBMITTED if no approval yet given.
- On submit: **budget check** (§9) — warn or block per config; generate approval steps from the matrix (§6).
- PR list page: my PRs / department PRs / all (per role), filter by status, date range, cost center; full-text search on purpose and line descriptions.
- PR detail page: header, lines, approval timeline (who/when/comment), linked RFQ/PO, audit trail, attachments.

**Acceptance:** a REQUESTER can create a 3-line PR, submit it, and see it appear in their manager's approval queue with correct total.

## 6. Module B — Approval Workflow

- **Approval matrix** (admin-configurable, per amount band):
  - default seed: `< 20,000,000 VND` → Level 1 (Dept Manager) only;
    `20M–200M` → L1 + L2 (Director); `> 200M` → L1 + L2 + L3 (Managing Director).
- Steps execute sequentially; each approver can **Approve / Reject (comment required) / Return for revision**.
- **Delegation:** a user can delegate approvals to another user for a date range (record `delegatedFromId`).
- Rejection returns PR to requester in `REJECTED` with reason; requester may duplicate to a new draft.
- Same engine reused for PO approval, vendor approval, contract approval (entityType generic).
- **Notifications:** in-app + email on: pending approval, approved, rejected, returned. Daily digest email of pending items.
- **SLA & escalation:** configurable per level (default 2 business days). Overdue → reminder email; at 2× SLA → auto-escalate notification to the next level and the requester. Approval cycle time is measured per step (feeds the KPI report §18).
- **No self-approval (hard rule):** a user can never approve a document they created, even if the matrix maps to them — the engine skips to the next eligible approver of the same level and logs it.
- Approval queue page: "Waiting for me" with amount, requester, age; approve/reject inline or in detail view.

**Acceptance:** a 50M VND PR requires L1 then L2; approving L1 alone does not mark the PR approved; rejecting at L2 with a comment notifies the requester.

## 7. Module C — Vendor Management

- Vendor master: legal name (EN/VN), tax code (validate 10 or 13 digits VN format), addresses, contacts, bank info, payment terms, categories supplied.
- Lifecycle: `DRAFT → PENDING → APPROVED` (Director approval via approval engine) → optional `BLACKLISTED` (reason required, blocks selection on RFQ/PO).
- **Evaluation:** quarterly scorecards (quality, delivery, price, service — 1–5 each, weighted overall); auto-computed KPIs shown on vendor page: on-time-delivery % (from GRN vs PO expectedDate), rejection rate (from GRN QC), total spend YTD.
- Vendor detail: profile, contracts, POs, invoices, evaluations, documents (license, ISO certs with expiry dates + expiry alerts).

## 8. Module D — RFQ / Sourcing & Module E — Purchase Order

**RFQ:**
- Create from approved PR (lines copied) or standalone. Select ≥1 vendors (default policy: **minimum 3 quotes** for amounts > 100M VND — configurable; allow override with justification text, logged).
- Generate RFQ PDF per vendor and send via email from the app; track sent/responded.
- Enter received quotes manually (per vendor: prices per line, lead time, payment terms, validity, attachment of their quote file).
- **Comparison table:** lines × vendors matrix, lowest price per line highlighted (emerald), totals row, lead time and terms rows; select winning quote (whole-quote award for v1; per-line award later). Award requires a short justification if not the lowest price.

**PO:**
- Create from awarded quote (auto-fill vendor, prices) or directly from approved PR (for contract/known prices) or standalone (PURCHASER only).
- Header: vendor, currency + FX rate, payment terms, **Incoterms 2020** (for import POs: EXW/FOB/CIF/DDP/DAP + named place), delivery address, expected date, warranty terms, reference PR/RFQ/contract. Lines with qty/price/VAT; subtotal, VAT (default 10%, editable 0/5/8/10), grand total.
- PO approval via approval engine (same amount bands), then `SENT` (email PDF to vendor with CC purchaser).
- **PO PDF** on Humiley letterhead style (§10): logo, two-tone bar, bilingual field labels, terms block, signature block.
- Status auto-updates from GRN: `PARTIALLY_RECEIVED` / `RECEIVED`; manual `CLOSED` / `CANCELLED` (cancel blocked if any GRN exists).

**Acceptance:** PR → RFQ to 3 vendors → enter 3 quotes → comparison shows lowest highlighted → award → PO generated with correct totals → PO PDF downloads.

## 9. Module F — GRN, 3-Way Match, Budget, Contracts

**Goods Receipt (GRN):**
- WAREHOUSE selects an open PO, sees outstanding qty per line, enters received qty; over-receipt blocked beyond configurable tolerance (default 0%).
- Optional QC step: accepted vs rejected qty + reason; rejected qty reopens PO line.
- Partial deliveries: multiple GRNs per PO.

**Invoice & 3-way match (ACCOUNTANT):**
- Enter vendor invoice against a PO; lines default from received-not-yet-invoiced quantities.
- Auto-match: for each line compare **PO price/qty ↔ GRN accepted qty ↔ Invoice qty/price**. Tolerance config (default: qty 0%, price 2%). Result `MATCHED` or `MISMATCH` with per-line diff display.
- MISMATCH requires ACCOUNTANT override with comment, or correction.
- Payment tracking: due date from payment terms, mark paid/partially paid; aging view (0–30/31–60/61–90/90+).

**Budget control:**
- Budget per cost center × category × fiscal year (admin upload via xlsx import or form).
- On PR approval: add PR total to `committedVnd`. On PO approval: move commitment PR→PO amounts. On invoice matched: move to `spentVnd`, release remaining commitment on PO close.
- Config per department: over-budget behavior = `WARN` (approver sees red banner) or `BLOCK` (cannot submit).
- Budget dashboard: bar per cost center — spent / committed / remaining vs budget.

**Contracts:**
- Framework agreements per vendor: validity, value, optional price list (item → contracted price). When creating a PO for a vendor with an active contract, contracted prices auto-fill and price edits are flagged.
- Renewal alerts N days before `endDate` (default 60) → notification to PURCHASER + DIRECTOR.

## 10. Module G — Dashboard, Reports & Brand/UI Rules

**Dashboard (role-aware):**
- Requester: my PRs by status, recent activity.
- Purchaser/Director: pending approvals, open POs, spend MTD/YTD, top 10 vendors by spend, PR→PO cycle time (avg days), savings (awarded vs highest quote), deliveries due this week, expiring contracts.
- Charts with **Recharts**; monthly spend trend, spend by category (donut), by department (bar).

**Reports (all exportable to xlsx via `exceljs`, respecting current filters):**
Spend by vendor / category / department / project; PR register; PO register; GRN register; invoice aging; vendor performance; budget vs actual; approval cycle-time report.

**Humiley brand (apply across the whole portal — Tailwind config):**
```js
colors: {
  navy:    "#205090",  // primary — headers, primary buttons, table headers
  emerald: "#00B060",  // accent — success, highlights, CTAs (≤10% of surface)
  body:    "#1F2937",  // body text
  grey:    "#5C6470",  // secondary text, VN sublines
  panel:   "#F7F9FC",  // panel/card backgrounds
  tintNavy:"#3168A8", tintLight:"#B5C8E5",
}
```
- 60/30/10 rule: ~60% white/light, ~30% navy, ~10% emerald. Never introduce other brand colors; status colors (red for reject/overdue, amber for warning) allowed functionally.
- Font: **Calibri**, fallback `ui-sans-serif, system-ui` (web-safe stack: `Calibri, 'Segoe UI', sans-serif`).
- Logo top-left in the app shell sidebar (placeholder `/public/logo.png`; navy version on white background — never stretch or recolor).
- **Bilingual rule:** English primary, Vietnamese *italic grey* secondary beneath or after a `·` — never reversed. Applies to UI labels, PDFs, emails.
- PDFs (PO/RFQ): two-tone top bar (emerald wider than navy), logo, doc number top-right, navy table headers, footer with `Page X / Y` + doc code `HML-PO-… Rev 01.0` style.
- Voice in emails/PDFs: direct, factual, no marketing fluff.

## 10a. Module H — Payment Request (Đề nghị thanh toán)

The bridge between procurement and actual payment execution. Four types:

| Type | Use case | Lines reference |
|---|---|---|
| `VENDOR_PAYMENT` | Pay a vendor for matched invoice(s) | 1+ `Invoice` (must be `MATCHED`, not fully paid) |
| `ADVANCE` | Tạm ứng — staff or vendor advance (e.g., PO down-payment, project cash advance) | optional `PO`; free amount |
| `REIMBURSEMENT` | Staff reimbursement for out-of-pocket expenses (receipts attached) | free lines + mandatory attachments |
| `ADVANCE_SETTLEMENT` | Hoàn ứng — settle a previous advance (actual spend vs advance; difference payable/refundable) | links `advanceRequestId` |

**Flow:** `DRAFT → SUBMITTED → APPROVED → PAID` (or `REJECTED`/`CANCELLED`).

- **Creation:** ACCOUNTANT or PURCHASER creates `VENDOR_PAYMENT` (pick vendor → open matched invoices listed with outstanding amounts → select; payee bank auto-fills from vendor master). Any user creates `ADVANCE`/`REIMBURSEMENT` (payee = self, bank details from user profile).
- **Approval:** reuses the approval engine (§6) with its own amount bands (seed: `<20M` → Dept Manager; `20M–200M` → + Chief Accountant (ACCOUNTANT role, flagged `isChief`); `>200M` → + Director). Every payment request additionally requires ACCOUNTANT verification step before final approval (checks invoice validity, tax compliance).
- **Payment execution:** ACCOUNTANT marks `PAID` with paid date + bank reference; this cascades: linked invoices → `paymentStatus = PAID/PARTIALLY_PAID`; advance ledger updated.
- **Advance control:** a user with an unsettled advance older than N days (default 30) is blocked from new advances; dashboard widget "Outstanding advances" for accounting.
- **Budget:** `REIMBURSEMENT` and non-PO `ADVANCE` hit budget commitment on approval, spent on payment (PO-backed payments are already counted via the PO — do not double-count).
- **PDF:** payment request voucher on brand letterhead (bilingual labels: "Payment Request · Đề nghị thanh toán"), signature blocks: Requester / Chief Accountant / Approver.
- **Aging view:** approved-not-paid list sorted by due date for the accountant's daily payment run.

**Acceptance:** two matched invoices for one vendor can be combined into one payment request; marking it PAID sets both invoices to PAID and the PO chain shows fully paid.

## 10b. Module I — Inventory / Warehouse Control

Stock control layer that closes the loop with procurement. Costing method: **moving average** (avgCost recalculated on every IN movement; OUT movements post at current avgCost). All stock changes go through `StockMovement` — `StockBalance` is never edited directly (update both in one DB transaction).

**Integration points with procurement:**

1. **GRN posts stock IN** — when a GRN line is `ACCEPTED`, create `GRN_IN` movement into the GRN's warehouse (add `warehouseId` to `GoodsReceipt` header) at PO line unit price → updates qtyOnHand + avgCost. Rejected qty never enters stock.
2. **Reorder → PR** — nightly job (and on every OUT movement) checks `ItemStockPolicy`: if `qtyOnHand + qty on open POs < minQty`, create a notification to PURCHASER and offer **"Generate PR"** — one click creates a draft PR with reorderQty lines, flagged `source = REORDER`. This closes the automation loop.
3. **Free-stock check on PR** — when a requester adds a catalog item to a PR, show current stock on hand across warehouses ("In stock: 12 pcs at WH-HCM — consider Goods Issue instead of purchase").
4. **Invoice/valuation** — inventory value report uses avgCost × qtyOnHand, reconcilable against GRN-invoice history.

**Sub-modules:**

- **Goods Issue (Xuất kho):** requester creates issue request (warehouse, lines, purpose, cost center/project) → Dept Manager approval (approval engine, entityType `GOODS_ISSUE`) → WAREHOUSE issues (can issue partial; qtyIssued ≤ qtyOnHand enforced) → `ISSUE_OUT` movements post, cost charged to the cost center (shows in budget `spentVnd` under a "from stock" bucket, and in spend reports by department/project).
- **Stock Transfer:** between warehouses; `TRANSFER_OUT` on dispatch (`IN_TRANSIT`), `TRANSFER_IN` on receipt confirmation by the receiving keeper.
- **Stock Adjustment / Count (Kiểm kê):** create count sheet for a warehouse (snapshot systemQty), enter counted quantities (xlsx import supported), variances shown, POSTING requires DIRECTOR approval, generates `ADJUST_IN/OUT` movements with reason.
- **Return to vendor:** from a GRN with rejected-after-acceptance goods — `RETURN_IN` reversal movement + credit-note note on the invoice side (v1: manual note; no auto credit note).
- **Stock card (Thẻ kho):** per item per warehouse — running movement ledger (date, doc no, in, out, balance) — the classic VN warehouse card, exportable to xlsx.
- **Inventory dashboard:** stock value by warehouse/category, items below min, zero-movement items > 90 days, in-transit transfers.

**Warehouse role additions:** WAREHOUSE = GRN + goods issue execution + transfers + counts for their own warehouse (`Warehouse.keeperId`); PURCHASER/DIRECTOR see all warehouses read-only; ADMIN manages warehouses and stock policies.

**Acceptance:** GRN acceptance of 10 pcs @ 1M raises WH stock by 10 and value by 10M; issuing 4 pcs posts OUT at avgCost, stock card shows both rows with running balance; dropping below minQty triggers the reorder notification with a one-click draft PR.

## 11. App Shell & Pages

```
/login
/dashboard
/requisitions            /requisitions/new        /requisitions/[id]
/approvals                                        (my queue, all entity types)
/rfqs                    /rfqs/new                /rfqs/[id]  (incl. comparison tab)
/purchase-orders         /purchase-orders/new     /purchase-orders/[id]
/goods-receipts          /goods-receipts/new      /goods-receipts/[id]
/invoices                /invoices/new            /invoices/[id]
/payment-requests        /payment-requests/new    /payment-requests/[id]
/vendors                 /vendors/new             /vendors/[id]
/contracts               /contracts/new           /contracts/[id]
/inventory               (stock overview by warehouse/item)
/inventory/issues        /inventory/issues/new    /inventory/issues/[id]
/inventory/transfers     /inventory/transfers/new /inventory/transfers/[id]
/inventory/counts        /inventory/counts/new    /inventory/counts/[id]
/inventory/stock-card/[itemId]
/inventory/labels        (batch label printing)
/scan                    (mobile-first scan hub — PWA)
/reference/incoterms     (Incoterms 2020 book)
/reference/hs-codes      /reference/hs-codes/[id]   (duty + C/O form matrix)
/trade/estimator         (instant landed-cost lookup — searchable by item/HS code)
/trace/[lotId]           (trace forward/backward)
/budgets
/reports                 /reports/[reportKey]
/admin/users  /admin/departments  /admin/approval-matrix  /admin/items  /admin/categories  /admin/settings
/notifications
```
Left sidebar navigation (navy background, white text, emerald active indicator), top bar with search, locale switcher (EN/VI), notification bell, user menu.

## 12. Build Phases (do in this order)

1. **Foundation:** project setup, Prisma schema (ALL entities up front), auth, RBAC middleware, app shell, i18n, seed script, admin user CRUD.
2. **Master data:** departments, cost centers, categories, items, UoM, vendors (without approval flow yet).
3. **PR module** (§5) + document numbering + attachments + audit log.
4. **Approval engine** (§6) wired to PR; notifications (in-app + email). **Build the e-signature core (§19) here** — signing ceremony, `ElectronicSignature` table, snapshot hash, hash chain — every later module signs through this one service (`lib/esign/`).
5. **PO module** (§8 PO part) + PO approval + PO PDF + vendor approval flow.
6. **RFQ + quote comparison** (§8 RFQ part) + RFQ PDF/email.
7. **GRN + invoice + 3-way match + payment tracking** (§9).
8. **Payment Request module** (§10a) — all four types, accountant verification step, paid cascade to invoices, voucher PDF.
9. **Inventory core** (§10b) — warehouses, GRN→stock posting, stock balances, goods issue with approval, stock card.
10. **Inventory extended** (§10b) — transfers, stock counts, reorder→draft-PR automation, inventory dashboard.
11. **Budget control + contracts** (§9).
12. **Dashboard + reports + xlsx export** (§10) — including payment aging, outstanding advances, inventory value, and stock-card reports.
13. **Barcode & traceability** (§21) — barcode/lot data model, label generation + printing, scan hub, scan-driven GRN/issue/transfer/count, FEFO, trace forward/backward, PWA.
14. **Trade compliance** (§20) — Incoterms book, HS code master + duty/C/O matrix, **landed-cost estimator with instant search** (and its landed-total row in quote comparison), shipment doc checklist, landed-cost capture on POs.
15. **Governance & compliance layer** (§15–§16, rest of §19) — SoD enforcement, exception register, vendor bank-change control, e-invoice XML import, signature-chain integrity job, validation pack. (Build the `Exception` table and no-self-approval rule in Phase 4 already; this phase completes the rest.)
16. **Integration & API** (§17) — REST API, accounting export, importers, webhooks.
17. **Polish:** empty states, loading skeletons, mobile-responsive tables (card view under `md`), e2e happy-path test (Playwright): PR → approve (e-sign) → RFQ → award → PO → approve → GRN by scan (stock in, lot label) → invoice → matched → payment request → paid; plus goods issue with FEFO → stock out, one SoD block test (requester cannot approve own PR), and one signature-tamper test (edit after sign is detected).

## 13. Seed Data (for demo)

- Departments: Engineering, Projects, Manufacturing, Admin-HR, Finance.
- Users: 1 admin, 1 director (MD), 2 dept managers, 2 requesters, 1 purchaser, 1 accountant, 1 warehouse. All password `Humiley@2026` (force change on first login).
- 3 approved vendors (e.g., cleanroom panel supplier, VFD/electrical distributor, freight forwarder), 20 items across HVAC/electrical/consumables categories, budgets for current fiscal year.
- 2 warehouses (WH-HCM main, WH-SITE project site) with stock policies (min/max) on 10 items, bin locations with QR labels, and opening stock balances (5 items lot-tracked with expiry dates for FEFO demo).
- Incoterms 2020 reference content (all 11 terms, EN/VN), ~50 HS codes with MFN duty, and the 8 VN C/O form types (Form E, D, AK/VK, AJ/VJ, AANZ, EUR.1, CPTPP, S) with sample preferential duty mappings.
- One complete demonstration chain PR→PO→GRN (stock in)→Invoice (matched)→Payment Request (paid), plus one goods issue and one pending reimbursement payment request.

## 14. Non-Functional Requirements

- All money math server-side with `Decimal` (Prisma `Decimal`), never float. VND displayed `1.234.567 ₫` (vi) / `1,234,567 VND` (en).
- Every list server-paginated (default 20/page). Indexes on all status + number + FK columns.
- Soft delete only (`isActive`/status), never hard delete documents.
- CSRF-safe (Server Actions), rate-limit login, bcrypt cost 12, session 8h.
- Concurrency: status transitions guarded by optimistic checks (`updateMany where status = expected`).
- Target: page loads < 1s with 10k PRs seeded.

## 15. Governance & Internal Controls (global-company standard)

- **Segregation of Duties (SoD)** — enforced in code, not policy only. Conflicting role pairs blocked per document chain: the PR requester cannot approve it; the PO creator cannot post its GRN; the GRN poster cannot enter/match the same chain's invoice; the invoice matcher cannot approve the payment request that pays it. Admin screen shows an SoD conflict report (users holding conflicting roles).
- **Delegation of Authority (DoA)** — the approval matrix (§6) is the system's DoA. Admin changes to the matrix are versioned (effective-from date, full history) and themselves require DIRECTOR approval. Documents in flight keep the matrix version they started with.
- **Vendor bank-account change control** — the highest-fraud-risk field. Any change to vendor bank name/account: requires a supporting attachment (bank letter), triggers a DIRECTOR approval step, freezes new payment requests for that vendor until approved, sends alert email, and displays a "bank details recently changed — verify by phone call-back" banner on payment requests for 30 days.
- **Urgent purchase route** — a PR can be flagged `URGENT` with mandatory justification; approvals run in parallel instead of sequential and SLA halves, but the RFQ 3-quote rule still applies above threshold (retrospective quote filing allowed within 5 working days, tracked as an exception on the compliance report).
- **Exception register** — every override (single-source award, non-lowest award, tolerance override, over-budget approval, urgent flag, retrospective PO) is written to an `Exception` table (type, entity, justification, approvedBy) and surfaced in a quarterly compliance report — this is what auditors ask for first.
- **CapEx / OpEx classification** — flag on PR/PO line (auto from category). CapEx over threshold (default 50M VND) requires the CapEx approval band; on final GRN acceptance, CapEx items export a fixed-asset handover file (xlsx) for the asset register.
- **Conflict of interest** — vendor record stores COI declarations; a user linked to a vendor (declared relationship) is excluded from that vendor's approvals automatically.

## 16. Compliance & Localization (Vietnam + audit-ready)

- **E-invoice (hóa đơn điện tử, Decree 123/2020 & Circular 78/2021):** invoice entry accepts the vendor's e-invoice XML upload; parse and auto-fill invoice number, MST (tax code), amounts, VAT; validate vendor tax code matches vendor master; store the XML alongside the PDF as legal originals.
- **Retention:** accounting-relevant documents (PO, GRN, invoice, payment vouchers, audit logs) retained ≥ 10 years per VN Law on Accounting — no purge job may touch them; storage design must assume append-only archive.
- **Personal data (Decree 13/2023/NĐ-CP on PDPD):** staff bank details and personal data encrypted at rest (column-level for bank accounts), access logged, visible only to ACCOUNTANT/ADMIN and the owner.
- **Timestamps:** store UTC, display Asia/Ho_Chi_Minh; audit log entries immutable (no update/delete grants on the table).
- **Signatures:** v1 uses system approval records as the legal trail (approver identity + timestamp + hash of the document snapshot at approval — store `snapshotHash` on ApprovalStep). Design leaves room for VNPT/Viettel digital-signature integration later; do not build e-signature now.
- **Financial year:** configurable start month (default January); all budget and report periods derive from it.

## 17. Integration & API Readiness

- **REST API layer** (`/api/v1/*`, token-auth, read-first): vendors, POs, invoices, payment requests, stock balances — so the accounting system and future ERP can pull data. OpenAPI (Swagger) spec auto-generated.
- **Accounting export:** batch export screens for MISA/Bravo/ERP: approved invoices + payment requests as xlsx/CSV in a mapped template (admin-configurable column mapping); mark rows "exported" with batch id to prevent double import.
- **FX rates:** manual entry table (date, currency, rate) with optional daily auto-fetch from Vietcombank published rates; every document stores the rate used at its date — never revalue retroactively.
- **SSO-ready:** NextAuth structured so Microsoft Entra ID / Google Workspace SSO is a config change, not a rebuild (map SSO email → user record; JIT-provision disabled by default).
- **Webhooks (outbound):** configurable POST on `po.approved`, `invoice.matched`, `payment.paid`, `stock.belowMin` for future automation (e.g., Slack/Teams channel notifications).
- **Import tools:** xlsx importers with validation preview + error report for: items, vendors, opening stock balances, budgets — critical for go-live migration.

## 18. Procurement KPIs & Definitions (single source of truth for reports)

| KPI | Definition |
|---|---|
| PR→PO cycle time | Calendar days from PR submit to PO approved (median + p90) |
| Approval cycle time | Business days per approval step, by level and approver |
| PO coverage (maverick spend) | % of invoice value backed by an approved PO — target ≥ 95% |
| 3-quote compliance | % of RFQ-required spend with ≥3 quotes (exceptions listed) |
| Savings | (Baseline − awarded) where baseline = median of received quotes; report by category/quarter |
| On-time delivery (OTD) | % GRN lines received ≤ PO expected date, by vendor |
| Quality acceptance rate | Accepted qty ÷ received qty, by vendor |
| Invoice match rate | % invoices auto-MATCHED without override |
| Payment on-time rate | % payment requests paid ≤ due date |
| Inventory turnover | Issues value (12m) ÷ average stock value |
| Slow-moving stock | Stock value with no movement > 90/180 days |
| Budget adherence | Spent+committed ÷ budget, by cost center |

Each KPI gets one definition function in `lib/kpi/` used by both dashboard and reports — never compute the same KPI two ways.

## 19. Electronic Signature — 21 CFR Part 11-Aligned

Every controlled action (approve/reject PR-PO-vendor-contract-payment, verify invoice, mark paid,
accept GRN, issue goods, post stock count/adjustment) is executed as an **electronic signature**,
not a button click. This replaces the plain ApprovalStep decision UX everywhere.

- **Signing ceremony (§11.200):** at the moment of signing the user must re-authenticate — enter
  **password (always) + see their logged-in identity displayed**; three failed attempts locks the
  account for 15 minutes, writes `SignatureFailure`, and emails ADMIN. Sessions never satisfy a
  signature — a stolen open session cannot sign.
- **Signature manifestation (§11.50):** every signature stores and displays: printed full name,
  date/time (UTC + local), and the **meaning** of the signature (Approved / Reviewed / Verified /
  Received / Issued / Counted / Paid / Rejected + reason). Shown on-screen in the document's
  signature block and printed on every PDF (PO, payment voucher, GRN, issue slip, count sheet).
- **Record linking (§11.70):** each signature stores `recordSnapshotHash` — SHA-256 of the
  document's canonical JSON at signing. Any later change to a signed document is detectable;
  signed documents are locked from edit (changes require a new revision that re-routes for
  signature; prior revision + signatures preserved).
- **Hash chain:** each signature stores the previous signature's hash (`prevSignatureHash`) per
  entity — a tamper-evident chain. A nightly integrity job re-verifies chains and alerts ADMIN
  on any mismatch.
- **Audit trail (§11.10(e)):** already covered by `AuditLog` — extend it to be computer-generated,
  time-stamped, and to never obscure prior entries; include reason-for-change on any GxP-relevant
  correction. Audit trail is human-readable and exportable (PDF/xlsx) for inspections.
- **Account controls (§11.10(d),(g)):** unique accounts (no shared logins — enforce unique email +
  block concurrent sessions optionally), periodic password expiry (config, default 90 days,
  min-length 10 + complexity), auto-logout after 15 min idle, ADMIN cannot sign on behalf of others,
  deactivated users' signatures remain valid historical records.
- **Validation pack:** generate a traceability matrix (requirement → test) and keep the Playwright
  suite as OQ evidence; seed script doubles as IQ data. Store under `/docs/validation/`.
- **Scope note:** this is Part 11 *alignment* for internal QA and client audits; it does not by
  itself constitute VN legal digital signature (see §16 — VNPT/Viettel CA integration remains a
  future option and can co-exist: CA-signing the final PDF after the Part 11 workflow completes).

## 20. Trade Compliance — Incoterms Book, HS Code & C/O Forms (Form E / D …)

A reference + validation layer for import purchasing (common for Humiley: AHU components, VFDs,
sensors imported from China/ASEAN/EU/Korea/Japan).

- **Incoterms 2020 book (built-in reference):** an `/reference/incoterms` page — all 11 terms
  (EXW, FCA, CPT, CIP, DAP, DPU, DDP, FAS, FOB, CFR, CIF), bilingual EN/VN explanation, a
  responsibility matrix (who pays/risks: export clearance, main carriage, insurance, import
  clearance, duties), and a "which to choose" guide. The PO Incoterm field links to this page
  (info icon), and shows an inline summary tooltip of buyer obligations for the chosen term.
  Non-editable content stored as structured seed data so it renders in tables, not free text.
- **HS Code master:** admin-maintained `HsCode` table (seed the ~50 codes Humiley actually
  imports: 8415 air conditioning, 8414 fans/compressors, 8504 transformers/converters/VFD,
  8537 control panels, 9032 controllers, 8481 valves, 7019 filters …), with MFN duty %, import
  VAT %, and customs UoM. Item master links via `ItemTrade` (HS code + default origin country +
  import-license flag).
- **C/O form determination (the Form E / Form D logic):** `CooFormType` seeds the FTA forms
  relevant to VN: **Form E** (ACFTA — China), **Form D** (ATIGA — ASEAN), **Form AK / VK**
  (Korea), **Form AJ / VJ** (Japan), **Form AANZ** (Australia/NZ), **EUR.1** (EVFTA — EU),
  **CPTPP**, **Form S** (Laos). `HsCodeDuty` maps HS code × form → preferential duty %.
  On a PO for an import item, the system shows: *"HS 8504.40 — MFN 10% · with Form E: 0% ·
  with Form D: 0%"* → purchaser selects the expected C/O form; the required-documents checklist
  is generated automatically.
- **Shipment document tracking (`ShipmentDoc`):** per import PO, a checklist of required docs —
  C/O (of the chosen form), B/L or AWB, commercial invoice, packing list, CQ/CA, MSDS (chemicals),
  import license (if flagged), customs declaration (tờ khai hải quan) — each with number, date,
  attachment, and `PENDING → RECEIVED → VERIFIED` status (VERIFIED = e-signature by PURCHASER).
  GRN for an import PO warns if C/O or customs declaration is missing (config: warn or block).
- **Landed cost (v1 light):** on import POs record duty + import VAT + freight + handling as
  header amounts; landed unit cost = (line amount + allocated charges) shown for information and
  used as the `GRN_IN` unit cost so inventory average cost reflects true landed cost.
- **Regulation notes field:** free-text per HS code for VN specifics (e.g., energy-efficiency
  MEPS for motors per MOIT, specialized inspection — kiểm tra chuyên ngành) so purchasing sees
  the warning before committing a PO. Keep as maintained reference data, not hard-coded law.

### Instant cost lookup — Landed Cost Estimator (`/trade/estimator`)

The trade data above must be **searchable as a cost tool in seconds**, not buried in reference pages:

- **One search box, instant answer:** type an item name, item code, or HS code (autocomplete
  across `Item`, `ItemTrade`, `HsCode`) → immediately shows a **duty comparison card**:

  | Route | Duty | Import VAT | Est. landed unit cost |
  |---|---|---|---|
  | MFN (no C/O) | 10% | 10% | 2,750,000 ₫ |
  | Form E (China) | 0% | 10% | 2,475,000 ₫ |
  | Form D (ASEAN) | 0% | 10% | 2,475,000 ₫ |
  | EUR.1 (EU) | 3% | 10% | 2,557,500 ₫ |

  Cheapest route highlighted in emerald; rows for forms whose origin country is impossible for
  the entered origin are greyed out.
- **Inputs:** unit price + currency (FX auto from `FxRate`), qty, origin country, Incoterm
  (EXW/FOB adds freight+insurance estimate fields; CIF/DDP skips them), freight + local handling
  estimates (defaults per origin country configurable in admin). Output: full breakdown —
  customs value → duty → import VAT → landed total and **landed unit cost**, VND and original
  currency side by side.
- **Historical actuals beside the estimate:** the same screen shows the item's **last 3 actual
  landed costs** (from prior import POs, §20 landed-cost capture) and last domestic purchase
  price — so the purchaser instantly compares *estimate vs history vs buying locally*.
- **Embedded everywhere a cost decision happens (one click, pre-filled):**
  - PR line (import-flagged item) → "Est. landed cost" link with item pre-filled;
  - **Quote comparison (§8):** for import quotes, an extra computed row **"Landed total"**
    (quote price + duty per that vendor's origin/C/O + freight) — comparison ranks on landed
    cost, not invoice price, so a cheaper EXW-China quote never falsely beats a local DDP quote;
  - PO header → live landed-cost panel that updates as prices/Incoterm/C/O form change.
- **Saved estimates:** an estimate can be saved and attached to a PR/RFQ/PO (`LandedCostEstimate`
  snapshot: inputs + result + rates used at that date) — the actual-vs-estimate variance appears
  on the PO after final customs declaration, feeding a "duty estimate accuracy" line on the
  procurement dashboard.

```
LandedCostEstimate(id, itemId?, hsCodeId, originCountry, cooFormTypeId?, incoterm, currency,
       fxRate, unitPrice, qty, freightEst, handlingEst, dutyPct, importVatPct,
       landedUnitCostVnd, entityType?, entityId?, createdById, createdAt)   // immutable snapshot
```

## 21. Barcode & Full Traceability for Inventory

Everything in the warehouse becomes scannable; every movement records *what was scanned, by whom,
when* — giving end-to-end traceability: **Vendor → PO → GRN → Lot → Bin → Issue → Project/Cost center**.

- **Barcode generation (automatic):**
  - **Item barcode** — auto-generated on item creation: `Code128` of item code.
  - **Lot/batch label** — auto-generated at GRN acceptance, one per GRN line lot: **QR** payload
    JSON `{lot, item, po, grn, qty, mfg, exp}` + human-readable text. Lot number auto-format
    `LOT-YYMMDD-####` (or capture the vendor's lot number — both stored).
  - **Location/bin labels** — per warehouse bin (`WH-HCM-A-01-03`), QR, printed from admin.
  - **Document barcodes** — every PO/GRN/GI/TRF/CNT PDF carries a QR of its document number for
    instant lookup by scanning.
  - Rendering with `bwip-js` (server-side PNG/SVG); **label print page** sized for common Zebra
    label stock (50×30 mm and 100×50 mm, CSS @page) — batch-print all labels of a GRN in one click.
- **Scan-driven processes (scanner = keyboard-wedge USB/Bluetooth or phone camera):**
  - A global **Scan page** (`/scan`, mobile-first, large touch targets) — scan anything: a document
    QR opens the document; an item/lot barcode shows stock + movement history and offers actions
    allowed for the user's role.
  - **GRN by scan:** scan PO QR → lines listed → scan item barcode → qty prompt → lot label
    auto-prints. Mismatched item (scanned code not on the PO) is blocked with an error beep/banner.
  - **Goods issue by scan:** scan issue-request QR → scan each lot label → qty; **FEFO enforced**
    (system proposes the earliest-expiry lot; overriding FEFO requires a reason, logged as an
    exception). Issuing a different lot than proposed prompts confirmation.
  - **Transfer:** scan lots out (dispatch), scan again at destination (receive) — the two scans
    are the IN_TRANSIT → RECEIVED evidence.
  - **Stock count by scan:** count mode = scan lot label + enter counted qty; unscanned lots after
    the count session auto-list as "not found" variances.
  - Every scan writes `scannedBarcodeId` on the movement — the difference between "typed" and
    "scanned" entries is visible in the audit trail (scan % is a data-quality KPI).
- **Lot & expiry control:** lot-tracked flag per item (on = lot mandatory on every movement);
  expiry dashboard (expiring ≤ 30/60/90 days), expired lots blocked from issue (override =
  DIRECTOR e-signature + exception record). Serial-number tracking (qty-1 lots) supported by the
  same model for high-value equipment.
- **Traceability views:**
  - **Trace forward:** from a lot → every issue/transfer/adjustment → which project/cost center
    received it (critical for client quality claims: "which AHU got gasket lot X?").
  - **Trace backward:** from a project/issue → lots consumed → GRN → PO → vendor → C/O and CQ
    documents (§20) — one screen, exportable to PDF for client audits.
- **Mobile:** the scan and count pages are PWA-ready (installable, works on warehouse phones/
  tablets); camera scanning via `@zxing/browser` when no hardware scanner is present.

**Acceptance:** GRN by scanning a PO QR and item barcode auto-creates the lot + prints its label;
issuing against FEFO picks the oldest expiry lot; the trace-backward screen for a goods issue shows
lot → GRN → PO → vendor → Form E record in one view.

## 22. Execution Guide for Claude Code (read this before Phase 1)

### 22.1 Create CLAUDE.md in the repo root with exactly this content

```markdown
# Humiley Procurement Portal
Spec: HUMILEY-PROCUREMENT-SPEC.md — the single source of truth. Never contradict it silently.

## Commands
- npm run dev            # dev server
- npm run check          # tsc --noEmit && eslint . (run after EVERY task, must pass)
- npx prisma migrate dev # after any schema change
- npm run seed           # reset + reseed demo data
- npm run test:e2e       # playwright

## Hard rules
- Money: Prisma Decimal end-to-end; convert with lib/money.ts serializers at the server boundary
  (Decimal is not serializable to Client Components — never pass it raw).
- All mutations: Server Actions in `app/**/actions.ts`, validated with the Zod schema from
  `lib/schemas/`, permission-checked with `lib/rbac.ts`, audited with `lib/audit.ts`.
- Status transitions ONLY through `lib/workflow/transition.ts` (optimistic-guarded).
- Signatures ONLY through `lib/esign/sign.ts`. Document numbers ONLY through `lib/docnum.ts`.
- Every user-visible string goes in messages/en.json + messages/vi.json (next-intl). No hardcoded text.
- Reuse the shared components in components/shared/ (see spec §22.3) — do not create parallel
  versions of tables, badges, timelines, or detail layouts.
- AUTONOMOUS MODE (§23): never ask mid-phase; complete the whole phase, then output the Phase
  Report and wait for OK. Log unspecified decisions in the report instead of asking.
- RECOVERY (§25.1): on EVERY session start, if .build-state.json exists this is a RESUME —
  read it + git log and continue from nextAction. Update .build-state.json and WIP-commit
  after every task. Never redo completed work.
```

### 22.2 Folder structure (fix it up front so every phase lands in the same place)

```
prisma/schema.prisma, seed.ts
messages/en.json, vi.json
lib/
  auth.ts  rbac.ts  audit.ts  docnum.ts  money.ts  dates.ts
  schemas/            # zod, one file per entity, shared client+server
  workflow/           # transition.ts, approval-engine.ts, escalation.ts
  esign/              # sign.ts, verify-chain.ts
  budget/  match/     # budget engine, 3-way match
  stock/              # post-movement.ts (the ONLY writer of StockMovement+StockBalance), fefo.ts
  trade/              # landed-cost.ts, duty-lookup.ts
  kpi/                # one file per KPI (§18)
  pdf/                # brand layout + one template per doc type
  barcode/  storage/  mail/  fx/
components/shared/    # see 22.3
app/(portal)/...      # route groups per §11; each module: page.tsx, [id]/page.tsx, actions.ts
app/api/v1/...        # REST layer (§17)
docs/validation/      # traceability matrix, OQ evidence (§19)
```

### 22.3 Build ONCE in Phase 1, reuse everywhere (this is the biggest time-saver)

1. `<DocListPage>` — config-driven list factory: columns, filters, search, status tabs,
   server pagination, xlsx export. Every register (PR/PO/GRN/INV/PMT/GI/…) is a config, not a page.
2. `<DocDetailLayout>` — header card + tabs (Details / Approvals & Signatures / Attachments /
   Audit) + action bar driven by allowed transitions for the current user.
3. `<StatusBadge>` — one enum→color/label map for ALL document statuses (navy=in progress,
   emerald=approved/done, grey=draft, red=rejected, amber=warning).
4. `<ApprovalTimeline>` — steps, signatures (name/time/meaning), SLA countdown; used by every module.
5. `<SignatureDialog>` — the §19 signing ceremony (password re-auth, meaning, reason) — one component.
6. `<LineItemsEditor>` — editable grid (item picker w/ stock hint, qty, UoM, price, VND totals);
   PR, PO, quote, invoice, GRN, issue all reuse it with column configs.
7. `<AttachmentPanel>`, `<MoneyInput>`, `<VndDisplay>`, `<BilingualLabel>` (EN + VN italic-grey),
   `<EntityLink>` (doc-number chip that always links to the document).
8. PDF base layout `lib/pdf/brand-layout.tsx` — bar/logo/footer/signature block once; each doc
   type only supplies its body.

### 22.4 Known gotchas — handle from the start, they are expensive to retrofit

- **Vietnamese in PDFs:** @react-pdf default fonts break diacritics (ế, ữ, đ…). Bundle and
  register **Be Vietnam Pro** (or Inter) TTFs in `lib/pdf/fonts.ts` for ALL PDF text. Web UI
  keeps the Calibri stack (§10); PDFs use the bundled font. Test with "Đề nghị thanh toán".
- **Prisma Decimal → Client Components:** serialize to string at the boundary (`lib/money.ts`),
  parse back for display. Never `JSON.parse(JSON.stringify(decimal))`.
- **next-intl + App Router:** set up locale routing/middleware in Phase 1 — retrofitting i18n
  into 60 finished pages is misery. Same for the `(portal)` auth-guarded route group.
- **Sequence numbers under concurrency:** `SELECT … FOR UPDATE` inside a transaction in
  `lib/docnum.ts` (or `UPDATE … RETURNING`) — never read-then-write.
- **Stock integrity:** `lib/stock/post-movement.ts` is the single writer that updates
  StockMovement + StockBalance + avgCost in ONE `prisma.$transaction` with the balance row
  locked. No other code touches StockBalance.
- **Hash canonicalization:** `recordSnapshotHash` must hash a canonical JSON (sorted keys,
  Decimals as fixed-format strings, dates as ISO-UTC) — otherwise verification breaks later.
- **Timezone:** store UTC; format with `lib/dates.ts` (Asia/Ho_Chi_Minh) everywhere — never
  `toLocaleDateString()` ad hoc.
- **bwip-js** runs server-side only (route handler returning PNG/SVG) — don't import it in
  client bundles. Camera scanning (`@zxing/browser`) is client-only — dynamic import, ssr:false.
- **NextAuth v5 (Auth.js)** with App Router: use the `auth()` helper in Server Components/Actions;
  don't mix v4 patterns.

### 22.5 Out of scope for v1 — do NOT build (even if tempting)

Multi-company/multi-entity; languages beyond en/vi; native mobile apps (PWA only); OCR of
invoices; CA digital signatures (VNPT/Viettel — §16 note only); direct bank/ERP API integration
(export files only); per-line RFQ awards; consignment/customer-owned stock; multi-currency
budgets (budgets are VND); AI features; real-time collaboration; offline mode.

### 22.6 Definition of Done — every phase

1. `npm run check` passes (0 type errors, 0 lint errors).
2. `npx prisma migrate dev` clean; `npm run seed` runs without error.
3. The phase's acceptance criteria demonstrated against seed data.
4. New strings exist in BOTH en.json and vi.json.
5. New mutations have: Zod validation + RBAC check + audit log (+ signature where §19 applies).
6. Commit per phase: `phase-N: <summary>`.

### 22.7 Paste-ready phase prompts (run in order, one at a time)

1.  "Read HUMILEY-PROCUREMENT-SPEC.md fully. Work in autonomous mode per §23 — no mid-phase questions, finish with the Phase Report. First create `.claude/settings.json` per §23 and CLAUDE.md per §22.1. Then build Phase 1 (§12): scaffold per §22.2, full Prisma schema (§4), auth + RBAC, app shell (§11 nav, brand §10), i18n en/vi, seed script (§13), admin user CRUD, and ALL shared components in §22.3. Follow §22.4 gotchas. DoD §22.6."
2.  "Build Phase 2: master data CRUD (departments, cost centers, categories, items, UoM, vendors — no approval flow yet) using DocListPage/DocDetailLayout. Include the xlsx importers for items and vendors (§17)."
3.  "Build Phase 3: PR module per §5 — with docnum service, attachments, audit, budget stock-hint on lines."
4.  "Build Phase 4: approval engine per §6 + e-signature core per §19 (SignatureDialog, hash chain, no-self-approval, Exception table). Wire PR approvals through it. Notifications in-app + email."
5.  "Build Phase 5: PO module per §8 — PO approval via the engine, brand PDF per §10/§22.4 fonts, vendor approval flow, Incoterms field."
6.  "Build Phase 6: RFQ + quotes + comparison per §8, RFQ PDF + email, 3-quote rule + exceptions."
7.  "Build Phase 7: GRN + invoice + 3-way match + payment tracking per §9."
8.  "Build Phase 8: Payment Request module per §10a — all four types, chief-accountant step, paid cascade, voucher PDF."
9.  "Build Phase 9: inventory core per §10b — warehouses, GRN→stock posting via lib/stock, goods issue with approval, stock card."
10. "Build Phase 10: inventory extended per §10b — transfers, counts, reorder→draft PR, dashboard."
11. "Build Phase 11: budget engine + contracts per §9."
12. "Build Phase 12: dashboards + all reports + xlsx exports per §10/§18 using lib/kpi."
13. "Build Phase 13: barcode & traceability per §21 — labels, scan hub PWA, scan GRN/issue/transfer/count, FEFO, trace screens."
14. "Build Phase 14: trade compliance per §20 — Incoterms book, HS/duty/C-O data + seeds, landed-cost estimator + quote-comparison landed row, shipment docs, landed-cost capture."
15. "Build Phase 15: governance per §15/§16 + remaining §19 — SoD, bank-change control, e-invoice XML import, integrity job, validation pack."
16. "Build Phase 16: REST API + accounting export + webhooks + remaining importers per §17."
17. "Build Phase 17: polish + the full Playwright e2e suite per §12."

## 23. Autonomous Execution Mode — work big, review at the end

**Behavior contract for Claude Code (applies to every phase):**

- **Do not stop mid-phase to ask.** Every decision already covered by this spec (data model,
  statuses, folder locations, naming, brand, defaults) is decided — proceed. For a genuinely
  unspecified detail, pick the most standard option, implement it, and log it in the phase report
  (see below) instead of asking. Only stop for true blockers: a spec contradiction, a destructive
  action on existing data, or a failing migration you cannot resolve.
- **Complete the entire phase in one run:** schema → migration → lib code → UI → seed updates →
  i18n strings → `npm run check` → self-verify the acceptance criteria. Fix your own type/lint/
  test errors without reporting each one.
- **End every phase with a PHASE REPORT** (this is the "final one for review"):

  ```
  ## Phase N Report — <name>
  ✅ Built: <files/modules, one line each>
  ✅ Acceptance criteria: <each criterion — how verified>
  ⚠️ Decisions made without asking: <list + rationale, or "none">
  ⚠️ Known limitations / TODOs: <or "none">
  ▶️ How to review in 5 minutes: <exact click-path with seed logins, e.g.
     "login requester1@humiley.com / Humiley@2026 → New PR → …">
  ```

  Wait for the user's OK on the report before starting the next phase — that is the ONLY
  approval gate.

**One-time setup so Claude Code never shows "Allow / Always allow" prompts** — permission
prompts are controlled by settings, not by this document. In Phase 1, create
`.claude/settings.json` in the repo root with a pre-approved allowlist:

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Edit", "Write",
      "Bash(npm install:*)", "Bash(npm run:*)", "Bash(npx prisma:*)",
      "Bash(npx playwright:*)", "Bash(npx next:*)", "Bash(node:*)",
      "Bash(mkdir:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(mv:*)", "Bash(cp:*)",
      "Bash(git add:*)", "Bash(git commit:*)", "Bash(git status)", "Bash(git diff:*)"
    ],
    "deny": ["Bash(rm -rf:*)", "Bash(git push:*)", "Read(.env)", "Read(.env.*)"]
  }
}
```

This auto-approves all file edits and the project's build/test/db commands, while still blocking
destructive deletes, pushes, and secret files. Alternative (approves everything, use only in a
dedicated folder): start with `claude --dangerously-skip-permissions`.

## 24. One-Click Full Build (0 → 100%, no stops)

**In this mode, §23's per-phase approval gate is DISABLED.** Claude Code runs ALL phases
back-to-back. Phase Reports are not shown for approval — they are appended to
`docs/PHASE-REPORTS.md` as the build log. The user reviews once, at the very end.

### User setup (once, ~2 minutes)

```bash
mkdir humiley-portal && cd humiley-portal
# copy HUMILEY-PROCUREMENT-SPEC.md into this folder
git init
claude --dangerously-skip-permissions     # dedicated folder → safe to skip all prompts
```

Then paste the **master prompt** below. That is the one click.

### THE MASTER PROMPT (paste as-is)

```
Read HUMILEY-PROCUREMENT-SPEC.md completely. Execute the FULL build in one-click mode per §24:

1. Create CLAUDE.md (§22.1) and .claude/settings.json (§23) first.
2. Build ALL phases 1→17 (§12) strictly in order, following §22.7's scope for each phase,
   the structure in §22.2, shared components §22.3, and gotchas §22.4. §22.5 is out of scope.
3. NEVER stop to ask me anything. For any unspecified detail, choose the most standard option
   and record it in docs/PHASE-REPORTS.md. Only halt for a truly unresolvable blocker, and if
   you must halt, write docs/BLOCKED.md explaining exactly what you need.
4. After EACH phase: run `npm run check` and `npm run seed`, fix all errors yourself, verify
   that phase's acceptance criteria, append the Phase Report (§23 format) to
   docs/PHASE-REPORTS.md, commit as "phase-N: <summary>", then IMMEDIATELY continue to the
   next phase without waiting.
5. If context runs long, re-read HUMILEY-PROCUREMENT-SPEC.md §12 + the current phase's section
   rather than guessing.
6. After Phase 17: run the full Playwright suite, fix failures, then write
   docs/FINAL-REPORT.md containing: feature checklist vs §5–§21 (done/partial/skipped),
   all decisions made, known limitations, seed login table, and a 15-minute guided review
   script for me (exact click-paths through one full PR→pay cycle and one scan cycle).
7. Finish with: "BUILD COMPLETE — review docs/FINAL-REPORT.md".
Start now with Phase 1.
```

### Option B — fully scripted (survives session limits; resumes where it stopped)

For maximum reliability on a build this size, create `build-all.sh` — each phase gets a fresh
session (no context exhaustion), and finished phases are skipped on re-run, so if anything stops
you just run the script again:

```bash
#!/usr/bin/env bash
set -e
for N in $(seq 1 17); do
  [ -f ".done-phase-$N" ] && continue
  claude -p "Read HUMILEY-PROCUREMENT-SPEC.md. One-click mode (§24), no questions. \
Execute EXACTLY Phase $N as defined in §12 and prompt $N of §22.7. \
Verify DoD §22.6 + the phase's acceptance criteria, append the Phase Report to \
docs/PHASE-REPORTS.md, and commit as 'phase-$N'." \
    --dangerously-skip-permissions --max-turns 400
  npm run check || { echo "Phase $N failed check — fix before rerun"; exit 1; }
  touch ".done-phase-$N"
  echo "=== Phase $N complete ==="
done
echo "BUILD COMPLETE — review docs/FINAL-REPORT.md"
```

`chmod +x build-all.sh && ./build-all.sh` — that is the literal one click. Recommended:
**Option B** for the full build; the master prompt (Option A) if you prefer to watch it work
in one interactive session.

### What the user does at the end (the only manual step)

1. Open `docs/FINAL-REPORT.md` — follow the 15-minute guided review.
2. Check `docs/PHASE-REPORTS.md` "decisions made" sections — override anything you disagree
   with as small follow-up prompts ("Change X to Y").
3. `npm run dev` → log in with the seed accounts (§13) → walk one full cycle:
   PR → approve (e-sign) → RFQ → award → PO → GRN by scan → invoice → payment request → paid.

## 25. Auto-Recovery & Resume — survive usage limits and interruptions

The build must survive ANY stop — usage/rate limit reached ("limit hot"), session timeout,
network drop, machine sleep — and **continue automatically when capacity recovers**, with zero
lost work and zero re-asking.

### 25.1 Rules for Claude Code — checkpoint constantly (so any stop loses ≤ a few minutes)

- **Maintain `.build-state.json` at all times.** Update it after EVERY completed task (not just
  per phase):

  ```json
  {
    "phase": 7,
    "phaseStatus": "IN_PROGRESS",
    "completedPhases": [1,2,3,4,5,6],
    "currentTask": "3-way match engine — lib/match/",
    "completedTasks": ["GRN model+UI", "invoice entry form"],
    "nextAction": "implement tolerance check in lib/match/match.ts, then match UI on invoice detail",
    "lastCheckpointCommit": "phase-7 WIP: invoice entry",
    "updatedAt": "2026-07-05T14:30:00Z"
  }
  ```
- **Commit WIP frequently:** after every completed task, `git add -A && git commit -m
  "phase-N WIP: <task>"` — never leave more than one task uncommitted.
- **On session start, ALWAYS check first:** if `.build-state.json` exists → this is a RESUME.
  Read it + `git log --oneline -10` + `docs/PHASE-REPORTS.md`, then continue from `nextAction`
  exactly. Do NOT restart the phase, do NOT redo completed tasks, do NOT ask what to do.
- **Before any risky/long operation** (big migration, dependency install), checkpoint state
  first so recovery lands after, not before, the last success.
- When Phase 17 + FINAL-REPORT.md are done, write the marker file `BUILD-DONE` and set
  `"phaseStatus": "COMPLETE"` — this tells the runner script to stop.

### 25.2 The self-healing runner — `autopilot.sh` (recommended one click)

Runs the build headless; whenever Claude Code exits for ANY reason (usage limit hit, crash,
disconnect), it waits and relaunches with a resume prompt — automatically continuing when the
limit window resets. Stops only when `BUILD-DONE` appears.

```bash
#!/usr/bin/env bash
# Usage: chmod +x autopilot.sh && ./autopilot.sh   (leave it running; it survives limit resets)
WAIT=300   # 5 min between retries; usage-limit windows reset on their own schedule
PROMPT_FIRST="Read HUMILEY-PROCUREMENT-SPEC.md completely and execute the full build in \
one-click mode per §24 with the checkpoint rules of §25.1. Build phases 1→17 without asking. \
Maintain .build-state.json and WIP commits at every task. Write BUILD-DONE when finished."
PROMPT_RESUME="RESUME per §25.1: read .build-state.json, git log, and docs/PHASE-REPORTS.md, \
then continue the one-click build (§24) from nextAction. Do not redo completed work. \
Do not ask questions. Write BUILD-DONE when Phase 17 and FINAL-REPORT.md are complete."

until [ -f BUILD-DONE ]; do
  if [ -f .build-state.json ]; then P="$PROMPT_RESUME"; else P="$PROMPT_FIRST"; fi
  claude -p "$P" --dangerously-skip-permissions --max-turns 1000 || true
  [ -f BUILD-DONE ] && break
  echo "$(date) — Claude Code stopped (limit/interruption). Retrying in $WAIT s…" | tee -a autopilot.log
  sleep $WAIT
done
echo "BUILD COMPLETE — review docs/FINAL-REPORT.md"
```

Notes:
- When the usage limit is hot, each retry exits quickly and cheaply until the window resets —
  then the next retry picks the build up from the exact `nextAction`. No babysitting.
- Keep the machine awake (`caffeinate -i ./autopilot.sh` on macOS).
- Safe to Ctrl-C anytime and re-run later — same resume path.
- Interactive alternative: if you run Claude Code manually and it stops, just relaunch and type
  **"RESUME per §25.1"** — same recovery, by hand.
