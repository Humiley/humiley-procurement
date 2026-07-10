import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile) — makes the
  // procurement.humiley.com deploy runnable behind Caddy.
  output: "standalone",
  experimental: {
    // Server Actions used for all mutations (spec CLAUDE.md hard rule).
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default withNextIntl(nextConfig);
