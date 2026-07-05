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
