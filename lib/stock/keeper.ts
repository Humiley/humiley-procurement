import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";

/**
 * §10b warehouse scoping: WAREHOUSE users act only on their own warehouse
 * (Warehouse.keeperId). Warehouses without a keeper are open to any WAREHOUSE
 * user; ADMIN is always allowed. PURCHASER/DIRECTOR read-only views are unaffected.
 */
export async function assertWarehouseKeeper(user: SessionUser, warehouseId: string) {
  if (user.roles.includes("ADMIN")) return;
  const wh = await db.warehouse.findUnique({ where: { id: warehouseId }, select: { keeperId: true, code: true } });
  if (!wh) throw new Error("Warehouse not found.");
  if (wh.keeperId && wh.keeperId !== user.id) {
    throw new Error(`Warehouse ${wh.code} is assigned to another keeper (§10b warehouse scoping).`);
  }
}
