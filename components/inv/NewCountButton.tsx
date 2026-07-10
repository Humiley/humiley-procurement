"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createCount } from "@/app/(portal)/inventory/counts/actions";
import { act } from "@/lib/act";

/** Pick a warehouse → snapshot a new count sheet. */
export function NewCountButton({ warehouses }: { warehouses: { id: string; label: string }[] }) {
  const t = useTranslations("cnt");
  const fmtErr = useActionError();
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const res = act(await createCount({ warehouseId }));
      router.push(`/inventory/counts/${res.id}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <select className="field" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>{w.label}</option>
        ))}
      </select>
      <button type="button" disabled={busy} onClick={create} className="btn-primary">
        {busy ? "…" : t("newButton")}
      </button>
    </div>
  );
}
