import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/**
 * Seed (spec §13). Grows per phase: Phase 1 seeds departments + the full set of demo login
 * accounts (all roles, password Humiley@2026, force-change on first login). Master data
 * (vendors/items/warehouses), reference data (incoterms/HS/CO), and the demo PR→…→payment
 * chain are added by their owning phases.
 */

const DEPARTMENTS = [
  { code: "ENG", nameEn: "Engineering", nameVn: "Kỹ thuật" },
  { code: "PRJ", nameEn: "Projects", nameVn: "Dự án" },
  { code: "MFG", nameEn: "Manufacturing", nameVn: "Sản xuất" },
  { code: "ADM", nameEn: "Admin-HR", nameVn: "Hành chính - Nhân sự" },
  { code: "FIN", nameEn: "Finance", nameVn: "Tài chính" },
] as const;

type SeedUser = {
  email: string;
  name: string;
  roles: Role[];
  dept: (typeof DEPARTMENTS)[number]["code"];
  isChief?: boolean;
  managesDept?: (typeof DEPARTMENTS)[number]["code"];
};

const USERS: SeedUser[] = [
  { email: "admin@humiley.com", name: "System Administrator", roles: ["ADMIN"], dept: "ADM" },
  { email: "director@humiley.com", name: "Managing Director", roles: ["DIRECTOR"], dept: "ADM" },
  {
    email: "mgr.eng@humiley.com",
    name: "Engineering Manager",
    roles: ["DEPT_MANAGER"],
    dept: "ENG",
    managesDept: "ENG",
  },
  {
    email: "mgr.prj@humiley.com",
    name: "Projects Manager",
    roles: ["DEPT_MANAGER"],
    dept: "PRJ",
    managesDept: "PRJ",
  },
  { email: "req.eng@humiley.com", name: "Nguyen Van Requester", roles: ["REQUESTER"], dept: "ENG" },
  { email: "req.mfg@humiley.com", name: "Tran Thi Requester", roles: ["REQUESTER"], dept: "MFG" },
  { email: "purchaser@humiley.com", name: "Le Van Purchaser", roles: ["PURCHASER"], dept: "ADM" },
  {
    email: "accountant@humiley.com",
    name: "Pham Thi Accountant",
    roles: ["ACCOUNTANT"],
    dept: "FIN",
    isChief: true,
  },
  { email: "warehouse@humiley.com", name: "Do Van Keeper", roles: ["WAREHOUSE"], dept: "ADM" },
];

async function main() {
  const passwordHash = await bcrypt.hash("Humiley@2026", 10);

  // Departments (no manager yet)
  const deptByCode = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const dept = await db.department.upsert({
      where: { code: d.code },
      update: { nameEn: d.nameEn, nameVn: d.nameVn },
      create: { code: d.code, nameEn: d.nameEn, nameVn: d.nameVn },
    });
    deptByCode.set(d.code, dept.id);
  }

  // Users
  const managerAssignments: Array<{ deptCode: string; userId: string }> = [];
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        roles: u.roles,
        departmentId: deptByCode.get(u.dept),
        isChief: u.isChief ?? false,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        roles: u.roles,
        departmentId: deptByCode.get(u.dept),
        isChief: u.isChief ?? false,
        mustChangePw: true,
      },
    });
    if (u.managesDept) managerAssignments.push({ deptCode: u.managesDept, userId: user.id });
  }

  // Assign department managers
  for (const a of managerAssignments) {
    await db.department.update({
      where: { code: a.deptCode },
      data: { managerId: a.userId },
    });
  }

  console.log(`Seeded ${DEPARTMENTS.length} departments, ${USERS.length} users.`);
  console.log("Login: any email above · password Humiley@2026 (force change on first login).");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
