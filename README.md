# Humiley Procurement Portal

Enterprise procure-to-pay + inventory portal for Humiley Engineering & Solutions — bilingual
EN/VN, 21 CFR Part 11-aligned e-signatures, full traceability. Built from
`HUMILEY-PROCUREMENT-SPEC.md` (17 phases, all complete — see `docs/FINAL-REPORT.md`).

**Stack:** Next.js 14 (App Router) · TypeScript · Prisma 6 + PostgreSQL 16 · Auth.js v5 ·
next-intl · Tailwind (Humiley brand) · Recharts · exceljs · bwip-js · Playwright.

## Quickstart

```bash
npm install
npx prisma migrate deploy      # local Postgres: humiley_procurement
npm run seed                   # demo data (DESTRUCTIVE reset — dev only)
npm run dev                    # http://localhost:3000
```

Sign in with any seeded user, password `Humiley@2026` (**demo/dev only** — production users are provisioned via `npm run bootstrap` / Admin → Users with random one-time passwords):
`admin@` · `purchaser@` · `mgr.eng@` · `director.fin@` · `accountant@` · `warehouse@` ·
`req.eng@` …`humiley.com`.

## Commands

| Command | Purpose |
|---|---|
| `npm run check` | tsc + eslint (must pass after every change) |
| `npm run seed` | reset + reseed demo data |
| `npm run test:e2e` | Playwright journey suite (reseeds first) |

## Documentation

- `docs/FINAL-REPORT.md` — what was built, module by module.
- `docs/PHASE-REPORTS.md` — per-phase build log with every logged decision.
- `docs/VALIDATION.md` — §15/§16/§19 controls map for auditors.
- `docs/PORTAL-INTEGRATION.md` — running this as an app of the Humiley Portal (Entra SSO,
  launcher, deployment).
- `/api/v1/openapi` — machine-readable API spec (token auth; mint keys in Admin → Governance).

## Hard rules (see CLAUDE.md)

Money is Prisma Decimal end-to-end; every mutation is a Zod-validated, RBAC-checked, audited
server action; status changes only via the optimistic-guarded transition helper; signatures only
via the §19 ceremony; document numbers only via the gap-free sequence helper; every user-visible
string lives in `messages/en.json` + `messages/vi.json`.
