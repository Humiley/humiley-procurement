# Procurement as an app of the Humiley Portal — Integration Guide

The procurement portal is an **app of the Humiley Portal** (portal.humiley.com), like HR/Finance/
CRM — not a standalone product. This document is the exact integration plan: SSO, launcher, user
mapping, and deployment. It fulfils the standing constraint recorded in PHASE-REPORTS.md.

## 1. Deployment shape

- Deploy this Next.js app on the same VPS as the portal (Docker), reachable at
  **procurement.humiley.com** (recommended — cookies and MSAL redirect URIs stay clean) behind the
  existing Caddy. Caddy block:

  ```
  procurement.humiley.com {
      reverse_proxy procurement:3000
  }
  ```

- `docker-compose` service `procurement` (Next standalone build) + the existing Postgres 16 with a
  dedicated `humiley_procurement` database. `.env`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL=https://procurement.humiley.com`,
  SMTP_* (optional), and the Entra variables below.

## 2. Single sign-on with Microsoft 365 (Entra ID)

The portal signs users in with M365; procurement must accept the same identity so a portal user
lands here already authenticated. Auth.js v5 makes this a **provider addition, not a rebuild**:

1. In the SAME Entra app registration the portal uses (or a sibling one), add redirect URI
   `https://procurement.humiley.com/api/auth/callback/microsoft-entra-id`.
2. `npm i @auth/core` already includes the provider. In `lib/auth.config.ts` add:

   ```ts
   import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
   providers: [
     MicrosoftEntraID({
       clientId: process.env.AUTH_ENTRA_ID,
       clientSecret: process.env.AUTH_ENTRA_SECRET,
       issuer: `https://login.microsoftonline.com/${process.env.AUTH_ENTRA_TENANT}/v2.0`,
     }),
     Credentials({ ... }), // keep as the local/dev fallback
   ]
   ```

3. **User mapping (no JIT provisioning, per §17):** in the `signIn` callback, look the Entra
   email up in the procurement `User` table (`email` is unique). Found + `isActive` → session
   carries that user's id/roles exactly as today; not found → sign-in refused with a bilingual
   "ask an admin to grant procurement access" page. Admins create users at /admin/users with the
   SAME work email as M365 — that email IS the join key to the portal's employee directory.
4. Roles remain procurement-local (PURCHASER/WAREHOUSE/…) — the portal's own roles do not map
   1:1 and §15 SoD depends on these staying curated.
5. **E-signatures under SSO:** §19 re-authentication currently verifies the local password. With
   Entra sign-in, users keep a local signing password (set at first login), OR swap `signRecord`'s
   check for an MSAL `prompt:"login"` re-auth like the HR portal uses (same pattern as the
   timekeeping portal's e-sign; see its `tkESign`). Either satisfies "signature = fresh
   authentication"; pick one at rollout and record it in VALIDATION.md.

## 3. Portal launcher entry — ✅ SHIPPED (portal side)

The Humiley Portal now carries Procurement as a first-class app (implemented in the portal's
`templates/index.html` + `app.py`):

- **Sidebar section "Procurement"** with a "Procurement Portal · Cổng Mua hàng" entry
  (external-link arrow, shopping-cart icon) — opens this app in a new tab at
  `<procurementUrl>/login?email=<signed-in user>`; the login screen prefills that email
  (see §2.3 — the address is the join key). Already-authenticated users are bounced straight
  to their procurement dashboard.
- **Opt-in access** exactly like HR/Finance: `procurement` is an appsAllowed opt-in app —
  hidden for everyone until an admin ticks the **Procurement** checkbox per employee in
  Access & Permissions (admins always see it). The permission matrix documents the capability;
  actually signing in additionally requires a procurement `User` row (step 2.3).
- **Admin-configurable URL**: HR Admin → Company Portal → "Procurement app (URL)" (stored as
  the `portal_procurementUrl` setting, exposed via `/api/config`). Blank = default
  `https://procurement.humiley.com` (localhost:3000 in development).
- Every launch is written to the portal's audit trail ("Opened Procurement").
- Optional deep links from portal widgets: `/approvals`, `/payment-requests`, `/reports` —
  all routes are stable and role-guarded server-side.

## 4. Data touchpoints (read-only, via §17 API)

The portal (or any internal tool) can pull procurement data with an API key minted at
/admin/settings:

- `GET /api/v1/payment-requests` — feed the Finance app's cash-planning widget.
- `GET /api/v1/stock-balances` — site dashboards.
- `GET /api/v1/openapi` — the machine-readable contract.
- Webhooks (po.approved / invoice.matched / payment.paid / stock.belowMin) can target a portal
  endpoint to surface Teams/portal notifications.

## 5. Brand & UX consistency

Navy `#205090` / emerald `#00B060`, Calibri-compatible system stack, bilingual EN/VN with the
same language-toggle convention as the portal — already enforced throughout (§10 brand rules).

## 6. Rollout checklist

1. Provision DNS `procurement.humiley.com` + Caddy block (watch the DNSSEC gotcha noted in the
   portal's deployment docs).
2. Add the Entra redirect URI; set `AUTH_ENTRA_*` envs; enable the provider.
3. Create the pilot users at /admin/users with their M365 emails; assign roles.
4. Launcher + per-user app permission are already in the portal — just grant users the
   Procurement app in Access & Permissions and set the production URL in Company Portal.
5. Seed reference data (C/O forms, HS codes, FX) via `npm run seed` equivalents for production
   (reference-only seed script — do NOT run the demo-document seed in production).
6. Decide the §19 signing mode under SSO (local signing password vs MSAL re-auth) and record it.
7. Run /admin/settings → "Verify all chains" after go-live migration as the baseline integrity
   snapshot.
