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
}).superRefine((data, ctx) => {
  const fx = Number(data.fxRate);
  // A VND purchase order MUST have fxRate 1. The approval band is picked from total × fxRate, so a
  // fabricated tiny rate (e.g. 0.0001) shrinks the VND-equivalent and routes a high-value PO to a
  // junior approver — defeating the spending-authority matrix. VND is the dominant currency here.
  if (data.currency.toUpperCase() === "VND" && fx !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fxRate"], message: "For a VND purchase order the FX rate must be 1." });
  }
  // Typo guard for any currency (no real rate to VND exceeds this).
  if (fx > 1_000_000_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fxRate"], message: "FX rate is unrealistically large." });
  }
});

export type PoCreateInput = z.infer<typeof poCreateSchema>;
export type PoFormPayload = z.input<typeof poCreateSchema>;
