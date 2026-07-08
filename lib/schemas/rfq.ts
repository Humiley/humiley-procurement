import { z } from "zod";

const decStr = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a valid number");

export const rfqLineSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().trim().min(1, "Description is required"),
  qty: decStr.refine((v) => Number(v) > 0, "Quantity must be positive"),
  uomId: z.string().optional().nullable(),
});

export const rfqCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  prId: z.string().optional().nullable(),
  dueDate: z.string().min(1, "Quote due date is required"), // yyyy-mm-dd
  vendorIds: z.array(z.string()).min(1, "Select at least one vendor"),
  lines: z.array(rfqLineSchema).min(1, "Add at least one line"),
});
export type RfqCreateInput = z.infer<typeof rfqCreateSchema>;
export type RfqFormPayload = z.input<typeof rfqCreateSchema>;

export const quoteEntrySchema = z.object({
  rfqId: z.string().min(1),
  vendorId: z.string().min(1),
  quoteRef: z.string().trim().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  paymentTerms: z.string().trim().optional().nullable(),
  lines: z
    .array(z.object({ rfqLineId: z.string().min(1), unitPrice: decStr }))
    .min(1, "Enter a price for every line"),
});
export type QuoteEntryInput = z.infer<typeof quoteEntrySchema>;
export type QuoteEntryPayload = z.input<typeof quoteEntrySchema>;
