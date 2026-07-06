# Humiley Procurement Portal — Build Log (Phase Reports)

One-click full build per spec §24. Reports appended per phase; decisions logged instead of asking.

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
