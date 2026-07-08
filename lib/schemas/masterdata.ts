import { z } from "zod";

const reqText = z.string().trim().min(1, "Required");
const optText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().optional(),
);
const optId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().nullable().optional(),
);
const optMoney = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().min(0).optional(),
);
const bool = z.coerce.boolean();

export const departmentSchema = z.object({
  code: reqText,
  nameEn: reqText,
  nameVn: reqText,
  managerId: optId,
  overBudgetPolicy: z.enum(["WARN", "BLOCK"]).default("WARN"),
});

export const costCenterSchema = z.object({
  code: reqText,
  nameEn: reqText,
  nameVn: reqText,
  departmentId: reqText,
});

export const categorySchema = z.object({
  code: reqText,
  nameEn: reqText,
  nameVn: reqText,
  parentId: optId,
  isCapex: bool.optional().default(false),
});

export const uomSchema = z.object({
  code: reqText,
  nameEn: reqText,
  nameVn: reqText,
});

export const itemSchema = z.object({
  code: reqText,
  nameEn: reqText,
  nameVn: reqText,
  categoryId: reqText,
  uomId: reqText,
  specDescription: optText,
  lastPriceVnd: optMoney,
  isLotTracked: bool.optional().default(false),
  isActive: bool.optional().default(true),
});

export const vendorSchema = z.object({
  code: reqText,
  nameEn: reqText,
  nameVn: reqText,
  taxCode: optText,
  address: optText,
  contactName: optText,
  contactEmail: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().email("Invalid email").optional(),
  ),
  contactPhone: optText,
  paymentTermDays: z.preprocess(
    (v) => (v === "" || v == null ? 30 : v),
    z.coerce.number().int().min(0).max(365),
  ),
  bankName: optText,
  bankAccount: optText,
  categories: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
  ),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type CostCenterInput = z.infer<typeof costCenterSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type UomInput = z.infer<typeof uomSchema>;
export type ItemInput = z.infer<typeof itemSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
