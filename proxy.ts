import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Proxy (Next 16's name for middleware.ts, which it deprecates): uses the `authorized` callback in
// authConfig to gate every route. Unlike the old edge middleware, a proxy always runs on the Node.js
// runtime. authConfig stays edge-safe (no Prisma/bcrypt) all the same, so nothing here depends on that.
export const proxy = NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets, image files, /api/v1 (token-authenticated machine API
  // — requireApiKey guards every v1 route itself) and /api/internal (in-process only, guarded by a
  // per-boot token the sweep route checks itself; auth here would bounce the timer to /login).
  matcher: [
    "/((?!api/v1|api/internal|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
