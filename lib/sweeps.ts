import "server-only";
import { db } from "@/lib/db";
import { notifyUser, notifyRoles } from "@/lib/notify";

/**
 * The two background sweeps, and the timer that runs them.
 *
 * Both used to fire from a PAGE RENDER — the SLA chase on every load of /approvals by any user,
 * the renewal alert on every load of /contracts. That has three problems, and the third is the
 * one that matters:
 *
 *   1. a GET with side effects: opening a list emailed other people;
 *   2. the work was repeated on every visit and skipped whenever nobody visited;
 *   3. an overdue approval was only ever chased if somebody happened to open the queue. The
 *      approver who is late is exactly the person NOT opening it, so the reminder depended on a
 *      colleague wandering past — and over a quiet week nothing was chased at all.
 *
 * They now run on a timer in the server process (registered by instrumentation.ts), which is the
 * same shape the portal uses for its own reminders. One container, one process, so one runner.
 *
 * Both remain idempotent and deduped on an unread notification carrying the same link, so a manual
 * call, a restart, or an overlapping tick cannot produce a second email for the same thing.
 */

const DAY = 24 * 3600 * 1000;

/** Bounded so one pathological sweep cannot email hundreds of rows — but a hit cap is LOGGED,
 *  never silent: the whole point of moving to a timer was to stop work disappearing quietly. */
const SLA_BATCH = 200;

export type SweepResult = { checked: number; notified: number; capped?: boolean };

/** §15 — PENDING approval steps past slaDueAt remind their approver, once per breach. */
export async function runSlaSweep(): Promise<SweepResult> {
  const overdue = await db.approvalStep.findMany({
    where: { status: "PENDING", slaDueAt: { lt: new Date() } },
    include: { approver: { select: { id: true } } },
    take: SLA_BATCH,
  });
  if (overdue.length === 0) return { checked: 0, notified: 0 };

  // One query for every already-open reminder instead of findFirst per step (N+1).
  const links = overdue.map((s) => `/approvals?overdue=${s.id}`);
  const open = new Set(
    (
      await db.notification.findMany({
        where: { link: { in: links }, isRead: false },
        select: { link: true },
      })
    ).map((n) => n.link),
  );

  let notified = 0;
  for (const s of overdue) {
    const link = `/approvals?overdue=${s.id}`;
    if (open.has(link)) continue;
    await notifyUser(s.approver.id, {
      titleEn: `Approval overdue: ${s.entityType} level ${s.level}`,
      titleVn: `Phê duyệt quá hạn: ${s.entityType} cấp ${s.level}`,
      bodyEn: "The SLA for this approval step has passed — please decide it.",
      bodyVn: "Bước phê duyệt này đã quá hạn SLA — vui lòng xử lý.",
      link,
    });
    notified++;
  }
  return { checked: overdue.length, notified, capped: overdue.length === SLA_BATCH };
}

/** §9 — expire past-end contracts, then alert on the ones inside their renewal window. */
export async function runRenewalSweep(): Promise<SweepResult> {
  const now = new Date();
  await db.contract.updateMany({
    where: { status: "ACTIVE", endDate: { lt: now } },
    data: { status: "EXPIRED" },
  });

  const active = await db.contract.findMany({
    where: { status: "ACTIVE" },
    include: { vendor: { select: { code: true, nameEn: true } } },
  });
  const expiring = active.filter(
    (c) => Math.ceil((c.endDate.getTime() - now.getTime()) / DAY) <= c.renewalAlertDays,
  );
  if (expiring.length === 0) return { checked: 0, notified: 0 };

  const links = expiring.map((c) => `/contracts/${c.id}`);
  const open = new Set(
    (
      await db.notification.findMany({
        where: { link: { in: links }, isRead: false },
        select: { link: true },
      })
    ).map((n) => n.link),
  );

  let notified = 0;
  for (const c of expiring) {
    const link = `/contracts/${c.id}`;
    if (open.has(link)) continue;
    const daysLeft = Math.ceil((c.endDate.getTime() - now.getTime()) / DAY);
    // One alert, one email each — a Director who also purchases holds both roles.
    await notifyRoles(["PURCHASER", "DIRECTOR"], {
      titleEn: `Contract ${c.contractNumber} (${c.vendor.code}) expires in ${daysLeft} day(s)`,
      titleVn: `Hợp đồng ${c.contractNumber} (${c.vendor.code}) hết hạn sau ${daysLeft} ngày`,
      bodyEn: `${c.title} — valid to ${c.endDate.toISOString().slice(0, 10)}. Review for renewal.`,
      bodyVn: `${c.title} — hiệu lực đến ${c.endDate.toISOString().slice(0, 10)}. Xem xét gia hạn.`,
      link,
    });
    notified++;
  }
  return { checked: expiring.length, notified };
}
