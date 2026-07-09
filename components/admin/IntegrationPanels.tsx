"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Plus, Power, Webhook, Trash2, Radio } from "lucide-react";
import { createApiKey, deactivateApiKey, createWebhook, deleteWebhook, testWebhook } from "@/app/(portal)/admin/integration.actions";
import { act } from "@/lib/act";

export type ApiKeyRow = { id: string; name: string; prefix: string; isActive: boolean; lastUsedAt: string | null };
export type WebhookRow = { id: string; url: string; events: string[]; hasSecret: boolean };

const EVENTS = ["po.approved", "invoice.matched", "payment.paid", "stock.belowMin"];

/** §17 integration console — API keys (token shown once) + outbound webhooks with test ping. */
export function IntegrationPanels({ keys, hooks }: { keys: ApiKeyRow[]; hooks: WebhookRow[] }) {
  const t = useTranslations("integration");
  const tcm = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [keyName, setKeyName] = useState("");
  const [minted, setMinted] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>(["payment.paid"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      act(await fn());
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="rounded-xl border border-grey/20 bg-white p-4">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-grey">
          <KeyRound className="h-4 w-4" /> {t("keysTitle")}
        </h3>
        <p className="mb-3 text-xs text-grey">{t("keysHint")}</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="field w-64" placeholder={t("keyNamePh")} value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          <button
            type="button"
            disabled={busy || !keyName.trim()}
            onClick={() =>
              run(async () => {
                const res = act(await createApiKey(keyName));
                setMinted(res.token);
                setKeyName("");
              })
            }
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t("mint")}
          </button>
        </div>
        {minted ? (
          <p className="mb-3 rounded-lg bg-emerald/10 px-3 py-2 font-mono text-xs">
            <b className="mr-2 font-sans text-emerald">{t("copyOnce")}</b>{minted}
          </p>
        ) : null}
        {keys.length === 0 ? (
          <p className="text-sm text-grey">{t("noKeys")}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{k.name}</span>
                <span className="font-mono text-xs text-grey">{k.prefix}…</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${k.isActive ? "bg-emerald/10 text-emerald" : "bg-grey/15 text-grey"}`}>
                  {k.isActive ? t("active") : t("inactive")}
                </span>
                <span className="text-xs text-grey">{k.lastUsedAt ? t("lastUsed", { when: k.lastUsedAt }) : t("neverUsed")}</span>
                <span className="flex-1" />
                {k.isActive ? (
                  <button type="button" disabled={busy} onClick={() => { if (!window.confirm(tcm("confirmIrreversible"))) return; run(() => deactivateApiKey(k.id)); }} className="flex items-center gap-1 rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/5">
                    <Power className="h-3.5 w-3.5" /> {t("deactivate")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-grey">
          {t("openapiHint")} <a href="/api/v1/openapi" className="font-mono text-navy hover:underline">/api/v1/openapi</a>
        </p>
      </div>

      <div className="rounded-xl border border-grey/20 bg-white p-4">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-grey">
          <Webhook className="h-4 w-4" /> {t("hooksTitle")}
        </h3>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-grey">URL</span>
            <input className="field w-72" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-grey">{t("secret")}</span>
            <input className="field w-40" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2 pb-1">
            {EVENTS.map((ev) => (
              <label key={ev} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={events.includes(ev)}
                  onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))}
                />
                <span className="font-mono">{ev}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !url}
            onClick={() => run(() => createWebhook({ url, events: events as never, secret: secret || null }))}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t("addHook")}
          </button>
        </div>
        {testResult ? <p className="mb-2 rounded-lg bg-emerald/10 px-3 py-1.5 text-xs text-emerald">{testResult}</p> : null}
        {hooks.length === 0 ? (
          <p className="text-sm text-grey">{t("noHooks")}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs">{h.url}</span>
                {h.events.map((ev) => (
                  <span key={ev} className="rounded bg-navy/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy">{ev}</span>
                ))}
                {h.hasSecret ? <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald">HMAC</span> : null}
                <span className="flex-1" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      act(await testWebhook(h.id));
                      setTestResult(t("pinged", { url: h.url }));
                    })
                  }
                  className="flex items-center gap-1 rounded-lg border border-navy/30 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/5"
                >
                  <Radio className="h-3.5 w-3.5" /> {t("test")}
                </button>
                <button type="button" disabled={busy} onClick={() => { if (!window.confirm(tcm("confirmIrreversible"))) return; run(() => deleteWebhook(h.id)); }} className="text-grey hover:text-danger" aria-label={t("delete")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
