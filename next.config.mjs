import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Procurement is an APP OF THE PORTAL served UNDER THE ONE PORTAL DOMAIN as a path —
// https://portal.humiley.com/procurement — so there is NO separate domain (the user's standing
// requirement). Everything (pages, /_next assets, /api, Server Actions, Auth.js) rides this prefix.
// Override with BASE_PATH="" only for a standalone-subdomain deploy.
const basePath = process.env.BASE_PATH ?? "/procurement";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile) — runs behind the portal's
  // Caddy, which routes /procurement* to this app.
  output: "standalone",
  basePath,
  // Expose the prefix to client code that builds raw URLs (fetch strings, which — unlike <Link>,
  // redirect(), useRouter() — are NOT auto-prefixed by Next). Read via lib/base-path.ts.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  experimental: {
    // Server Actions used for all mutations (spec CLAUDE.md hard rule).
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default withNextIntl(nextConfig);
