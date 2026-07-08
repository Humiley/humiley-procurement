"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { deleteAttachment } from "@/app/(portal)/attachments.actions";

export type PrAttachment = {
  id: string;
  fileName: string;
  sizeLabel: string;
  canDelete: boolean;
};

export function PrAttachments({
  entityId,
  attachments,
  canUpload,
}: {
  entityId: string;
  attachments: PrAttachment[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", "PurchaseRequisition");
      fd.append("entityId", entityId);
      const res = await fetch("/api/v1/attachments", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteAttachment(id, `/requisitions/${entityId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-grey">
          <Paperclip className="h-4 w-4" /> No attachments.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-card border border-black/5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-grey" />
                <span className="truncate text-body">{a.fileName}</span>
                <span className="shrink-0 text-xs text-grey">{a.sizeLabel}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/v1/attachments/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  <Download className="h-4 w-4" />
                </a>
                {a.canDelete && (
                  <button className="btn-ghost text-danger" onClick={() => remove(a.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div>
          <button className="btn-outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Add attachment
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={onFile} />
        </div>
      )}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
