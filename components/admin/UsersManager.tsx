"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus, KeyRound, X, Loader2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { DocListPage, type ListColumn } from "@/components/shared/DocListPage";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ROLE_VALUES } from "@/lib/schemas/user";
import { createUser, updateUser, resetUserPassword } from "@/app/(portal)/admin/users/actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  departmentId: string | null;
  departmentName: string | null;
  isChief: boolean;
  isActive: boolean;
};
export type DeptOption = { id: string; label: string };

export function UsersManager({
  users,
  departments,
}: {
  users: UserRow[];
  departments: DeptOption[];
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: ListColumn<UserRow>[] = [
    {
      key: "name",
      header: t("admin.users.name"),
      value: (u) => u.name,
      render: (u) => (
        <div>
          <div className="font-medium text-body">{u.name}</div>
          <div className="text-xs text-grey">{u.email}</div>
        </div>
      ),
    },
    {
      key: "roles",
      header: t("admin.users.roles"),
      value: (u) => u.roles.join(", "),
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <span
              key={r}
              className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy"
            >
              {t(`roles.${r}`)}
            </span>
          ))}
          {u.isChief && (
            <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-xs font-medium text-emerald">
              {t("admin.users.isChief")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "department",
      header: t("admin.users.department"),
      value: (u) => u.departmentName ?? "",
      render: (u) => u.departmentName ?? <span className="text-grey">—</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      value: (u) => (u.isActive ? "ACTIVE" : "INACTIVE"),
      render: (u) => (
        <StatusBadge
          status={u.isActive ? "ACTIVE" : "INACTIVE"}
          label={u.isActive ? t("status.ACTIVE") : t("status.INACTIVE")}
        />
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (u) => (
        <button className="btn-ghost" onClick={() => setEditing(u)}>
          <Pencil className="h-4 w-4" /> {t("common.edit")}
        </button>
      ),
    },
  ];

  return (
    <>
      <DocListPage
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitle")}
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        searchPlaceholder={t("common.search")}
        exportLabel={t("common.export")}
        exportFileName="users"
        toolbar={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> {t("admin.users.new")}
          </button>
        }
      />

      {(creating || editing) && (
        <UserFormModal
          departments={departments}
          user={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function UserFormModal({
  departments,
  user,
  onClose,
}: {
  departments: DeptOption[];
  user: UserRow | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = !!user;

  const fmtErr = useActionError();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? ["REQUESTER"]);
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? "");
  const [isChief, setIsChief] = useState(user?.isChief ?? false);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(r: Role) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (isEdit && user) {
        await updateUser(user.id, {
          name,
          roles,
          departmentId: departmentId || null,
          isChief,
          isActive,
        });
      } else {
        await createUser({
          name,
          email,
          roles,
          departmentId: departmentId || null,
          isChief,
          isActive,
        });
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  async function reset() {
    if (!user) return;
    setBusy(true);
    try {
      await resetUserPassword(user.id);
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
          <h2 className="text-base font-semibold text-navy">
            {isEdit ? t("admin.users.edit") : t("admin.users.new")}
          </h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t("admin.users.name")}</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("admin.users.email")}</label>
            <input
              className="field disabled:bg-panel disabled:text-grey"
              type="email"
              value={email}
              disabled={isEdit}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("admin.users.roles")}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLE_VALUES.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 rounded-md border border-grey/20 px-2 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(r)}
                    onChange={() => toggleRole(r)}
                  />
                  {t(`roles.${r}`)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t("admin.users.department")}</label>
            <select
              className="field"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isChief} onChange={(e) => setIsChief(e.target.checked)} />
              {t("admin.users.isChief")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t("admin.users.active")}
            </label>
          </div>

          {!isEdit && (
            <p className="rounded-md bg-panel px-3 py-2 text-xs text-grey">
              {t("admin.users.defaultPassword")}
            </p>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {isEdit ? (
            <button className="btn-outline" onClick={reset} disabled={busy}>
              <KeyRound className="h-4 w-4" /> {t("admin.users.resetPassword")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-outline" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
