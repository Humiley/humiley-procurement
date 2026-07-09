# Humiley Procurement Portal — Controls & Validation Pack (§15 / §16 / §19)

What an auditor should check first, where each control lives in code, and how it was verified.
Every claim below is E2E-evidenced in `docs/PHASE-REPORTS.md` (phase noted per control).

## 1. Electronic records & signatures (21 CFR Part 11-aligned, §19)

| Control | Implementation | Verified |
|---|---|---|
| Signature = re-authentication | `lib/esign/sign.ts` `signRecord()` — password bcrypt check on EVERY consequential act (approve/reject/verify/receive/issue/count/paid) | every phase E2E |
| Lockout on abuse | 3 failed signing attempts in 15 min → 15-min lock + `SignatureFailure` row + ADMIN alert | Phase 4 |
| Record linking | `recordSnapshotHash` = SHA-256 of the document's canonical JSON at signing | Phase 4+ |
| Tamper-evident chain | each signature stores `prevSignatureHash`; `verifyChain()` recomputes per entity; `verifyAllChains()` sweeps every chain from /admin/settings | Phase 15 |
| Append-only signatures | no update/delete path exists in application code; failed acts pre-check BEFORE signing so refusals leave no orphan signatures | Phase 9/10 |
| Meaning + printed name + timestamp | ElectronicSignature stores meaning (APPROVED/VERIFIED/ISSUED/…), fullNamePrinted, signedAt (UTC) | Phase 4 |

## 2. Authorization & workflow (§6)

- Delegation of Authority = `ApprovalMatrix` (amount bands × level × role per document type),
  admin-managed at /admin/approval-matrix (audited CRUD).
- Engine (`lib/workflow/engine.ts`): sequential steps, no-self-approval hard rule
  (APPROVAL_SELF_SKIP audited), DEPT_MANAGER routes to the requester's department manager,
  ACCOUNTANT prefers the Chief Accountant, L3 = Managing Director.
- Status transitions only via `lib/workflow/transition.ts` (optimistic-guarded — a stale approval
  cannot double-fire).
- Payment requests additionally require accounting verification (VERIFIED signature) before the
  FINAL approval can sign (Phase 8, guard E2E-proven).

## 3. Segregation of duties (§15)

| Rule | Enforcement |
|---|---|
| Requester cannot approve own document | engine no-self-approval (all entity types) |
| PO creator cannot post its GRN | `createGrn` guard (Phase 15) |
| GRN poster cannot enter the same PO's invoice | `createInvoice` guard (Phase 15) |
| Vendor bank change needs a second person | dual control below |

## 4. Vendor bank-change dual control (§15 — highest fraud risk)

1. Any change to bank name/account in `updateVendor` → `bankChangeFreeze = true`,
   `Exception(BANK_CHANGE)` row, VENDOR_BANK_CHANGE audit (before/after), DIRECTOR notification.
2. While frozen, **new payment requests for the vendor are refused** (server-side guard).
3. A DIRECTOR confirms with a §19 signature after phone call-back (APPROVED unfreezes;
   REJECTED reverts the details from the audit trail and unfreezes).
4. The exception row records who confirmed. Register: /reports/exception-register.

## 5. Exception register (§15)

`Exception` rows are written at every override: single-source RFQ award, non-lowest award,
3-way-match tolerance override, vendor bank change. Surfaced as the "Exception Register" report
(on-screen + xlsx) — the quarterly compliance report.

## 6. Audit trail (§16)

- `lib/audit.ts` writes before/after JSON for every mutation; viewer at /admin/audit
  (entity/action/user filters). No update/delete code path exists for AuditLog.
- Timestamps stored UTC, displayed Asia/Ho_Chi_Minh (`lib/dates.ts`).
- Retention: no purge job exists anywhere in the codebase (≥10-year VN Law on Accounting stance);
  deployment must also deny UPDATE/DELETE grants on AuditLog + ElectronicSignature at the DB role
  level (ops step, documented here).

## 7. SLA monitoring & delegation (§15)

- Overdue PENDING approval steps notify their approver (deduped) — sweep runs on approvals load.
- ADMIN may reassign a PENDING step (/admin/approval-matrix), audited with before/after approver,
  and the new approver is notified.

## 8. Known v1 gaps (tracked, not silent)

- Approval-matrix versioning (effective-from history + DIRECTOR approval of matrix changes) —
  schema fields exist (`effectiveFrom`, `version`); UI/enforcement deferred.
- CapEx fixed-asset handover export; COI-based approver exclusion; urgent-PR parallel approvals.
- E-invoice XML parse (schema holds `xmlPath`) — deferred to the integration phase.
- Column-level encryption for staff bank data (PDPD) — deployment/ops concern; portal stores
  vendor banking only, personal payroll data lives in the HR portal.
- **Server-thrown error messages are EN-only.** Server actions throw human-readable English
  strings; the client shows them verbatim (with a localized generic fallback via
  `lib/use-action-error.ts` when the thrown value is not an `Error`). A full error catalog
  (error codes + `messages/*` lookups) is backlog — logged in the 2026-07 QA pass.
- CSV export from `DocListPage` exports the *filtered client-side page state* (by design —
  what you see is what you export); the admin Export Center is the authoritative extract.
