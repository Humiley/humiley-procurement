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
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let out = pick(L) + pick(U) + pick(D) + pick(S);
  for (let i = 0; i < 8; i++) out += pick(all);
  return out.split("").sort(() => Math.random() - 0.5).join("");
}
