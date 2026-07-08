import { requireUser } from "@/lib/rbac";
import { latestFxRates } from "@/lib/fx";
import { Estimator } from "@/components/trade/Estimator";

/** §20 instant landed-cost lookup. */
export default async function EstimatorPage() {
  await requireUser();
  const rates = await latestFxRates();
  return <Estimator rates={rates} />;
}
