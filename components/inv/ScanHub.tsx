"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ScanLine, Camera, Loader2 } from "lucide-react";
import { scanLookup, type ScanResult } from "@/app/(portal)/scan/actions";

/**
 * §21 scan hub — mobile-first. A keyboard-wedge scanner types the code and sends Enter;
 * phones can use the camera when the browser exposes BarcodeDetector. Documents open
 * directly; lots/items show stock + history with a trace link.
 */
export function ScanHub() {
  const t = useTranslations("scan");
  const ti = useTranslations("inventory.type");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [camera, setCamera] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    setCameraSupported("BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  async function lookup(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    try {
      const hit = await scanLookup(value);
      if (hit.kind === "document") {
        router.push(hit.href);
        return;
      }
      setResult(hit);
    } finally {
      setBusy(false);
      setCode("");
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code", "code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              setCamera(false);
              await lookup(codes[0].rawValue);
            }
          } catch {
            /* frame not ready */
          }
        }, 400);
      } catch {
        setCamera(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-bold text-navy">
        <ScanLine className="h-5 w-5" /> {t("title")}
      </h1>
      <p className="text-sm text-grey">{t("hint")}</p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
      >
        <input
          ref={inputRef}
          className="field w-full text-lg"
          placeholder={t("placeholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("lookup")}
        </button>
        {cameraSupported ? (
          <button type="button" onClick={() => setCamera(!camera)} className="rounded-lg border border-navy/30 px-3 py-2 text-navy hover:bg-navy/5" aria-label={t("camera")}>
            <Camera className="h-5 w-5" />
          </button>
        ) : null}
      </form>

      {camera ? (
        <video ref={videoRef} className="w-full rounded-xl border border-grey/20" muted playsInline />
      ) : null}

      {result?.kind === "notFound" ? (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
          {t("notFound", { code: result.code })}
        </p>
      ) : null}

      {result?.kind === "lot" ? (
        <div className="space-y-3 rounded-xl border border-grey/20 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-navy/10 px-2 py-0.5 font-mono text-sm font-bold text-navy">{result.label}</span>
            <span className="text-sm">{result.item}</span>
            {result.expiryDate ? <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">EXP {result.expiryDate}</span> : null}
            <span className="flex-1" />
            <Link href={`/trace/${result.lotId}`} className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              {t("trace")} →
            </Link>
          </div>
          <p className="text-xs text-grey">
            {result.grn ? `${result.grn} · ` : ""}{result.po ? `${result.po} · ` : ""}{result.vendor ?? ""}
          </p>
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-grey">{t("onHand")}</h3>
            {result.balances.length === 0 ? (
              <p className="text-sm text-grey">{t("noStock")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {result.balances.map((b) => (
                  <li key={b.warehouse} className="flex justify-between"><span className="font-semibold">{b.warehouse}</span><span className="tabular-nums">{Number(b.onHand).toLocaleString("en-US")}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-grey">{t("recentMovements")}</h3>
            <ul className="space-y-1 font-mono text-xs">
              {result.movements.map((m) => (
                <li key={m.number}>{m.number} · {ti(m.type)} · {Number(m.qty).toLocaleString("en-US")} · {m.when} · {m.ref}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {result?.kind === "item" ? (
        <div className="space-y-3 rounded-xl border border-grey/20 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-navy">{result.label}</span>
            {result.isLotTracked ? <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald">{t("lotTracked")}</span> : null}
          </div>
          {result.balances.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-grey">{t("onHand")}</h3>
              <ul className="space-y-1 text-sm">
                {result.balances.map((b) => (
                  <li key={b.warehouseId} className="flex justify-between">
                    <span className="font-semibold">{b.warehouse}</span>
                    <span className="tabular-nums">{Number(b.onHand).toLocaleString("en-US")} @ {Number(b.avgCost).toLocaleString("en-US")} ₫</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.lots.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-grey">{t("lots")}</h3>
              <ul className="space-y-1 text-sm">
                {result.lots.map((l) => (
                  <li key={l.lotId} className="flex items-center justify-between">
                    <Link href={`/trace/${l.lotId}`} className="font-mono text-xs font-bold text-navy hover:underline">{l.lotNumber}</Link>
                    {l.expiryDate ? <span className="text-xs text-warning">EXP {l.expiryDate}</span> : <span className="text-xs text-grey">—</span>}
                    <span className="tabular-nums">{Number(l.onHand).toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.balances.length === 0 && result.lots.length === 0 ? <p className="text-sm text-grey">{t("noStock")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
