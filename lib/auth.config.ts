import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config (no Prisma/bcrypt) — imported by middleware.ts. The Credentials
 * provider (which needs Node APIs) is added in lib/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12h
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname === "/sso" || // portal SSO landing creates the session
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      if (!isLoggedIn) return false; // → Auth.js redirects to /login
      // Force a first-login / reset user to set their own password before anything else loads —
      // no provisioned account can operate on the shared temporary password.
      const mustChange = (auth?.user as { mustChangePw?: boolean } | undefined)?.mustChangePw;
      if (mustChange && pathname !== "/change-password") {
        return Response.redirect(new URL("/change-password", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles ?? [];
        token.departmentId = user.departmentId ?? null;
        token.isChief = user.isChief ?? false;
        token.locale = user.locale ?? "en";
        token.mustChangePw = user.mustChangePw ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.roles = (token.roles as Role[] | undefined) ?? [];
        session.user.departmentId = (token.departmentId as string | null | undefined) ?? null;
        session.user.isChief = (token.isChief as boolean | undefined) ?? false;
        session.user.locale = (token.locale as string | undefined) ?? "en";
        session.user.mustChangePw = (token.mustChangePw as boolean | undefined) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
