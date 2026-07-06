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

export const DEFAULT_PASSWORD = "Humiley@2026";
