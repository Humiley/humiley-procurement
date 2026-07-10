# Humiley Procurement — production image (Next.js standalone, served under the /procurement path
# of the portal domain — no separate domain).
# Build:  docker build -t humiley-procurement .
# Run:    behind the portal's Caddy, which routes portal.humiley.com/procurement* -> this:3000
#         env: DATABASE_URL, PORTAL_SSO_SECRET (== portal TK_SSO_SECRET), AUTH_SECRET, AUTH_TRUST_HOST=true
#
# ONE-TIME DB SETUP (migrate + bootstrap): the standalone `runner` image below is deliberately
# minimal and does NOT ship the prisma CLI or tsx (both are devDependencies). So run setup from
# the `builder` stage, which has the full toolchain + source, as a throwaway container:
#   docker build --target builder -t humiley-procurement-setup .
#   docker run --rm --env-file .env --network <compose-net> humiley-procurement-setup \
#     sh -c "npx prisma migrate deploy && npm run bootstrap"      (BOOTSTRAP_ADMIN_EMAIL set)
# (DATABASE_URL must point at the prod DB; --network lets the one-off reach the db service.)
# See docs/PORTAL-INTEGRATION.md §6 for the full rollout checklist.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# basePath is baked in at build time. Default "/procurement" (served under the portal domain);
# pass --build-arg BASE_PATH="" to build a root-served image for a standalone subdomain deploy.
ARG BASE_PATH=/procurement
ENV BASE_PATH=$BASE_PATH
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# standalone output bundles only what the server needs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma engine + schema + the bootstrap/migrate tooling for one-time setup
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
# Uploaded documents (invoices/bills) land under STORAGE_DIR=/app/storage — a compose volume
# mounts here so they survive redeploys. Created owned by nextjs so a fresh named volume
# inherits writable ownership (uid 1001).
RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage
ENV STORAGE_DIR=/app/storage
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
