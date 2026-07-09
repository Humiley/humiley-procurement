"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { mintApiToken } from "@/lib/api-auth";
import { fireWebhook, type WebhookEvent } from "@/lib/webhooks";
import { guard } from "@/lib/safe-action";

/* ── §17 API keys ── */

async function _createApiKey(name: string) {
  const admin = await requireRoles("ADMIN");
  const clean = name.trim();
  if (!clean) throw new Error("Name the key (e.g. 'MISA accounting').");
  const { token, prefix, keyHash } = mintApiToken();
  const row = await db.apiKey.create({ data: { name: clean, prefix, keyHash, createdById: admin.id } });
  await audit({ userId: admin.id, action: "APIKEY_CREATE", entityType: "ApiKey", entityId: row.id, after: { name: clean, prefix } });
  revalidatePath("/admin/settings");
  return { id: row.id, token }; // plaintext shown exactly once
}

async function _deactivateApiKey(id: string) {
  const admin = await requireRoles("ADMIN");
  await db.apiKey.update({ where: { id }, data: { isActive: false } });
  await audit({ userId: admin.id, action: "APIKEY_DEACTIVATE", entityType: "ApiKey", entityId: id });
  revalidatePath("/admin/settings");
  return { id };
}

/* ── §17 webhooks ── */

const WEBHOOK_EVENTS = ["po.approved", "invoice.matched", "payment.paid", "stock.belowMin"] as const;
const webhookSchema = z.object({
  url: z.string().url("Enter a valid URL"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event"),
  secret: z.string().trim().optional().nullable(),
});
export type WebhookPayload = z.input<typeof webhookSchema>;

async function _createWebhook(input: WebhookPayload) {
  const admin = await requireRoles("ADMIN");
  const v = webhookSchema.parse(input);
  const row = await db.webhookSubscription.create({ data: { url: v.url, events: v.events, secret: v.secret || null } });
  await audit({ userId: admin.id, action: "WEBHOOK_CREATE", entityType: "WebhookSubscription", entityId: row.id, after: { url: v.url, events: v.events } });
  revalidatePath("/admin/settings");
  return { id: row.id };
}

async function _deleteWebhook(id: string) {
  const admin = await requireRoles("ADMIN");
  const row = await db.webhookSubscription.delete({ where: { id } });
  await audit({ userId: admin.id, action: "WEBHOOK_DELETE", entityType: "WebhookSubscription", entityId: id, before: { url: row.url } });
  revalidatePath("/admin/settings");
  return { id };
}

/** Send a test ping to ONE subscription (temporarily targeting its URL with the test event). */
async function _testWebhook(id: string) {
  const admin = await requireRoles("ADMIN");
  const sub = await db.webhookSubscription.findUnique({ where: { id } });
  if (!sub) throw new Error("Subscription not found.");
  // fire directly at this sub regardless of its event list
  const body = { pingedBy: admin.name, subscription: sub.url };
  const original = sub.events;
  try {
    await db.webhookSubscription.update({ where: { id }, data: { events: ["test.ping"] } });
    await fireWebhook("test.ping" as WebhookEvent, body);
  } finally {
    await db.webhookSubscription.update({ where: { id }, data: { events: original } });
  }
  return { ok: true };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createApiKey(...a: Parameters<typeof _createApiKey>) { return guard(_createApiKey, a); }
export async function deactivateApiKey(...a: Parameters<typeof _deactivateApiKey>) { return guard(_deactivateApiKey, a); }
export async function createWebhook(...a: Parameters<typeof _createWebhook>) { return guard(_createWebhook, a); }
export async function deleteWebhook(...a: Parameters<typeof _deleteWebhook>) { return guard(_deleteWebhook, a); }
export async function testWebhook(...a: Parameters<typeof _testWebhook>) { return guard(_testWebhook, a); }
