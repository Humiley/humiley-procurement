"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Pencil, X, Loader2 } from "lucide-react";
import { DocListPage, type ListColumn } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VndDisplay } from "@/components/shared/VndDisplay";
import { humanizeStatus } from "@/lib/status";

export type FieldType = "text" | "textarea" | "number" | "checkbox" | "select";

/**
 * Serializable column spec (no functions — safe to pass from a Server Component). The client
 * builds the actual render closures from `kind`.
 */
export type MdColumnSpec = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  kind?: "text" | "money" | "status" | "bool" | "flag";
  boolTrue?: string; // label for true (bool/flag)
  boolFalse?: string; // label for false (bool/flag)
};

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  lockOnEdit?: boolean; // e.g. immutable code
  placeholder?: string;
  help?: string;
};

export type MdRow = Record<string, unknown> & { id: string };

type FormValues = Record<string, string | boolean>;

/**
 * Generic master-data CRUD (list + modal form) — one component reused by every master-data
 * entity (departments/cost centers/categories/UoM/items/vendors) via a field config. Mutations
 * run through the entity's own Zod + RBAC + audited Server Actions passed as props.
 */
export function MasterDataManager({
  title,
  subtitle,
  newLabel,
  fields,
  rows,
  columns,
  createAction,
  updateAction,
  exportFileName,
  searchPlaceholder,
  extraToolbar,
}: {
  title: string;
  subtitle?: string;
  newLabel: string;
  fields: FieldDef[];
  rows: MdRow[];
  columns: MdColumnSpec[];
  createAction: (values: FormValues) => Promise<unknown>;
  updateAction: (id: string, values: FormValues) => Promise<unknown>;
  exportFileName?: string;
  searchPlaceholder?: string;
  extraToolbar?: React.ReactNode;
}) {
  const t = useTranslations("common");
  const st = useTranslations("status");
  const [editing, setEditing] = useState<MdRow | null>(null);
  const [creating, setCreating] = useState(false);

  const statusLabel = (v: string) => (st.has(v) ? st(v) : humanizeStatus(v));

  const dataColumns: ListColumn<MdRow>[] = columns.map((c) => {
    const base: ListColumn<MdRow> = {
      key: c.key,
      header: c.header,
      align: c.align,
      sortable: c.sortable,
    };
    switch (c.kind) {
      case "money":
        return {
          ...base,
          align: c.align ?? "right",
          value: (r) => Number(r[c.key]) || 0,
          render: (r) => <VndDisplay value={(r[c.key] as string) || null} />,
        };
      case "status":
        return {
          ...base,
          value: (r) => String(r[c.key] ?? ""),
          render: (r) => (
            <StatusBadge status={String(r[c.key])} label={statusLabel(String(r[c.key]))} />
          ),
        };
      case "bool":
        return {
          ...base,
          align: c.align ?? "center",
          value: (r) => (r[c.key] ? "1" : "0"),
          render: (r) => (
            <StatusBadge
              status={r[c.key] ? "ACTIVE" : "INACTIVE"}
              label={r[c.key] ? (c.boolTrue ?? t("yes")) : (c.boolFalse ?? t("no"))}
            />
          ),
        };
      case "flag":
        return {
          ...base,
          align: c.align ?? "center",
          value: (r) => (r[c.key] ? "1" : "0"),
          render: (r) =>
            r[c.key] ? (
              <StatusBadge status="APPROVED" label={c.boolTrue ?? t("yes")} />
            ) : (
              <span className="text-grey">{c.boolFalse ?? "—"}</span>
            ),
        };
      default:
        return base;
    }
  });

  const allColumns: ListColumn<MdRow>[] = [
    ...dataColumns,
    {
      key: "__actions",
      header: t("actions"),
      align: "right",
      render: (row) => (
        <button className="btn-ghost" onClick={() => setEditing(row)}>
          <Pencil className="h-4 w-4" /> {t("edit")}
        </button>
      ),
    },
  ];

  return (
    <>
      <DocListPage
        title={title}
        subtitle={subtitle}
        columns={allColumns}
        rows={rows}
        rowKey={(r) => r.id}
        exportLabel={t("export")}
        exportFileName={exportFileName}
        searchPlaceholder={searchPlaceholder ?? t("search")}
        toolbar={
          <>
            {extraToolbar}
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> {newLabel}
            </button>
          </>
        }
      />
      {(creating || editing) && (
        <FormModal
          title={editing ? `${t("edit")} · ${title}` : newLabel}
          fields={fields}
          row={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          createAction={createAction}
          updateAction={updateAction}
        />
      )}
    </>
  );
}

function initialValues(fields: FieldDef[], row: MdRow | null): FormValues {
  const v: FormValues = {};
  for (const f of fields) {
    const raw = row?.[f.key];
    if (f.type === "checkbox") v[f.key] = Boolean(raw);
    else v[f.key] = raw == null ? "" : String(raw);
  }
  return v;
}

function FormModal({
  title,
  fields,
  row,
  onClose,
  createAction,
  updateAction,
}: {
  title: string;
  fields: FieldDef[];
  row: MdRow | null;
  onClose: () => void;
  createAction: (values: FormValues) => Promise<unknown>;
  updateAction: (id: string, values: FormValues) => Promise<unknown>;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const isEdit = !!row;
  const fmtErr = useActionError();
  const [values, setValues] = useState<FormValues>(() => initialValues(fields, row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, val: string | boolean) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (isEdit && row) await updateAction(row.id, values);
      else await createAction(values);
      router.refresh();
      onClose();
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-body/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((f) => {
            const disabled = isEdit && f.lockOnEdit;
            if (f.type === "checkbox") {
              return (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              );
            }
            return (
              <div key={f.key}>
                <label className="label">
                  {f.label}
                  {f.required && <span className="text-danger"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    className="field min-h-[64px]"
                    value={String(values[f.key] ?? "")}
                    placeholder={f.placeholder}
                    disabled={disabled}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <select
                    className="field"
                    value={String(values[f.key] ?? "")}
                    disabled={disabled}
                    onChange={(e) => set(f.key, e.target.value)}
                  >
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field disabled:bg-panel disabled:text-grey"
                    type={f.type === "number" ? "number" : "text"}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    value={String(values[f.key] ?? "")}
                    placeholder={f.placeholder}
                    disabled={disabled}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.help && <p className="mt-1 text-xs text-grey">{f.help}</p>}
              </div>
            );
          })}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
