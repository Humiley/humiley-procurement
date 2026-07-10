"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useTranslations } from "next-intl";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { verifyAllChains, type IntegrityResult } from "@/app/(portal)/admin/governance.actions";
import { act } from "@/lib/act";

/** §19 tamper-evidence: re-compute every signature chain on demand. */
export function IntegrityPanel() {
  const t = useTranslations("integrity");
  const fmtErr = useActionError();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      setResult(act(await verifyAllChains()));
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="label">{t("title")}</h3>
      <p className="mb-3 text-sm text-grey">{t("hint")}</p>
      <button type="button" disabled={busy} onClick={run} className="btn-primary">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {t("run")}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {result ? (
        result.broken.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald/10 px-3 py-2 text-sm font-semibold text-emerald">
            <ShieldCheck className="h-4 w-4" /> {t("ok", { chains: result.chains, signatures: result.signatures })}
          </p>
        ) : (
          <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <p className="flex items-center gap-2 font-semibold"><ShieldX className="h-4 w-4" /> {t("broken", { count: result.broken.length })}</p>
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {result.broken.map((b) => (
                <li key={b.brokenAt}>{b.entityType} · {b.entityId} · sig {b.brokenAt}</li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
