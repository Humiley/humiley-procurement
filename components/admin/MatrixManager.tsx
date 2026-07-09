"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, UserCog } from "lucide-react";
import { addMatrixRow, deleteMatrixRow, reassignStep } from "@/app/(portal)/admin/governance.actions";

export type MatrixRow = { id: string; entityType: string; min: string; max: string | null; level: number; approverRole: string | null };
export type PendingStepRow = { id: string; entityType: string; refLabel: string; level: number; approver: string; approverId: string };
export type UserOpt = { id: string; label: string };

const ROLES = ["DEPT_MANAGER", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "WAREHOUSE", "ADMIN"];
const ENTITY_TYPES = ["PR", "PO", "VENDOR", "PAYMENT_REQUEST", "GOODS_ISSUE"];

/** §6 DoA matrix CRUD + §15 delegation of pending steps — ADMIN only. */
export function MatrixManager({ rows, pending, users }: { rows: MatrixRow[]; pending: PendingStepRow[]; users: UserOpt[] }) {
  const t = useTranslations("matrix");
  const fmtErr = useActionError();
  const ta = useTranslations("approvals.type");
  const tr = useTranslations("roles");
  const router = useRouter();
  const [entityType, setEntityType] = useState("PR");
  const [minA, setMinA] = useState("0");
  const [maxA, setMaxA] = useState("");
  const [level, setLevel] = useState("1");
  const [role, setRole] = useState("DEPT_MANAGER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reassign, setReassign] = useState<Record<string, string>>({});

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  const grouped = ENTITY_TYPES.map((et) => ({ et, list: rows.filter((r) => r.entityType === et) })).filter((g) => g.list.length);
  const field = "field";

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="rounded-xl border border-grey/20 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-grey">{t("addTitle")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-grey">{t("entityType")}</span>
            <select className={field} value={entityType} onChange={(e) => setEntityType(e.target.value)}>{ENTITY_TYPES.map((x) => <option key={x} value={x}>{ta(x)}</option>)}</select>
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-grey">{t("min")}</span>
            <input className={`${field} w-36 text-right`} value={minA} onChange={(e) => setMinA(e.target.value)} />
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-grey">{t("max")}</span>
            <input className={`${field} w-36 text-right`} placeholder={t("noMax")} value={maxA} onChange={(e) => setMaxA(e.target.value)} />
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-grey">{t("level")}</span>
            <input className={`${field} w-16 text-right`} value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-grey">{t("role")}</span>
            <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((x) => <option key={x} value={x}>{tr(x)}</option>)}</select>
          </label>
          <button type="button" disabled={busy} onClick={() => run(() => addMatrixRow({ entityType: entityType as never, minAmountVnd: minA.replace(/\D/g, "") || "0", maxAmountVnd: maxA.replace(/\D/g, "") || null, level, approverRole: role as never }))} className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {t("add")}
          </button>
        </div>
      </div>

      {grouped.map((g) => (
        <div key={g.et} className="rounded-xl border border-grey/20 bg-white p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{ta(g.et)}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="py-1.5">{t("band")}</th><th className="py-1.5">{t("level")}</th><th className="py-1.5">{t("role")}</th><th className="w-10 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {g.list.map((r) => (
                <tr key={r.id} className="border-t border-grey/10">
                  <td className="py-1.5 tabular-nums">{Number(r.min).toLocaleString("en-US")} – {r.max ? Number(r.max).toLocaleString("en-US") : "∞"} ₫</td>
                  <td className="py-1.5">L{r.level}</td>
                  <td className="py-1.5">{r.approverRole ? tr(r.approverRole) : "—"}</td>
                  <td className="py-1.5 text-right">
                    <button type="button" disabled={busy} onClick={() => run(() => deleteMatrixRow(r.id))} className="text-grey hover:text-danger" aria-label={t("delete")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="rounded-xl border border-grey/20 bg-white p-4">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-grey">
          <UserCog className="h-4 w-4" /> {t("delegationTitle")}
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-grey">{t("noPending")}</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">{ta(s.entityType)}</span>
                <span className="font-mono text-xs font-bold">{s.refLabel}</span>
                <span className="text-xs text-grey">L{s.level} · {s.approver}</span>
                <span className="flex-1" />
                <select className="field" value={reassign[s.id] ?? ""} onChange={(e) => setReassign({ ...reassign, [s.id]: e.target.value })}>
                  <option value="">{t("pickUser")}</option>
                  {users.filter((u) => u.id !== s.approverId).map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
                <button type="button" disabled={busy || !reassign[s.id]} onClick={() => run(() => reassignStep({ stepId: s.id, newApproverId: reassign[s.id] }))} className="rounded-lg border border-navy/30 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
                  {t("reassign")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
