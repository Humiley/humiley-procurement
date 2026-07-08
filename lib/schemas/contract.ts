import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const moneyStr = z.string().trim().regex(/^\d+$/, "Whole VND");

export const contractCreateSchema = z
  .object({
    vendorId: z.string().min(1, "Vendor is required"),
    title: z.string().trim().min(1, "Title is required"),
    startDate: dateStr,
    endDate: dateStr,
    valueVnd: moneyStr,
    renewalAlertDays: z.coerce.number().int().min(0).max(365).default(60),
    prices: z.array(z.object({ itemId: z.string().min(1), priceVnd: moneyStr })).default([]),
  })
  .refine((v) => v.endDate > v.startDate, { message: "End date must be after the start date", path: ["endDate"] });
export type ContractCreatePayload = z.input<typeof contractCreateSchema>;
