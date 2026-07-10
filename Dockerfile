# Humiley Procurement — production image (Next.js standalone).
# Build:  docker build -t humiley-procurement .
# Run:    behind Caddy, reverse-proxying procurement.humiley.com -> this:3000
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
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
