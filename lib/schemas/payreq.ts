import { z } from "zod";

const decStr = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount");

export const PAYREQ_TYPES = ["VENDOR_PAYMENT", "ADVANCE", "REIMBURSEMENT", "ADVANCE_SETTLEMENT"] as const;

export const payReqCreateSchema = z
  .object({
    type: z.enum(PAYREQ_TYPES),
    costCenterId: z.string().min(1, "Cost center is required"),
    vendorId: z.string().optional().nullable(),
    invoiceIds: z.array(z.string()).optional(),           // VENDOR_PAYMENT
    poId: z.string().optional().nullable(),               // ADVANCE (optional PO down-payment)
    advanceRequestId: z.string().optional().nullable(),   // ADVANCE_SETTLEMENT
    amount: decStr.optional(),                            // ADVANCE / settlement difference basis
    dueDate: z.string().optional().nullable(),
    reason: z.string().trim().min(1, "State the reason / purpose"),
    paymentMethod: z.enum(["BANK_TRANSFER", "CASH"]).default("BANK_TRANSFER"),
    lines: z
      .array(z.object({ description: z.string().trim().min(1), amount: decStr }))
      .optional(), // REIMBURSEMENT / ADVANCE_SETTLEMENT free lines
  })
  .superRefine((v, ctx) => {
    if (v.type === "VENDOR_PAYMENT" && (!v.vendorId || !(v.invoiceIds ?? []).length)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick the vendor and at least one matched invoice." });
    }
    if (v.type === "ADVANCE" && !(Number(v.amount ?? 0) > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the advance amount." });
    }
    if ((v.type === "REIMBURSEMENT" || v.type === "ADVANCE_SETTLEMENT") && !(v.lines ?? []).length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least one expense line." });
    }
    if (v.type === "ADVANCE_SETTLEMENT" && !v.advanceRequestId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick the advance being settled." });
    }
  });

export type PayReqCreatePayload = z.input<typeof payReqCreateSchema>;
