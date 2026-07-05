import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
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
