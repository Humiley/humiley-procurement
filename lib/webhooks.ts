import "server-only";
import { createHmac } from "crypto";
import { db } from "@/lib/db";

/**
 * §17 outbound webhooks — best-effort POST to every active subscription of the event.
 * Never throws into the business transaction; failures are logged to the console only.
 * Payloads are signed with `X-Humiley-Signature: sha256=<hmac>` when the subscription has a secret.
 */
export type WebhookEvent = "po.approved" | "invoice.matched" | "payment.paid" | "stock.belowMin" | "test.ping";

export async function fireWebhook(event: WebhookEvent, payload: Record<string, unknown>) {
  try {
    const subs = await db.webhookSubscription.findMany({ where: { isActive: true, events: { has: event } } });
    if (!subs.length) return;
    const body = JSON.stringify({ event, firedAt: new Date().toISOString(), data: payload });
    await Promise.allSettled(
      subs.map(async (s) => {
        const headers: Record<string, string> = { "Content-Type": "application/json", "X-Humiley-Event": event };
        if (s.secret) headers["X-Humiley-Signature"] = `sha256=${createHmac("sha256", s.secret).update(body).digest("hex")}`;
        const res = await fetch(s.url, { method: "POST", headers, body, signal: AbortSignal.timeout(5000) });
        if (!res.ok) console.warn(`[webhook] ${event} → ${s.url}: HTTP ${res.status}`);
      }),
    );
  } catch (e) {
    console.warn(`[webhook] ${event} dispatch failed:`, e instanceof Error ? e.message : e);
  }
}
