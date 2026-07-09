import { requireUser } from "@/lib/rbac";
import { ScanHub } from "@/components/inv/ScanHub";

/** §21 scan hub — one page scans everything (documents, items, lots). */
export default async function ScanPage({
  searchParams,
}: {
  searchParams?: { code?: string | string[] };
}) {
  await requireUser();
  const code = typeof searchParams?.code === "string" ? searchParams.code : undefined;
  return <ScanHub initialCode={code} />;
}
