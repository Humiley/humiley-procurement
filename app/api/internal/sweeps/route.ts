import { NextResponse } from "next/server";
import { runSlaSweep, runRenewalSweep } from "@/lib/sweeps";
import { sweepToken } from "@/lib/sweep-token";

/** Node runtime: this route touches Prisma and nodemailer, neither of which exists on the edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The sweeps' only door. instrumentation.ts pokes it on a timer from inside this same process —
 * it cannot import the sweeps directly, because instrumentation is also compiled for the EDGE
 * runtime (this app has Auth.js middleware) and dragging nodemailer in there fails to resolve
 * `stream`, which 500s every page in the app.
 *
 * Authorised by a token minted in memory at boot: same process, so the timer knows it and nothing
 * outside can. No env var to configure, and it changes on every restart.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-sweep-token") !== sweepToken()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const which = new URL(req.url).searchParams.get("which");
  const result =
    which === "renewals" ? await runRenewalSweep() : which === "sla" ? await runSlaSweep() : null;
  if (!result) return NextResponse.json({ error: "unknown sweep" }, { status: 400 });
  return NextResponse.json({ ok: true, ...result });
}
