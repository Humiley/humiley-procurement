import { db } from "@/lib/db";
import { v1List } from "../lib";

export const GET = v1List(({ take, skip }) =>
  db.vendor
    .findMany({ take, skip, orderBy: { code: "asc" } })
    .then((rows) =>
      rows.map((v) => ({
        id: v.id, code: v.code, nameEn: v.nameEn, nameVn: v.nameVn, taxCode: v.taxCode,
        status: v.status, paymentTermDays: v.paymentTermDays, bankName: v.bankName,
        bankAccount: v.bankAccount, bankChangeFreeze: v.bankChangeFreeze, categories: v.categories,
      })),
    ),
);
