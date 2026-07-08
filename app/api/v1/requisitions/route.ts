import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { v1List } from "../lib";

export const GET = v1List(({ take, skip }) =>
  db.purchaseRequisition
    .findMany({ take, skip, orderBy: { createdAt: "desc" }, include: { requester: { select: { name: true } }, department: { select: { code: true } }, costCenter: { select: { code: true } } } })
    .then((rows) =>
      rows.map((p) => ({
        id: p.id, prNumber: p.prNumber, requester: p.requester.name, department: p.department.code,
        costCenter: p.costCenter.code, purpose: p.purpose, status: p.status, source: p.source,
        totalEstimatedVnd: decToString(p.totalEstimatedVnd, 2), createdAt: p.createdAt,
      })),
    ),
);
