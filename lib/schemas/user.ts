import { z } from "zod";

export const ROLE_VALUES = [
  "REQUESTER",
  "DEPT_MANAGER",
  "PURCHASER",
  "DIRECTOR",
  "ACCOUNTANT",
  "WAREHOUSE",
  "ADMIN",
] as const;

export const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "Select at least one role"),
  departmentId: z.string().nullable().optional(),
  isChief: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const userUpdateSchema = userSchema.omit({ email: true });

export type UserInput = z.infer<typeof userSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const DEFAULT_PASSWORD = "Humiley@2026";   // seed/demo ONLY — never for provisioned prod users

/** A random one-time initial password for a newly provisioned / reset account. Shown to the
 *  admin exactly once; the user must change it on first login (mustChangePw). 12 chars with the
 *  required mix (lower/upper/digit/symbol). */
export function generateTempPassword(): string {
  const L = "abcdefghijkmnpqrstuvwxyz", U = "ABCDEFGHJKLMNPQRSTUVWXYZ", D = "23456789", S = "!@#$%^&*";
  const all = L + U + D + S;
  // Crypto-grade randomness — this password gates both login and the §19 e-signature re-auth,
  // so it must not be predictable. (Web Crypto is a global in Node 18+ and the browser.)
  const rand = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n; // modulo bias is negligible for these ≤32-char alphabets
  };
  const pick = (set: string) => set[rand(set.length)];
  const chars = [pick(L), pick(U), pick(D), pick(S)];
  for (let i = 0; i < 8; i++) chars.push(all[rand(all.length)]);
  // Fisher–Yates shuffle (the old sort(()=>random-0.5) is both biased and non-crypto).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
