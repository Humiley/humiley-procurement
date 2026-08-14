/**
 * Next's startup hook — the one place this app can run something once when the server boots.
 * Used to drive the background sweeps (SLA chases, contract renewals) that used to fire from a
 * page render. See lib/sweeps.ts for why that was wrong.
 *
 * This file is compiled for the EDGE runtime as well as Node, so it must stay free of anything
 * Node-only: importing the sweeps here drags Prisma and nodemailer into the edge bundle, which
 * cannot resolve `stream` and 500s every page in the app. So the timer only pokes an internal
 * route (which is pinned to the Node runtime) over loopback, carrying a token minted in this same
 * process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { sweepToken } = await import("@/lib/sweep-token");
  const token = sweepToken();
  const base = `http://127.0.0.1:${process.env.PORT || 3000}${process.env.NEXT_PUBLIC_BASE_PATH ?? "/procurement"}`;
  const EVERY = { sla: 15 * 60 * 1000, renewals: 6 * 3600 * 1000 };
  const FIRST_RUN = Number(process.env.SWEEP_FIRST_RUN_MS || 45 * 1000);

  const poke = async (which: string) => {
    try {
      const r = await fetch(`${base}/api/internal/sweeps?which=${which}`, {
        method: "POST",
        headers: { "x-sweep-token": token },
      });
      if (!r.ok) console.error(`[sweep:${which}] HTTP ${r.status}`);
      else {
        const j = (await r.json()) as { notified?: number; checked?: number; capped?: boolean };
        if (j.notified || j.capped) console.log(`[sweep:${which}] checked=${j.checked} notified=${j.notified}${j.capped ? " CAPPED" : ""}`);
      }
    } catch (e) {
      // Never throw from a timer: an unhandled rejection would take the server down, and a missed
      // reminder must not cost the app its availability.
      console.error(`[sweep:${which}] failed:`, e instanceof Error ? e.message : e);
    }
  };

  const schedule = (which: string, every: number) => {
    setTimeout(() => {
      void poke(which);
      setInterval(() => void poke(which), every).unref?.();
    }, FIRST_RUN).unref?.();
  };
  schedule("sla", EVERY.sla);
  schedule("renewals", EVERY.renewals);
  console.log(`[sweep] scheduled — SLA every ${EVERY.sla / 60000}min, renewals every ${EVERY.renewals / 3600000}h`);
}
