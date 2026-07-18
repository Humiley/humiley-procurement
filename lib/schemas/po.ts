import { z } from "zod";

/** §8 Incoterms 2020 — the eleven rules. */
export const INCOTERMS_2020 = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;
export const VAT_RATES = ["0", "5", "8", "10"] as const;

const decStr = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a valid number");

export const poLineSchema = z.object({
  prLineId: z.string().optional().nullable(),
  itemId: z.string().optional().nullable(),
  description: z.string().trim().min(1, "Description is required"),
  uomId: z.string().min(1, "Unit of measure is required"),
  qty: decStr.refine((v) => Number(v) > 0, "Quantity must be positive"),
  unitPrice: decStr,
  isCapex: z.boolean().optional(),
});

export const poCreateSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  prId: z.string().optional().nullable(),
  quoteId: z.string().optional().nullable(),
  currency: z.string().trim().min(3).max(3).default("VND"),
  fxRate: decStr.refine((v) => Number(v) > 0, "FX rate must be greater than 0").default("1"),
  paymentTerms: z.string().trim().optional().nullable(),
  incoterm: z.enum(INCOTERMS_2020).optional().nullable(),
  incotermPlace: z.string().trim().optional().nullable(),
  deliveryAddress: z.string().trim().optional().nullable(),
  expectedDate: z.string().optional().nullable(), // yyyy-mm-dd
  warrantyTerms: z.string().trim().optional().nullable(),
  vatPct: z.enum(VAT_RATES).default("10"),
  lines: z.array(poLineSchema).min(1, "Add at least one line"),
});

export type PoCreateInput = z.infer<typeof poCreateSchema>;
export type PoFormPayload = z.input<typeof poCreateSchema>;
