import { db } from "@/lib/db";
import { v1List } from "../lib";

export const GET = v1List(({ take, skip }) =>
  db.vendor
    .findMany({ take, skip, orderBy: { code: "asc" } })
    .then((rows) =>
      // Bank details (bankName/bankAccount/bankChangeFreeze) are DELIBERATELY omitted: /api/v1 keys
      // carry no scope/role, so any active key would otherwise read every vendor's bank account —
      // more than any human role can see in the UI (finance roles only). Add a scoped-key model
      // before exposing them here.
      rows.map((v) => ({
        id: v.id, code: v.code, nameEn: v.nameEn, nameVn: v.nameVn, taxCode: v.taxCode,
        status: v.status, paymentTermDays: v.paymentTermDays, categories: v.categories,
      })),
    ),
);
