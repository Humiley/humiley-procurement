import { requireUser } from "@/lib/rbac";
import { ScanHub } from "@/components/inv/ScanHub";
import { HowItWorks } from "@/components/shared/HowItWorks";

/** §21 scan hub — one page scans everything (documents, items, lots). */
export default async function ScanPage(
  props: {
    searchParams?: Promise<{ code?: string | string[] }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser();
  const code = typeof searchParams?.code === "string" ? searchParams.code : undefined;
  return (
    <div className="space-y-4">
      <HowItWorks guide="scan" />
      <ScanHub initialCode={code} />
    </div>
  );
}
