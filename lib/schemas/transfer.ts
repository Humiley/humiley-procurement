import { z } from "zod";

const decStr = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a valid number");

export const transferCreateSchema = z
  .object({
    fromWarehouseId: z.string().min(1, "Source warehouse is required"),
    toWarehouseId: z.string().min(1, "Destination warehouse is required"),
    lines: z
      .array(z.object({ itemId: z.string().min(1), qty: decStr.refine((v) => Number(v) > 0, "Quantity must be positive") }))
      .min(1, "Add at least one line"),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    message: "Source and destination must differ",
    path: ["toWarehouseId"],
  });
export type TransferCreatePayload = z.input<typeof transferCreateSchema>;

export const countCreateSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  notes: z.string().trim().optional().nullable(),
});
export type CountCreatePayload = z.input<typeof countCreateSchema>;

export const countEnterSchema = z.object({
  countId: z.string().min(1),
  lines: z.array(z.object({ lineId: z.string().min(1), countedQty: decStr })),
});
export type CountEnterPayload = z.input<typeof countEnterSchema>;
