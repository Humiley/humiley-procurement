"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { SignatureDialog } from "@/components/shared/SignatureDialog";
import { confirmVendorBank } from "@/app/(portal)/vendors/actions";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";

export type FrozenVendorRow = { id: string; code: string; nameEn: string; bankName: string | null; bankAccount: string | null; changedBy: string | null };

/** §15 vendor bank-change dual control — a DIRECTOR signs the call-back confirmation (or rejects → revert). */
export function BankConfirmPanel({ rows, canConfirm }: { rows: FrozenVendorRow[]; canConfirm: boolean }) {
  const t = useTranslations("bankctl");
  const tc = useTranslations("common");
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; approve: boolean } | null>(null);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-danger">
        <ShieldAlert className="h-4 w-4" /> {t("title")}
      </h3>
      <p className="mb-3 text-xs text-grey">{t("hint")}</p>
      <ul className="space-y-2">
        {rows.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{v.code} · {v.nameEn}</span>
            <span className="font-mono text-xs">{v.bankName ?? "—"} / {v.bankAccount ?? "—"}</span>
            {v.changedBy ? <span className="text-xs text-grey">{t("changedBy", { name: v.changedBy })}</span> : null}
            <span className="flex-1" />
            {canConfirm ? (
              <>
                <button type="button" onClick={() => setTarget({ id: v.id, approve: true })} className="btn-approve">
                  {t("confirm")}
                </button>
                <button type="button" onClick={() => setTarget({ id: v.id, approve: false })} className="btn-reject">
                  {t("reject")}
                </button>
              </>
            ) : (
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{t("awaiting")}</span>
            )}
          </li>
        ))}
      </ul>

      <SignatureDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.approve ? t("signConfirmTitle") : t("signRejectTitle")}
        meanings={[target?.approve ? "APPROVED" : "REJECTED"]}
        meaningLabel={() => (target?.approve ? t("meaningConfirm") : t("meaningReject"))}
        submitLabel={target?.approve ? t("confirm") : t("reject")}
        requireReason={!target?.approve}
        context={(() => { const v = rows.find((r) => r.id === target?.id); return v ? `${v.code} · ${v.nameEn} — ${v.bankName ?? "—"} / ${v.bankAccount ?? "—"}` : undefined; })()}
        onConfirm={async (p) => {
          act(await confirmVendorBank({ vendorId: target!.id, approve: target!.approve, password: p.password, comment: p.reason }));
          setTarget(null);
          toast(tc("done"));
          router.refresh();
        }}
      />
    </div>
  );
}
