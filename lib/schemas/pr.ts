import { z } from "zod";

const optText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().optional(),
);

export const prLineSchema = z
  .object({
    itemId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable().optional()),
    freeTextDescription: optText,
    uomId: z.string().min(1, "Unit of measure is required"),
    qty: z.coerce.number().positive("Quantity must be greater than 0"),
    estUnitPriceVnd: z.coerce.number().min(0, "Price cannot be negative"),
    isCapex: z.coerce.boolean().optional().default(false),
    note: optText,
  })
  .refine((l) => !!l.itemId || !!l.freeTextDescription, {
    message: "Pick a catalog item or enter a description",
    path: ["freeTextDescription"],
  });

export const prCreateSchema = z.object({
  costCenterId: z.string().min(1, "Cost center is required"),
  neededByDate: z.string().min(1, "Needed-by date is required"),
  purpose: z.string().trim().min(1, "Purpose is required"),
  projectCode: optText,
  lines: z.array(prLineSchema).min(1, "Add at least one line"),
});

export type PrLineInput = z.infer<typeof prLineSchema>;
export type PrCreateInput = z.infer<typeof prCreateSchema>;

/** Raw payload shape the client sends (pre-coercion: qty/price as strings). */
export type PrFormPayload = {
  costCenterId: string;
  neededByDate: string;
  purpose: string;
  projectCode?: string | null;
  lines: Array<{
    itemId: string | null;
    freeTextDescription: string | null;
    uomId: string;
    qty: string | number;
    estUnitPriceVnd: string | number;
    isCapex: boolean;
    note: string | null;
  }>;
};
