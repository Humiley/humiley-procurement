import { requireUser } from "@/lib/rbac";
import { ScanHub } from "@/components/inv/ScanHub";

/** §21 scan hub — one page scans everything (documents, items, lots). */
export default async function ScanPage() {
  await requireUser();
  return <ScanHub />;
}
