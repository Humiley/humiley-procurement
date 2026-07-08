import { z } from "zod";

const decStr = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a valid number");

export const giCreateSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  costCenterId: z.string().min(1, "Cost center is required"),
  projectCode: z.string().trim().optional().nullable(),
  purpose: z.string().trim().min(1, "State the purpose"),
  lines: z
    .array(z.object({ itemId: z.string().min(1), qty: decStr.refine((v) => Number(v) > 0, "Quantity must be positive") }))
    .min(1, "Add at least one line"),
});
export type GiCreatePayload = z.input<typeof giCreateSchema>;

export const giExecuteSchema = z.object({
  issueId: z.string().min(1),
  lines: z.array(z.object({ lineId: z.string().min(1), qtyIssued: decStr })),
});
export type GiExecutePayload = z.input<typeof giExecuteSchema>;
