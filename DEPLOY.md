# Deploying Humiley Procurement

Procurement is an **app of the Humiley Portal** — no separate login and **no separate domain**. It
is served **under the one portal domain as a path**: `https://portal.humiley.com/procurement`
(Next.js `basePath`). It ships as a standalone image with a bundled PostgreSQL 16 and a one-command
`deploy.sh`, and runs as its own compose stack that the portal's Caddy routes to over a shared
Docker network.

> **The one secret that must match:** `PORTAL_SSO_SECRET` (here) must equal the portal's
> `TK_SSO_SECRET` (in `/opt/humiley-timekeeping/.env`). Otherwise the no-second-login handoff
> silently falls back to the procurement login page. Copy it verbatim.

---

## Deploy (same VPS as the portal — recommended)

Because it lives under `portal.humiley.com/procurement`, there is **no new DNS record and no new
TLS certificate** — it rides the portal's existing domain and cert. The portal side is already
wired: its `Caddyfile` routes `/procurement*` to this app over the shared `humiley_net` network.
Two steps:

**1. Update the portal once** — applies the round-5 fixes AND creates `humiley_net` + activates the
`/procurement` route:
```bash
cd /opt/humiley-timekeeping && ./update.sh
```

**2. Deploy procurement:**
```bash
git clone https://github.com/Humiley/humiley-procurement.git /opt/humiley-procurement
cd /opt/humiley-procurement
cp .env.production.example .env
nano .env      # set POSTGRES_PASSWORD, BOOTSTRAP_ADMIN_EMAIL, and PORTAL_SSO_SECRET =
               # the portal's TK_SSO_SECRET (grep it: grep TK_SSO_SECRET /opt/humiley-timekeeping/.env)
./deploy.sh --bootstrap        # do NOT use --edge (the portal's Caddy fronts it)
```

That's it — `https://portal.humiley.com/procurement` comes up (the app prints a one-time admin
password; **copy it**). Later updates are just `cd /opt/humiley-procurement && ./deploy.sh`.

> Run the portal `./update.sh` (step 1) before step 2 so the shared network + route exist — but
> `deploy.sh` creates `humiley_net` itself if missing, so it's resilient either way. Caddy 502s the
> `/procurement` path until step 2 finishes; the portal itself is unaffected.

---

## Alternative — its own subdomain on a separate host

Only if you deliberately want Procurement on a **different server** (its own `procurement.humiley.com`
with its own cert). This uses the bundled Caddy (`--edge`) and needs a DNS A record. It also requires
building with the subdomain routing instead of the path basePath:

```bash
# on the separate host
git clone https://github.com/Humiley/humiley-procurement.git /opt/humiley-procurement
cd /opt/humiley-procurement && cp .env.production.example .env
nano .env       # set the secrets + APP_URL=https://procurement.humiley.com + PROCUREMENT_DOMAIN
BASE_PATH= ./deploy.sh --bootstrap --edge    # BASE_PATH= (empty) serves at the root, not /procurement
```
Then point `procurement.humiley.com` (A record) at that host. **Mind the DNSSEC gotcha** the portal
hit — if Let's Encrypt can't issue, check `dig procurement.humiley.com CAA @8.8.8.8` isn't `SERVFAIL`.
The launcher works with either model (it appends `/sso` to whatever path the configured URL has).

---

## What `deploy.sh` does

Backs up the Postgres DB → `git pull` → generates `AUTH_SECRET` once → builds → runs
`prisma migrate deploy` (applies every migration, incl. `sso_token_single_use`) → on `--bootstrap`
seeds the §6 approval matrix + one ADMIN (**random password printed once — copy it**) → starts the
app → health-checks `/procurement/login`. Data lives in the `proc_db` and `proc_storage` volumes and
survives redeploys. Migrations + bootstrap run from a one-off container built off the `builder`
stage, because the slim runtime image intentionally omits the Prisma CLI and tsx.

## After go-live

1. Sign in as the bootstrap admin → change the printed password immediately.
2. In the **portal**, grant users the Procurement app (Access & Permissions) and set the Procurement
   URL in Settings → Company Portal to **`https://portal.humiley.com/procurement`**. They then open
   it from the sidebar with no login.
3. First time a user with a **signing role** opens it, they set a signing password once (used for
   §19 e-sign re-auth); pure requesters are never prompted.
4. Run **/admin/settings → "Verify all chains"** as the baseline signature-integrity snapshot.
