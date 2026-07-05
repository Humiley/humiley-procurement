import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  FileQuestion,
  ShoppingCart,
  PackageCheck,
  ReceiptText,
  Banknote,
  Building2,
  FileSignature,
  Warehouse,
  PackageMinus,
  ArrowLeftRight,
  ClipboardList,
  ScanLine,
  Ship,
  BookMarked,
  Calculator,
  Wallet,
  BarChart3,
  Users,
  Network,
  GitBranch,
  Package,
  FolderTree,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string; // key under the "nav" namespace
  icon: LucideIcon;
  roles?: Role[]; // when set, visible only to these roles (ADMIN always sees it)
};
export type NavGroup = { titleKey?: string; items: NavItem[] };

/** Sidebar navigation (spec §11). */
export const NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard }] },
  {
    titleKey: "groupProcure",
    items: [
      { href: "/requisitions", labelKey: "requisitions", icon: FileText },
      { href: "/approvals", labelKey: "approvals", icon: CheckSquare },
      { href: "/rfqs", labelKey: "rfqs", icon: FileQuestion },
      { href: "/purchase-orders", labelKey: "purchaseOrders", icon: ShoppingCart },
      { href: "/goods-receipts", labelKey: "goodsReceipts", icon: PackageCheck },
      { href: "/invoices", labelKey: "invoices", icon: ReceiptText },
      { href: "/payment-requests", labelKey: "paymentRequests", icon: Banknote },
      { href: "/vendors", labelKey: "vendors", icon: Building2 },
      { href: "/contracts", labelKey: "contracts", icon: FileSignature },
    ],
  },
  {
    titleKey: "groupInventory",
    items: [
      { href: "/inventory", labelKey: "inventory", icon: Warehouse },
      { href: "/inventory/issues", labelKey: "issues", icon: PackageMinus },
      { href: "/inventory/transfers", labelKey: "transfers", icon: ArrowLeftRight },
      { href: "/inventory/counts", labelKey: "counts", icon: ClipboardList },
      { href: "/scan", labelKey: "scan", icon: ScanLine },
    ],
  },
  {
    titleKey: "groupTrade",
    items: [
      { href: "/reference/incoterms", labelKey: "incoterms", icon: Ship },
      { href: "/reference/hs-codes", labelKey: "hsCodes", icon: BookMarked },
      { href: "/trade/estimator", labelKey: "estimator", icon: Calculator },
    ],
  },
  {
    titleKey: "groupInsight",
    items: [
      { href: "/budgets", labelKey: "budgets", icon: Wallet },
      { href: "/reports", labelKey: "reports", icon: BarChart3 },
    ],
  },
  {
    titleKey: "admin",
    items: [
      { href: "/admin/users", labelKey: "users", icon: Users, roles: ["ADMIN"] },
      { href: "/admin/departments", labelKey: "departments", icon: Network, roles: ["ADMIN"] },
      { href: "/admin/approval-matrix", labelKey: "approvalMatrix", icon: GitBranch, roles: ["ADMIN"] },
      { href: "/admin/items", labelKey: "items", icon: Package, roles: ["ADMIN"] },
      { href: "/admin/categories", labelKey: "categories", icon: FolderTree, roles: ["ADMIN"] },
      { href: "/admin/settings", labelKey: "settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

/** Whether a nav item is visible to a user with the given roles. */
export function canSeeNav(item: NavItem, roles: Role[]): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  if (roles.includes("ADMIN")) return true;
  return item.roles.some((r) => roles.includes(r));
}
