#!/usr/bin/env bash
# Humiley Procurement — one-command deploy / update for the VPS.
# Does: back up the Postgres DB → pull latest → ensure AUTH_SECRET → build → migrate → (first run)
# seed admin → restart → health-check. Your data (proc_db + proc_storage volumes) is NEVER dropped.
#
# Usage on the server:
#   ./deploy.sh --bootstrap     # FIRST deploy: also seeds the approval matrix + one admin
#   ./deploy.sh                 # later updates (migrations run automatically)
#   ./deploy.sh --edge          # also (re)start the bundled Caddy — standalone host ONLY
#   ./deploy.sh --no-backup     # skip the DB snapshot (not recommended)
set -euo pipefail
cd "$(dirname "$0")"

DO_BOOTSTRAP=0; DO_EDGE=0; SKIP_BACKUP=0
for a in "$@"; do case "$a" in
  --bootstrap) DO_BOOTSTRAP=1 ;;
  --edge) DO_EDGE=1 ;;
  --no-backup) SKIP_BACKUP=1 ;;
  *) echo "unknown flag: $a" >&2; exit 2 ;;
esac; done

BACKUP_DIR="${BACKUP_DIR:-/root/humiley-proc-backups}"
say(){ printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

[ -f .env ] || { echo "No .env — run: cp .env.production.example .env  (then edit it)"; exit 1; }

# 1) Back up the Postgres DB (skip on the very first deploy — the db may not exist yet)
if [ "$SKIP_BACKUP" -eq 0 ] && docker compose ps db 2>/dev/null | grep -q humiley_proc_db; then
  say "Backing up the database…"
  mkdir -p "$BACKUP_DIR"
  OUT="$BACKUP_DIR/procurement-$(date +%F-%H%M%S).sql.gz"
  # shellcheck disable=SC1091
  PU="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"; PU="${PU:-procurement}"
  PDB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"; PDB="${PDB:-humiley_procurement}"
  if docker compose exec -T db pg_dump -U "$PU" "$PDB" | gzip > "$OUT"; then
    echo "    saved: $OUT"
    ls -1t "$BACKUP_DIR"/procurement-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
  else
    echo "    WARNING: backup failed. Aborting (use --no-backup to override)." >&2; exit 1
  fi
fi

# 2) Latest code
say "Pulling latest code…"
git pull

# 3) Generate AUTH_SECRET once (reused forever — changing it invalidates all live sessions)
touch .env
if grep -qE '^AUTH_SECRET=..' .env; then
  say "AUTH_SECRET already set — leaving it unchanged."
else
  say "Generating AUTH_SECRET (first run)…"
  SEC="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  sed -i.bak '/^AUTH_SECRET=/d' .env && rm -f .env.bak
  printf 'AUTH_SECRET=%s\n' "$SEC" >> .env
  echo "    saved to .env — back up this file."
fi

# 3.5) Sanity: PORTAL_SSO_SECRET must be present (equal to the portal's TK_SSO_SECRET)
grep -qE '^PORTAL_SSO_SECRET=..' .env || {
  echo "    WARNING: PORTAL_SSO_SECRET is empty. The no-second-login handoff will fall back to the"
  echo "    procurement login screen until you set it to the portal's TK_SSO_SECRET." >&2
}

# 4) Build images (app + the builder-based setup image)
say "Building images…"
docker compose build

# 5) Bring up the datastore first, then run migrations against it
say "Starting database…"
docker compose up -d db
say "Applying migrations…"
docker compose --profile setup run --rm migrate

# 6) First-run seed (approval matrix + admin) — only when asked
if [ "$DO_BOOTSTRAP" -eq 1 ]; then
  say "Seeding reference data + admin…"
  docker compose --profile setup run --rm bootstrap
fi

# 7) Start the app (and, if requested, the bundled edge Caddy)
say "Starting the app…"
docker compose up -d app
if [ "$DO_EDGE" -eq 1 ]; then
  say "Starting the bundled Caddy (standalone edge)…"
  docker compose --profile edge up -d caddy
fi

# 8) Health check
say "Containers:"; docker compose ps
PORT="$(grep -E '^PROCUREMENT_PORT=' .env | cut -d= -f2-)"; PORT="${PORT:-3000}"
say "Checking the app on 127.0.0.1:$PORT …"; sleep 3
CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || echo 000)"
if [ "$CODE" = "200" ]; then
  printf '\033[1;32m    OK — HTTP %s. Deploy complete.\033[0m\n' "$CODE"
else
  printf '\033[1;33m    Got HTTP %s — check logs:  docker compose logs --tail=60 app\033[0m\n' "$CODE"
fi
