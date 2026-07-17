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
      // NOTE: deliberately NO change-password wall. In this deployment every user signs in through
      // the Humiley Portal (Microsoft 365 SSO) and has no procurement password to reuse — forcing a
      // password-set here is a dead end ("cannot set password / I use the portal login"), and it also
      // walls a stale JWT that still carries mustChangePw=true. §19 e-sign still re-authenticates with
      // a password at SIGN time (lib/esign/sign.ts); a signer who needs one can set it on the still-
      // reachable /change-password page (it skips the current-password check while mustChangePw is true).
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
