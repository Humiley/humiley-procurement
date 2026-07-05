import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware: uses the `authorized` callback in authConfig to gate every route.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets and image files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
