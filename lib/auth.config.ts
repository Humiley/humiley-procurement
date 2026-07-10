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
    // Auth.js builds redirect targets against the request ORIGIN (no basePath awareness), so a
    // relative redirectTo like "/dashboard" would drop the /procurement prefix and 404. Prepend
    // the basePath to same-origin relative targets; pass through already-prefixed or foreign URLs.
    redirect({ url, baseUrl }) {
      const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
      if (url.startsWith("/")) {
        if (bp && (url === bp || url.startsWith(bp + "/"))) return `${baseUrl}${url}`;
        return `${baseUrl}${bp}${url}`;
      }
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        /* not a valid absolute URL — fall through */
      }
      return `${baseUrl}${bp}/dashboard`;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const nurl = request.nextUrl;
      // The app is served under a basePath (/procurement). Normalize to an app-relative pathname
      // (Next may or may not leave the basePath on nurl.pathname across versions — handle both),
      // and build every redirect as origin + basePath + path so the prefix is never dropped. We do
      // the redirect ourselves rather than returning false, because Auth.js's built-in sign-in
      // redirect is not basePath-aware and would send the user to a bare /login (404).
      const bp = nurl.basePath || process.env.NEXT_PUBLIC_BASE_PATH || "";
      let pathname = nurl.pathname;
      if (bp && pathname.startsWith(bp)) pathname = pathname.slice(bp.length) || "/";
      const at = (p: string) => new URL(bp + p, nurl.origin);

      const isPublic =
        pathname === "/login" ||
        pathname === "/sso" || // portal SSO landing creates the session
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      if (!isLoggedIn) {
        const login = at("/login");
        login.searchParams.set("callbackUrl", nurl.href);
        return Response.redirect(login);
      }
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
        return Response.redirect(at("/change-password"));
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
