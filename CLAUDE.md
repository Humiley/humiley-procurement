# Humiley Procurement Portal
Spec: HUMILEY-PROCUREMENT-SPEC.md — the single source of truth. Never contradict it silently.

## Commands
- npm run dev            # dev server
- npm run check          # tsc --noEmit && eslint . (run after EVERY task, must pass)
- npm run build          # what the Dockerfile runs — run before ANY push (see below)
- npx prisma migrate dev # after any schema change
- npm run seed           # reset + reseed demo data
- npm run test:e2e       # playwright

## ⚠️ This repo's build gates the PORTAL's deploy
`update.sh` on the VPS builds both images from one docker-compose, and this Dockerfile runs
`npx prisma generate && npm run build`. `next build` fails the whole image on an **ESLint** error, so
a single `let` that should be `const` blocked the production release of *both* apps for days while
the portal's own CI stayed green — it does not build this repo. Auto-deploy retried every 2 minutes
until its five-try give-up guard fired and went silent, which from outside looks like "auto-deploy
isn't running". CI (`.github/workflows/ci.yml`) now runs the same two commands on every push, but do
not lean on it: run `npm run check` **and** `npm run build` before pushing, because a red main here
means nothing ships anywhere.

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
