import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware: uses the `authorized` callback in authConfig to gate every route.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets, image files, and /api/v1 (token-authenticated
  // machine API — requireApiKey guards every v1 route itself).
  matcher: ["/((?!api/v1|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
