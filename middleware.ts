import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware: uses the `authorized` callback in authConfig to gate every route.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets, image files, /api/v1 (token-authenticated machine API
  // — requireApiKey guards every v1 route itself) and /api/internal (in-process only, guarded by a
  // per-boot token the sweep route checks itself; auth here would bounce the timer to /login).
  matcher: [
    "/((?!api/v1|api/internal|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
