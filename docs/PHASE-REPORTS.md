# Humiley Procurement Portal — Build Log (Phase Reports)

One-click full build per spec §24. Reports appended per phase; decisions logged instead of asking.

---

## Phase 1 — Foundation — IN PROGRESS

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
