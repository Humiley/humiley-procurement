# Deploying Humiley Procurement

Procurement is an **app of the Humiley Portal** — no separate login. It ships as a Next.js
standalone image with a bundled PostgreSQL 16 and a one-command `deploy.sh`. Pick ONE hosting
option below; both use the same stack.

> **The one secret that must match:** `PORTAL_SSO_SECRET` (here) must equal the portal's
> `TK_SSO_SECRET` (in `/opt/humiley-timekeeping/.env`). Otherwise the no-second-login handoff
> silently falls back to the procurement login page. Copy it verbatim.

---

## Option A — standalone host (recommended, simplest)

Procurement on its own VPS, or any host where ports 80/443 are free. The bundled Caddy gets the
HTTPS cert automatically.

```bash
# on the host
git clone https://github.com/Humiley/humiley-procurement.git /opt/humiley-procurement
cd /opt/humiley-procurement
cp .env.production.example .env
nano .env            # set POSTGRES_PASSWORD, PORTAL_SSO_SECRET (== portal TK_SSO_SECRET),
                     # BOOTSTRAP_ADMIN_EMAIL, PROCUREMENT_DOMAIN/APP_URL. Leave AUTH_SECRET blank.
./deploy.sh --bootstrap --edge
```

DNS: point `procurement.humiley.com` (A record) at this host's IP. **Watch the DNSSEC gotcha** the
portal hit — if Let's Encrypt can't issue, check `dig procurement.humiley.com CAA @8.8.8.8` isn't
`SERVFAIL` (Mat Bao disabled DNSSEC for the portal for exactly this reason).

Later updates: `cd /opt/humiley-procurement && ./deploy.sh` (migrations run automatically).

---

## Option B — same VPS as the live portal

The portal's Caddy already owns 80/443, so **do NOT use the bundled Caddy** (no `--edge`). Run the
app privately and let the portal's Caddy proxy it.

```bash
git clone https://github.com/Humiley/humiley-procurement.git /opt/humiley-procurement
cd /opt/humiley-procurement
cp .env.production.example .env
nano .env            # as above; leave PROCUREMENT_BIND=127.0.0.1 (app stays private)
./deploy.sh --bootstrap        # NOTE: no --edge
```

Then expose it through the portal's Caddy. In `/opt/humiley-timekeeping/`:

1. Add `host.docker.internal` to the portal's Caddy container — in `docker-compose.yml` under the
   `caddy` service add:
   ```yaml
       extra_hosts:
         - "host.docker.internal:host-gateway"
   ```
2. Add a block to `/opt/humiley-timekeeping/Caddyfile`:
   ```
   procurement.humiley.com {
       header Strict-Transport-Security "max-age=31536000; includeSubDomains"
       reverse_proxy host.docker.internal:3000
   }
   ```
3. `docker compose up -d caddy` (rebuilds only the web layer; the portal app + DB are untouched).

DNS + DNSSEC caveat is the same as Option A.

---

## What `deploy.sh` does

Backs up the Postgres DB → `git pull` → generates `AUTH_SECRET` once → builds → runs
`prisma migrate deploy` (applies every migration, incl. `sso_token_single_use`) → on `--bootstrap`
seeds the §6 approval matrix + one ADMIN (**random password printed once — copy it**) → starts the
app → health-checks. Data lives in the `proc_db` and `proc_storage` volumes and survives redeploys.

Migrations + bootstrap run from a one-off container built off the `builder` stage, because the slim
runtime image intentionally omits the Prisma CLI and tsx.

## After go-live

1. Sign in as the bootstrap admin → change the printed password immediately.
2. In the **portal**, grant users the Procurement app (Access & Permissions) and set the
   Procurement URL in Settings → Company Portal. They then open it from the sidebar with no login.
3. First time a user with a **signing role** opens it, they set a signing password once (used for
   §19 e-sign re-auth); pure requesters are never prompted.
4. Run **/admin/settings → "Verify all chains"** as the baseline signature-integrity snapshot.
