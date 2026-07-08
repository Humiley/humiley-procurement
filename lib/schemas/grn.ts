import { z } from "zod";

const decStr = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a valid number");

export const grnCreateSchema = z.object({
  poId: z.string().min(1, "Purchase order is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  notes: z.string().trim().optional().nullable(),
  lines: z
    .array(z.object({ poLineId: z.string().min(1), qtyReceived: decStr }))
    .min(1)
    .refine((ls) => ls.some((l) => Number(l.qtyReceived) > 0), "Receive at least one unit"),
});
export type GrnCreatePayload = z.input<typeof grnCreateSchema>;

export const grnAcceptSchema = z.object({
  grnId: z.string().min(1),
  lines: z.array(
    z.object({
      grnLineId: z.string().min(1),
      qtyAccepted: decStr,
      qtyRejected: decStr,
      rejectReason: z.string().trim().optional().nullable(),
      // §21: lot-tracked items capture a lot at acceptance (blank lotNumber ⇒ auto LOT-YYMMDD-####)
      lotNumber: z.string().trim().optional().nullable(),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
    }),
  ),
});
export type GrnAcceptPayload = z.input<typeof grnAcceptSchema>;

export const invoiceCreateSchema = z.object({
  poId: z.string().min(1, "Purchase order is required"),
  vendorInvoiceNo: z.string().trim().min(1, "The vendor's invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  lines: z
    .array(z.object({ poLineId: z.string().min(1), qty: decStr, unitPrice: decStr }))
    .min(1)
    .refine((ls) => ls.some((l) => Number(l.qty) > 0), "Invoice at least one unit"),
});
export type InvoiceCreatePayload = z.input<typeof invoiceCreateSchema>;
