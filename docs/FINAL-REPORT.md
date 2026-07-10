# Humiley Procurement Portal — Final Build Report

**All 17 phases of HUMILEY-PROCUREMENT-SPEC.md are complete and E2E-verified.**
Per-phase detail + every §23 decision: `docs/PHASE-REPORTS.md`. Controls map: `docs/VALIDATION.md`.
Portal integration plan (the standing requirement): `docs/PORTAL-INTEGRATION.md`.

## What was built (by module)

| Module | Delivered |
|---|---|
| Foundation (1–2) | Next.js 14 App Router + Prisma/Postgres + Auth.js credentials, RBAC (7 roles), audit log, bilingual EN/VN (next-intl), brand shell, master data admin (departments, cost centers, categories, UoM, items, users) |
| Requisitions (3) | PR lifecycle with catalog/free-text lines, free-stock hint, budget gate (WARN/BLOCK per department), gap-free HML-PR numbering |
| Approvals & e-sign (4) | §6 matrix engine (amount bands × levels × roles, no-self-approval, chief resolution) + §19 signatures: password re-auth, lockout, snapshot hash, prev-hash chain + selfHash, one queue for PR/PO/VENDOR/PAYMENT_REQUEST/GOODS_ISSUE |
| Vendors + RFQ (5–6) | Vendor lifecycle (Director-signed approval, blacklist), RFQ → quotes → comparison → award with single-source / non-lowest exceptions |
| PO → GRN → invoice (7) | PO from PR/RFQ with signed approvals + PDF, GRN with QC accept/reject + RECEIVED signature, 3-way match (qty 0% / price 2%) with signed verify + tolerance-override exception, payment tracking + aging, §9 budget ledger (commit → move → spend → release) |
| Payment requests (8) | Four §10a types, chief-accountant VERIFY gate before final approval (E2E-proven refusal), PAID signature + bank ref, invoice PAID cascade, voucher PDF |
| Inventory core (9) | THE single stock writer (moving-average, FOR-UPDATE locks, lot-aware balances), GRN→stock, goods issues with engine approval + ISSUED execution, stock balances + classic VN stock card, spend-from-stock budget hook |
| Inventory extended (10) | Two-step signed transfers (cost preserved), stock counts with DIRECTOR-signed adjustments, reorder automation (below-min → notification + one-click draft PR source=REORDER), inventory dashboard |
| Budgets + contracts (11) | Admin budget CRUD + drill-down, pre-submit WARN/BLOCK gate, framework agreements with contracted-price auto-fill + deviation flags + renewal alerts |
| Dashboards + reports (12) | Role-aware dashboard (Recharts, spend MTD/YTD, savings, cycle time, due deliveries, expiring contracts), 15-report suite with branded xlsx export via one registry |
| Barcode + trace (13) | Lot capture at GRN (auto LOT-YYMMDD), QR/CODE128 barcodes, 50×30 mm label batch print, scan hub (documents/items/lots, BarcodeDetector camera), FEFO enforcement, /trace forward + backward |
| Trade compliance (14) | Incoterms 2020 book, HS register with C/O duty matrix (Form E/D/AK/VK/AJ/AANZ/EUR.1/CPTPP/S), landed-cost estimator with FX + route comparison, PO import-document checklist with signed verification |
| Governance (15) | Vendor bank-change dual control (freeze → Director signature), SoD guards in code, matrix admin + delegation, full-chain integrity sweep (tamper detection E2E-proven), audit viewer, SLA sweep, exception register |
| Integration (16) | Token-authed /api/v1 (6 read endpoints + OpenAPI), API-key console, HMAC webhooks on business events, accounting CSV export batches with anti-double-import, PORTAL-INTEGRATION.md |
| Polish + tests (17) | Playwright suite (9 specs green on fresh seed: auth, 25-route smoke, PR journey, contract auto-fill, bank dual control, verify gate, API auth, scan hub), branded 404/error pages |

## Test & quality status

- `npm run check` (tsc + eslint): clean.
- `npm run test:e2e`: **9/9 passing** — global setup reseeds, so the suite is deterministic.
- Every phase was additionally verified interactively in the browser with SQL assertions
  (transcripts summarized per phase in PHASE-REPORTS.md).

## Demo environment

`npm run seed` provisions: 10 users (password `Humiley@2026`) across 7 roles, master data,
budgets, approval matrix, and live demo documents (a submitted PR, an approved PR, a received PO
with 2 matched invoices, a SENT PO for the stock demo, a SENT lot-tracked PO for the §21 demo,
an active framework contract expiring inside its alert window, trade reference data, FX rates).

## Consolidated deferred backlog (all logged in phase reports)

xlsx importers (items/vendors/opening stock/budgets) · FX auto-fetch (VCB) · e-invoice XML parse ·
matrix versioning UI · urgent-PR parallel approvals · CapEx handover export · COI approver
exclusion · SoD conflict report · scan-driven GRN/issue/transfer/count flows + FEFO override
ceremony · document QR on PDFs · webhook delivery log/retries · per-report extra filters ·
external signature-chain anchoring · Entra SSO switch-on (documented, config-level).

## Run it

**Local / demo:**
```bash
npm install
npx prisma migrate deploy
npm run seed        # demo data (DESTRUCTIVE reset — DEV ONLY, never in production)
npm run dev         # http://localhost:3000 — admin@humiley.com / Humiley@2026
npm run test:e2e    # full journey suite
```

**Production (empty DB — do NOT run `npm run seed`, it drops everything):**
```bash
npm ci
npx prisma migrate deploy                 # schema only, no data
BOOTSTRAP_ADMIN_EMAIL=admin@yourco.com \
  BOOTSTRAP_ADMIN_NAME="Administrator" \
  npm run bootstrap                       # approval matrix + ONE admin, random password (shown once)
# then build/run the standalone server (see Dockerfile) behind Caddy at procurement.humiley.com
```
Required env in production: `DATABASE_URL`, `AUTH_SECRET` (aka NEXTAUTH_SECRET), `AUTH_TRUST_HOST=true`.
The admin signs in with the printed one-time password and is forced to set a new one. Every user
provisioned via **Admin → Users** likewise gets a random one-time password (shown once) and must
change it at first sign-in — the shared `Humiley@2026` is demo-seed only and never provisions a
real account.
