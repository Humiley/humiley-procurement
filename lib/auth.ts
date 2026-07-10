import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-sso";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Portal single-sign-on: a user already authenticated in the Humiley Portal (Microsoft 365)
    // is signed in with NO password — procurement is a portal app, like HR/CRM. The portal mints
    // a signed one-time token (see lib/portal-sso.ts); we verify it and map to the procurement User.
    Credentials({
      id: "portal-sso",
      name: "Humiley Portal",
      credentials: { token: { label: "Portal token", type: "text" } },
      async authorize(creds) {
        const identity = verifyPortalToken(String(creds?.token ?? ""));
        if (!identity) return null;
        // SINGLE USE: record the token id; a unique-insert collision means it was already
        // consumed → reject the replay. Prune expired rows opportunistically.
        try {
          await db.ssoTokenUse.create({ data: { id: identity.tokenId, expiresAt: identity.expiresAt } });
        } catch {
          return null; // already used (P2002) — replay blocked
        }
        db.ssoTokenUse.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
        let user = await db.user.findUnique({ where: { email: identity.email } });
        // JIT provisioning: the token is portal-signed and only minted for users the admin has
        // GRANTED Procurement (portal appsAllowed), so a first-time arrival is auto-created as a
        // REQUESTER — "assign in the portal and they're in", like HR/CRM. The admin elevates the
        // role (purchaser/director/…) in Admin → Users when someone needs more than raising PRs.
        // A random password is set only so §19 e-sign re-auth has a credential; SSO login never
        // needs it (mustChangePw stays false — no change-password wall on a portal user).
        if (!user) {
          try {
            user = await db.user.create({
              data: {
                email: identity.email,
                name: identity.name,
                passwordHash: await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10),
                roles: ["REQUESTER"],
                isActive: true,
                // mustChangePw stays TRUE until they set their own password — needed because §19
                // e-sign re-auth (lib/esign/sign.ts) checks this password. The middleware only
                // ACTS on the flag for users who actually sign (a signing role), so a pure
                // REQUESTER is never walled and stays seamless; a signer sets a password once.
                mustChangePw: true,
              },
            });
          } catch {
            // JIT create race (two concurrent first logins) → the other request won; re-read.
            user = await db.user.findUnique({ where: { email: identity.email } });
            if (!user) return null;
          }
        }
        if (!user.isActive) return null; // an admin can revoke access by deactivating the user
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          departmentId: user.departmentId,
          isChief: user.isChief,
          locale: user.locale,
          // Report the REAL flag — an SSO user who holds an unknown random password must be able
          // to set one before they can e-sign. The middleware only walls signing roles.
          mustChangePw: user.mustChangePw,
        };
      },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        // Account lockout window still active → deny without checking password.
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed,
              lockedUntil:
                failed >= MAX_FAILED
                  ? new Date(Date.now() + LOCK_MINUTES * 60_000)
                  : null,
            },
          });
          return null;
        }

        if (user.failedLogins > 0 || user.lockedUntil) {
          await db.user.update({
            where: { id: user.id },
            data: { failedLogins: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          departmentId: user.departmentId,
          isChief: user.isChief,
          locale: user.locale,
          mustChangePw: user.mustChangePw,
        };
      },
    }),
  ],
});

/** Hash a plaintext password (cost 10). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
