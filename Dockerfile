# Humiley Procurement — production image (Next.js standalone).
# Build:  docker build -t humiley-procurement .
# Run:    behind Caddy, reverse-proxying procurement.humiley.com -> this:3000
#         env: DATABASE_URL, AUTH_SECRET, AUTH_TRUST_HOST=true
# After first `prisma migrate deploy`, run the one-time bootstrap (see docs/PORTAL-INTEGRATION.md):
#   docker compose exec procurement npx tsx prisma/bootstrap.ts   (BOOTSTRAP_ADMIN_EMAIL set)

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
