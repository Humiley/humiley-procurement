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
      // Force a user who still holds a system-issued password to set their own before anything
      // that needs it. Two populations carry mustChangePw:
      //   • admin-created / reset accounts (a temp password they were handed), and
      //   • SSO/JIT accounts (an unknown random password minted only so §19 e-sign has a hash).
      // e-sign re-auth (lib/esign/sign.ts) checks THIS password, so anyone who signs must own it.
      // A pure REQUESTER never signs (submit is unsigned) — don't wall them, so a portal SSO
      // requester stays seamless ("assign in the portal and they're in", like HR/CRM). The moment
      // an admin elevates them to a signing role, their next request is walled here to set one.
      const u = auth?.user as { mustChangePw?: boolean; roles?: string[] } | undefined;
      const willSign = (u?.roles ?? []).some((r) => r !== "REQUESTER");
      if (u?.mustChangePw && willSign && pathname !== "/change-password") {
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
