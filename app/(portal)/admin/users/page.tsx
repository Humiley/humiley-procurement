import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { UsersManager, type UserRow, type DeptOption } from "@/components/admin/UsersManager";

export default async function AdminUsersPage() {
  await requireRoles("ADMIN");

  const [users, departments] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      include: { department: { select: { code: true, nameEn: true } } },
    }),
    db.department.findMany({ orderBy: { code: "asc" } }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    departmentId: u.departmentId,
    departmentName: u.department ? `${u.department.code} · ${u.department.nameEn}` : null,
    isChief: u.isChief,
    isActive: u.isActive,
  }));

  const deptOptions: DeptOption[] = departments.map((d) => ({
    id: d.id,
    label: `${d.code} · ${d.nameEn}`,
  }));

  return <UsersManager users={rows} departments={deptOptions} />;
}
