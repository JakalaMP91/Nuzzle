import { parseHouseholdData } from "./household-data.ts";
import { taskNotificationAt, type ReminderTask } from "./task-reminders.ts";
import { parsePushSubscription, type StoredPushSubscription } from "./push-subscription.ts";
import { pushConfigured, type PushConfig, type NestPushMessage } from "./push-send.ts";

type SubscriptionRow = { endpoint: string; author: string; subscription: string; created_at: number; reminder_time: string; shopping_enabled: number; shopping_since: number };
type Dependencies = { db?: Pick<D1Database, "prepare">; config: PushConfig; send: (subscription: StoredPushSubscription, message: NestPushMessage) => Promise<number>; now?: number };
export function reminderForDevice(task: ReminderTask, author: string, subscribedAt: number, now: number, defaultTime = "08:00") {
  const person = task.assignee === "Ich" ? "Markus" : task.assignee === "Partner" ? "Bettina" : task.assignee;
  if ((person !== "Gemeinsam" && person !== author) || task.reminderMinutes === -1) return null;
  const due = taskNotificationAt(task, defaultTime);
  if (task.done || due === null || due < subscribedAt || now - due > 86400_000) return null;
  // Push lead time is independent of the visual warning on the due date.
  const minutes = task.reminderMinutes ?? 0;
  const state = now >= due ? "overdue" : minutes > 0 && now >= due - minutes * 60_000 ? "upcoming" : null;
  if (state === null) return null;
  return { key: `${task.id}:${due}:${task.reminderMinutes ?? 0}:${state}`, state, due };
}

type NewTask = ReminderTask & { createdAt?: number; createdBy?: string; comments?: { id: string; author?: string; createdAt?: string; pushEligible?: boolean }[] };
export function taskCreationNotifications(tasks: NewTask[], viewer: string, subscribedAt: number, now: number) {
  return tasks.filter((task) => {
    const assigned = task.assignee === "Ich" ? "Markus" : task.assignee === "Partner" ? "Bettina" : task.assignee;
    return !task.done && (assigned === viewer || assigned === "Gemeinsam") && (task.createdBy === "Markus" || task.createdBy === "Bettina") && task.createdBy !== viewer && typeof task.createdAt === "number" && Number.isFinite(task.createdAt) && task.createdAt > subscribedAt && task.createdAt <= now && task.createdAt >= now - 86400_000;
  });
}

export function taskCommentNotifications(tasks: NewTask[], viewer: string, subscribedAt: number, now: number) {
  return tasks.flatMap(task => (Array.isArray(task.comments) ? task.comments : []).filter(comment => {
    if (!comment || typeof comment !== "object") return false;
    const at = typeof comment.createdAt === "string" ? Date.parse(comment.createdAt) : NaN;
    return comment.pushEligible === true && typeof comment.id === "string" && comment.id.length > 0 && (comment.author === "Markus" || comment.author === "Bettina") && comment.author !== viewer && (viewer === "Markus" || viewer === "Bettina") && Number.isFinite(at) && at > subscribedAt && at <= now && at >= now - 86400_000;
  }).map(comment => ({ task, comment })));
}

type ShoppingItem = { id: number; name: string; addedAt?: number; createdBy?: string };
type Purchase = { id: string; item: ShoppingItem; checkedAt: number; actor?: string };
const quietPeriod = 5 * 60_000;
export function shoppingNotifications(data: { items: unknown[]; purchaseHistory: unknown[] }, viewer: string, since: number, now: number) {
  const eligible = (at: number, actor?: string) => Number.isFinite(at) && at > since && at <= now - quietPeriod && at >= now - 24 * 60 * 60_000 && (actor === "Markus" || actor === "Bettina") && actor !== viewer;
  const added = (data.items as ShoppingItem[]).filter(item => eligible(item.addedAt ?? 0, item.createdBy)).map(item => ({ key: `shopping-add:${item.id}`, title: "Nest · Einkaufsliste", name: item.name }));
  const purchased = (data.purchaseHistory as Purchase[]).filter(record => eligible(record.checkedAt, record.actor) && record.checkedAt - (record.item.addedAt ?? (record.item.id > 946684800000 ? record.item.id : 0)) >= quietPeriod).map(record => ({ key: `shopping-bought:${record.id}`, title: "Nest · Eingekauft", name: record.item.name }));
  return [...added, ...purchased];
}

// Scheduled events run independently of browser tabs and Access sessions.
// Only the authenticated subscription API can register notification recipients.
export async function runTaskPush({ db, config, send, now = Date.now() }: Dependencies) {
  if (!db || !pushConfigured(config)) return;
  const row = await db.prepare("SELECT data FROM household WHERE id = 1").first<{ data: string }>();
  if (!row) return;
  const data = parseHouseholdData(JSON.parse(row.data));
  if (!data) return;
  const allTasks = data.tasks as NewTask[];
  const tasks = allTasks.filter((task) => !task.done && task.dueDate);
  const devices = await db.prepare("SELECT endpoint, author, subscription, created_at, reminder_time, shopping_enabled, shopping_since FROM push_subscription ORDER BY created_at LIMIT 40").all<SubscriptionRow>();
  let attempts = 0;
  for (const device of devices.results) {
    let subscription: StoredPushSubscription | null = null;
    try { subscription = parsePushSubscription(JSON.parse(device.subscription)); } catch { /* Discard malformed or obsolete subscriptions below. */ }
    if (!subscription || (subscription.expirationTime !== null && subscription.expirationTime < now)) {
      await db.prepare("DELETE FROM push_subscription WHERE endpoint = ?").bind(device.endpoint).run();
      continue;
    }
    if (device.shopping_enabled) {
      for (const event of shoppingNotifications(data, device.author, Math.max(device.created_at, device.shopping_since), now)) {
        const claim = await db.prepare("INSERT INTO push_delivery (endpoint, notification_key, attempted_at, sent) VALUES (?, ?, ?, 0) ON CONFLICT(endpoint, notification_key) DO UPDATE SET attempted_at = excluded.attempted_at WHERE push_delivery.sent = 0 AND push_delivery.attempted_at < ? RETURNING notification_key")
          .bind(device.endpoint, event.key, now, now - 15 * 60_000).first();
        if (!claim) continue;
        let status = 0;
        try { status = await send(subscription, { title: event.title, body: event.name.slice(0, 160), tag: event.key, url: "/?view=shopping" }); } catch { /* Retry after lease. */ }
        attempts++;
        await db.prepare("UPDATE push_delivery SET sent = ?, last_status = ? WHERE endpoint = ? AND notification_key = ?").bind(status >= 200 && status < 300 ? 1 : 0, status, device.endpoint, event.key).run();
        if (status === 404 || status === 410) { await db.prepare("DELETE FROM push_subscription WHERE endpoint = ?").bind(device.endpoint).run(); subscription = null; break; }
        if (attempts >= 20) return;
      }
    }
    if (!subscription) continue;
    for (const task of taskCreationNotifications(allTasks, device.author, device.created_at, now)) {
      const key = `task-created:${task.id}`;
      const claim = await db.prepare("INSERT INTO push_delivery (endpoint, notification_key, attempted_at, sent) VALUES (?, ?, ?, 0) ON CONFLICT(endpoint, notification_key) DO UPDATE SET attempted_at = excluded.attempted_at WHERE push_delivery.sent = 0 AND push_delivery.attempted_at < ? RETURNING notification_key").bind(device.endpoint, key, now, now - 15 * 60_000).first();
      if (!claim) continue;
      let status = 0;
      try { status = await send(subscription, { title: "Nest · Neue Aufgabe", body: task.title.slice(0, 160), tag: key, url: "/?view=tasks" }); } catch { /* Retry after lease. */ }
      attempts++;
      await db.prepare("UPDATE push_delivery SET sent = ?, last_status = ? WHERE endpoint = ? AND notification_key = ?").bind(status >= 200 && status < 300 ? 1 : 0, status, device.endpoint, key).run();
      if (status === 404 || status === 410) { await db.prepare("DELETE FROM push_subscription WHERE endpoint = ?").bind(device.endpoint).run(); subscription = null; break; }
      if (attempts >= 20) return;
    }
    if (!subscription) continue;
    for (const { task, comment } of taskCommentNotifications(allTasks, device.author, device.created_at, now)) {
      const key = `task-comment:${task.id}:${comment.id}`;
      const claim = await db.prepare("INSERT INTO push_delivery (endpoint, notification_key, attempted_at, sent) VALUES (?, ?, ?, 0) ON CONFLICT(endpoint, notification_key) DO UPDATE SET attempted_at = excluded.attempted_at WHERE push_delivery.sent = 0 AND push_delivery.attempted_at < ? RETURNING notification_key").bind(device.endpoint, key, now, now - 15 * 60_000).first();
      if (!claim) continue;
      let status = 0;
      try { status = await send(subscription, { title: "Nest · Neuer Kommentar", body: task.title.slice(0, 160), tag: key, url: "/?view=tasks" }); } catch { /* Retry after lease. */ }
      attempts++;
      await db.prepare("UPDATE push_delivery SET sent = ?, last_status = ? WHERE endpoint = ? AND notification_key = ?").bind(status >= 200 && status < 300 ? 1 : 0, status, device.endpoint, key).run();
      if (status === 404 || status === 410) { await db.prepare("DELETE FROM push_subscription WHERE endpoint = ?").bind(device.endpoint).run(); subscription = null; break; }
      if (attempts >= 20) return;
    }
    if (!subscription) continue;
    for (const task of tasks) {
      const reminder = reminderForDevice(task, device.author, device.created_at, now, device.reminder_time);
      if (!reminder) continue;
      // Atomic lease prevents overlapping cron invocations from sending twice.
      // A failed request is retried after fifteen minutes. Once delivered to the
      // push service, the reminder remains marked sent for this device/term.
      const claim = await db.prepare("INSERT INTO push_delivery (endpoint, notification_key, attempted_at, sent) VALUES (?, ?, ?, 0) ON CONFLICT(endpoint, notification_key) DO UPDATE SET attempted_at = excluded.attempted_at WHERE push_delivery.sent = 0 AND push_delivery.attempted_at < ? RETURNING notification_key")
        .bind(device.endpoint, reminder.key, now, now - 15 * 60_000).first();
      if (!claim) continue;
      const message = { title: reminder.state === "overdue" ? "Nest · Aufgabe fällig" : "Nest · Aufgabe bald fällig", body: task.title.slice(0, 160), tag: `nest-task-${task.id}`, url: "/?view=tasks" };
      let status = 0;
      try { status = await send(subscription, message); } catch { /* Retry after the lease expires; do not log subscription secrets. */ }
      attempts++;
      await db.prepare("UPDATE push_delivery SET sent = ?, last_status = ? WHERE endpoint = ? AND notification_key = ?").bind(status >= 200 && status < 300 ? 1 : 0, status, device.endpoint, reminder.key).run();
      if (status === 404 || status === 410) {
        await db.prepare("DELETE FROM push_subscription WHERE endpoint = ?").bind(device.endpoint).run();
        break;
      }
      if (attempts >= 20) return;
    }
  }
  await db.prepare("DELETE FROM push_delivery WHERE attempted_at < ? OR endpoint NOT IN (SELECT endpoint FROM push_subscription)").bind(now - 30 * 86400_000).run();
}

