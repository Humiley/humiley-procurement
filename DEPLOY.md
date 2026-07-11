# Deploying Humiley Procurement

Procurement is an **app of the Humiley Portal** — no separate login and **no separate domain**. It
is served **under the one portal domain as a path**: `https://portal.humiley.com/procurement`
(Next.js `basePath`).

## Recommended: the ONE combined stack (deploy with the portal)

Procurement runs in the **portal's single docker-compose stack** — Portal + Procurement + Postgres +
one Caddy, started by **one command**. Its SSO secret is the *same variable* as the portal's, so it
can never drift out of sync. On the VPS:

```bash
cd /opt/humiley-timekeeping                 # the portal repo
# (Procurement is cloned into ./humiley-procurement automatically by update.sh)
./update.sh --bootstrap                     # first time — builds + migrates + seeds everything
#   later:  ./update.sh                      # one command updates the whole stack
```

`update.sh` pulls both repos, generates every secret once into the single `.env`
(`TK_SSO_SECRET`/`AUTH_SECRET`/`POSTGRES_PASSWORD`), builds the Portal + Procurement images, runs the
Procurement migrations, and starts all containers. `--bootstrap` also seeds the §6 matrix + one
ADMIN (**random password printed once — copy it**). `https://portal.humiley.com/procurement` comes
up with the Portal at the root — one server, one domain, one command.

> Everything below (this repo's own `docker-compose.yml` + `deploy.sh`) is the **standalone
> alternative** — only for running Procurement on a *separate* host, not the combined stack.

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
