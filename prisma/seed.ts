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

  await seedMasterData(deptByCode);

  console.log(`Seeded ${DEPARTMENTS.length} departments, ${USERS.length} users.`);
  console.log("Login: any email above · password Humiley@2026 (force change on first login).");
}

// ---- Phase 2: master data ----------------------------------------------------
const UOMS = [
  { code: "PCS", nameEn: "Piece", nameVn: "Cái" },
  { code: "SET", nameEn: "Set", nameVn: "Bộ" },
  { code: "M", nameEn: "Meter", nameVn: "Mét" },
  { code: "KG", nameEn: "Kilogram", nameVn: "Kilôgam" },
  { code: "L", nameEn: "Liter", nameVn: "Lít" },
  { code: "BOX", nameEn: "Box", nameVn: "Hộp" },
  { code: "ROLL", nameEn: "Roll", nameVn: "Cuộn" },
  { code: "UNIT", nameEn: "Unit", nameVn: "Đơn vị" },
] as const;

const CATEGORIES = [
  { code: "HVAC", nameEn: "HVAC Equipment", nameVn: "Thiết bị HVAC", isCapex: false },
  { code: "ELEC", nameEn: "Electrical", nameVn: "Điện", isCapex: false },
  { code: "CONS", nameEn: "Consumables", nameVn: "Vật tư tiêu hao", isCapex: false },
  { code: "CAPX", nameEn: "Capital Equipment", nameVn: "Thiết bị đầu tư", isCapex: true },
  { code: "SERV", nameEn: "Services", nameVn: "Dịch vụ", isCapex: false },
] as const;

const COST_CENTERS = [
  { code: "CC-ENG", nameEn: "Engineering Operations", nameVn: "Vận hành Kỹ thuật", dept: "ENG" },
  { code: "CC-PRJ", nameEn: "Project Delivery", nameVn: "Triển khai Dự án", dept: "PRJ" },
  { code: "CC-MFG", nameEn: "Production Line", nameVn: "Dây chuyền Sản xuất", dept: "MFG" },
  { code: "CC-ADM", nameEn: "Administration", nameVn: "Hành chính", dept: "ADM" },
  { code: "CC-FIN", nameEn: "Finance Operations", nameVn: "Vận hành Tài chính", dept: "FIN" },
] as const;

type SeedItem = {
  code: string;
  nameEn: string;
  nameVn: string;
  cat: string;
  uom: string;
  price: number;
  lot?: boolean;
};
const ITEMS: SeedItem[] = [
  { code: "HVAC-AHU-05", nameEn: "Air Handling Unit 5,000 m³/h", nameVn: "Bộ xử lý không khí 5.000 m³/h", cat: "HVAC", uom: "SET", price: 185000000 },
  { code: "HVAC-FCU-02", nameEn: "Fan Coil Unit 2HP", nameVn: "Dàn lạnh FCU 2HP", cat: "HVAC", uom: "SET", price: 12500000 },
  { code: "HVAC-HEPA-14", nameEn: "HEPA Filter H14 610×610", nameVn: "Lọc HEPA H14 610×610", cat: "HVAC", uom: "PCS", price: 2800000, lot: true },
  { code: "HVAC-DUCT-GI", nameEn: "GI Duct 1.0mm", nameVn: "Ống gió tôn kẽm 1.0mm", cat: "HVAC", uom: "M", price: 420000 },
  { code: "HVAC-DMPR-30", nameEn: "Volume Damper 300mm", nameVn: "Van gió 300mm", cat: "HVAC", uom: "PCS", price: 950000 },
  { code: "HVAC-VFD-15", nameEn: "VFD 15kW", nameVn: "Biến tần 15kW", cat: "HVAC", uom: "PCS", price: 18500000 },
  { code: "ELEC-CBL-25", nameEn: "Power Cable Cu 4×25mm²", nameVn: "Cáp điện Cu 4×25mm²", cat: "ELEC", uom: "M", price: 385000 },
  { code: "ELEC-MCB-32", nameEn: "MCB 32A 3P", nameVn: "Aptomat MCB 32A 3P", cat: "ELEC", uom: "PCS", price: 640000 },
  { code: "ELEC-CONT-40", nameEn: "Contactor 40A", nameVn: "Khởi động từ 40A", cat: "ELEC", uom: "PCS", price: 1150000 },
  { code: "ELEC-LED-40", nameEn: "LED Panel 40W", nameVn: "Đèn LED panel 40W", cat: "ELEC", uom: "PCS", price: 320000 },
  { code: "ELEC-SW-2G", nameEn: "2-Gang Switch", nameVn: "Công tắc 2 nút", cat: "ELEC", uom: "PCS", price: 85000 },
  { code: "ELEC-SOCK-32", nameEn: "Industrial Socket 32A", nameVn: "Ổ cắm công nghiệp 32A", cat: "ELEC", uom: "PCS", price: 210000 },
  { code: "CONS-GLOVE-M", nameEn: "Nitrile Gloves (M)", nameVn: "Găng tay nitrile (M)", cat: "CONS", uom: "BOX", price: 145000 },
  { code: "CONS-WIPE-99", nameEn: "Cleanroom Wipes 9×9", nameVn: "Khăn phòng sạch 9×9", cat: "CONS", uom: "BOX", price: 260000, lot: true },
  { code: "CONS-TAPE-AL", nameEn: "Aluminium Foil Tape", nameVn: "Băng keo nhôm", cat: "CONS", uom: "ROLL", price: 75000 },
  { code: "CONS-SEAL-SI", nameEn: "Silicone Sealant", nameVn: "Keo silicone", cat: "CONS", uom: "PCS", price: 95000, lot: true },
  { code: "CONS-BOLT-M8", nameEn: "M8 Bolt Set", nameVn: "Bộ bu-lông M8", cat: "CONS", uom: "SET", price: 55000 },
  { code: "CONS-FILT-G4", nameEn: "Pre-Filter G4", nameVn: "Lọc thô G4", cat: "CONS", uom: "PCS", price: 480000 },
  { code: "CAPX-CHILL-100", nameEn: "Air-Cooled Chiller 100RT", nameVn: "Chiller giải nhiệt gió 100RT", cat: "CAPX", uom: "UNIT", price: 1450000000 },
  { code: "SERV-INSTALL", nameEn: "Installation Service", nameVn: "Dịch vụ lắp đặt", cat: "SERV", uom: "UNIT", price: 25000000 },
];

const VENDORS = [
  {
    code: "V-CLEAN01",
    nameEn: "CleanAir Panels Co., Ltd",
    nameVn: "Công ty TNHH Tấm panel CleanAir",
    taxCode: "0312345678",
    contactName: "Mr. Hoang",
    contactEmail: "sales@cleanair.vn",
    contactPhone: "+84 28 3822 1100",
    bankName: "Vietcombank",
    bankAccount: "007100112233",
    paymentTermDays: 30,
    categories: ["HVAC", "CONS"],
  },
  {
    code: "V-ELEC01",
    nameEn: "PowerLine Electrical Distribution",
    nameVn: "Phân phối Điện PowerLine",
    taxCode: "0398765432",
    contactName: "Ms. Lan",
    contactEmail: "order@powerline.vn",
    contactPhone: "+84 28 3910 4455",
    bankName: "ACB",
    bankAccount: "199220334455",
    paymentTermDays: 45,
    categories: ["ELEC"],
  },
  {
    code: "V-FRT01",
    nameEn: "SwiftFreight Forwarding JSC",
    nameVn: "CP Giao nhận SwiftFreight",
    taxCode: "0301122334",
    contactName: "Mr. Bao",
    contactEmail: "ops@swiftfreight.vn",
    contactPhone: "+84 28 3744 8899",
    bankName: "Techcombank",
    bankAccount: "190455667788",
    paymentTermDays: 15,
    categories: ["SERV"],
  },
] as const;

async function seedMasterData(deptByCode: Map<string, string>) {
  // UoM
  const uomByCode = new Map<string, string>();
  for (const u of UOMS) {
    const row = await db.uom.upsert({
      where: { code: u.code },
      update: { nameEn: u.nameEn, nameVn: u.nameVn },
      create: u,
    });
    uomByCode.set(u.code, row.id);
  }

  // Categories
  const catByCode = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await db.category.upsert({
      where: { code: c.code },
      update: { nameEn: c.nameEn, nameVn: c.nameVn, isCapex: c.isCapex },
      create: { code: c.code, nameEn: c.nameEn, nameVn: c.nameVn, isCapex: c.isCapex },
    });
    catByCode.set(c.code, row.id);
  }

  // Cost centers
  const ccByCode = new Map<string, string>();
  for (const c of COST_CENTERS) {
    const row = await db.costCenter.upsert({
      where: { code: c.code },
      update: { nameEn: c.nameEn, nameVn: c.nameVn },
      create: {
        code: c.code,
        nameEn: c.nameEn,
        nameVn: c.nameVn,
        departmentId: deptByCode.get(c.dept)!,
      },
    });
    ccByCode.set(c.code, row.id);
  }

  // Items
  for (const it of ITEMS) {
    await db.item.upsert({
      where: { code: it.code },
      update: {
        nameEn: it.nameEn,
        nameVn: it.nameVn,
        categoryId: catByCode.get(it.cat)!,
        uomId: uomByCode.get(it.uom)!,
        lastPriceVnd: it.price,
        isLotTracked: it.lot ?? false,
      },
      create: {
        code: it.code,
        nameEn: it.nameEn,
        nameVn: it.nameVn,
        categoryId: catByCode.get(it.cat)!,
        uomId: uomByCode.get(it.uom)!,
        lastPriceVnd: it.price,
        isLotTracked: it.lot ?? false,
      },
    });
  }

  // Vendors (approved)
  for (const v of VENDORS) {
    await db.vendor.upsert({
      where: { code: v.code },
      update: { nameEn: v.nameEn, nameVn: v.nameVn, status: "APPROVED" },
      create: {
        code: v.code,
        nameEn: v.nameEn,
        nameVn: v.nameVn,
        taxCode: v.taxCode,
        contactName: v.contactName,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        bankName: v.bankName,
        bankAccount: v.bankAccount,
        paymentTermDays: v.paymentTermDays,
        categories: [...v.categories],
        status: "APPROVED",
      },
    });
  }

  // Budgets for the current fiscal year (per cost center × main categories)
  const fiscalYear = new Date().getFullYear();
  const budgetPlan: Array<{ cc: string; cat: string; amount: number }> = [
    { cc: "CC-ENG", cat: "HVAC", amount: 2_000_000_000 },
    { cc: "CC-ENG", cat: "ELEC", amount: 800_000_000 },
    { cc: "CC-PRJ", cat: "HVAC", amount: 5_000_000_000 },
    { cc: "CC-PRJ", cat: "CAPX", amount: 3_000_000_000 },
    { cc: "CC-MFG", cat: "CONS", amount: 600_000_000 },
    { cc: "CC-ADM", cat: "SERV", amount: 400_000_000 },
    { cc: "CC-FIN", cat: "SERV", amount: 300_000_000 },
  ];
  for (const b of budgetPlan) {
    const costCenterId = ccByCode.get(b.cc)!;
    const categoryId = catByCode.get(b.cat)!;
    await db.budget.upsert({
      where: {
        costCenterId_fiscalYear_categoryId: { costCenterId, fiscalYear, categoryId },
      },
      update: { amountVnd: b.amount },
      create: { costCenterId, fiscalYear, categoryId, amountVnd: b.amount },
    });
  }

  console.log(
    `Seeded ${UOMS.length} UoM, ${CATEGORIES.length} categories, ${COST_CENTERS.length} cost centers, ${ITEMS.length} items, ${VENDORS.length} vendors, ${budgetPlan.length} budgets (FY ${fiscalYear}).`,
  );
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
