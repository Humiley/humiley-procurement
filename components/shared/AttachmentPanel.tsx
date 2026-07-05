import { Paperclip, Download } from "lucide-react";
import { cn } from "@/lib/cn";

export type AttachmentItem = {
  id: string;
  filename: string;
  url?: string;
  sizeLabel?: string;
  uploadedByName?: string;
  uploadedAt?: string;
};

/**
 * Attachment list (spec §22.3). Read display here in the foundation; the upload Server Action
 * + storage adapter (lib/storage) are wired per-module from Phase 3. Pass `slot` for an
 * uploader control when a module provides one.
 */
export function AttachmentPanel({
  attachments,
  emptyLabel = "No attachments.",
  slot,
  className,
}: {
  attachments: AttachmentItem[];
  emptyLabel?: string;
  slot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {attachments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-grey">
          <Paperclip className="h-4 w-4" /> {emptyLabel}
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-card border border-black/5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-grey" />
                <span className="truncate text-body">{a.filename}</span>
                {a.sizeLabel && <span className="shrink-0 text-xs text-grey">{a.sizeLabel}</span>}
              </span>
              {a.url && (
                <a
                  href={a.url}
                  className="btn-ghost shrink-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {slot}
    </div>
  );
}
