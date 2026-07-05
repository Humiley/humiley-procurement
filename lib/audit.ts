import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Append an immutable audit record (spec §22.6: every mutation is audited). Pass the
 * transaction client when auditing inside a `$transaction` so the log commits atomically.
 */
export async function audit(
  params: {
    userId?: string | null;
    action: string; // e.g. "PR_CREATE", "PO_APPROVE"
    entityType: string; // e.g. "PurchaseRequisition"
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
  client: Client = db,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeJson:
        params.before === undefined ? Prisma.JsonNull : (params.before as Prisma.InputJsonValue),
      afterJson:
        params.after === undefined ? Prisma.JsonNull : (params.after as Prisma.InputJsonValue),
    },
  });
}
