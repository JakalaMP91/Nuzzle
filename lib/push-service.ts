import { commentAuthorForEmail } from "./household-identity.ts";
import { parsePushSubscription, allowedPushEndpoint, type StoredPushSubscription } from "./push-subscription.ts";
import { pushConfigured, type PushConfig, type NestPushMessage } from "./push-send.ts";

type Dependencies = { db?: Pick<D1Database, "prepare" | "batch">; identify: (request: Request) => Promise<string | null>; config: PushConfig & { NEST_COMMENT_AUTHORS?: string }; send: (subscription: StoredPushSubscription, message: NestPushMessage) => Promise<number>; now?: () => number };
const headers = { "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

export function createPushService({ db, identify, config, send, now = Date.now }: Dependencies) {
  async function handle(request: Request) {
    const email = await identify(request);
    const author = commentAuthorForEmail(email, config.NEST_COMMENT_AUTHORS);
    if (!email || !author) return reply({ error: "Nicht angemeldet oder kein Zugriff." }, 401);
    if (request.method === "GET") return reply({ configured: Boolean(db) && pushConfigured(config), publicKey: pushConfigured(config) ? config.NEST_VAPID_PUBLIC_KEY : null });
    if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Ungültiger Ursprung." }, 403);
    if (!["POST", "DELETE"].includes(request.method)) return reply({ error: "Methode nicht erlaubt." }, 405);
    if (!db || !pushConfigured(config)) return reply({ error: "Benachrichtigungen sind serverseitig noch nicht eingerichtet." }, 503);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ error: "Ungültiges Format." }, 415);
    let body: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (raw.length > 6000) return reply({ error: "Die Daten sind zu groß." }, 413);
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch { return reply({ error: "Ungültige Daten." }, 400); }
    if (request.method === "DELETE") {
      if (!allowedPushEndpoint(body.endpoint)) return reply({ error: "Ungültiges Gerät." }, 400);
      await db.prepare("DELETE FROM push_delivery WHERE endpoint = ? AND EXISTS (SELECT 1 FROM push_subscription WHERE endpoint = ? AND author = ?)").bind(body.endpoint, body.endpoint, author).run();
      await db.prepare("DELETE FROM push_subscription WHERE endpoint = ? AND author = ?").bind(body.endpoint, author).run();
      return reply({ enabled: false });
    }
    if (body.action === "diagnostics") {
      if (!allowedPushEndpoint(body.endpoint)) return reply({ error: "Ungültiges Gerät." }, 400);
      const owned = await db.prepare("SELECT 1 AS present FROM push_subscription WHERE endpoint = ? AND author = ?").bind(body.endpoint, author).first();
      if (!owned) return reply({ error: "Gerät ist nicht registriert." }, 404);
      const records = await db.prepare("SELECT attempted_at, sent, last_status, notification_key FROM push_delivery WHERE endpoint = ? ORDER BY attempted_at DESC LIMIT 100").bind(body.endpoint).all<{ attempted_at: number; sent: number; last_status: number | null; notification_key: string }>();
      const attempts = records.results.map((entry) => ({ time: new Date(entry.attempted_at).toISOString(), type: entry.notification_key.startsWith("task-comment:") ? "task_comment" : entry.notification_key.startsWith("task-created:") ? "task_created" : entry.notification_key.startsWith("shopping-add:") ? "shopping_added" : entry.notification_key.startsWith("shopping-bought:") ? "shopping_bought" : /^\d+:\d+:/.test(entry.notification_key) ? "task_reminder" : "other", outcome: entry.sent ? "accepted" : "not_accepted", ...(Number.isInteger(entry.last_status) && entry.last_status! >= 0 && entry.last_status! <= 599 ? { providerStatus: entry.last_status } : {}) }));
      return reply({ attempts });
    }
    if (body.action === "preferences") {
      if (!allowedPushEndpoint(body.endpoint) || typeof body.reminderTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminderTime) || typeof body.shoppingEnabled !== "boolean") return reply({ error: "Ungültige Einstellungen." }, 400);
      const timestamp = now();
      const row = await db.prepare("UPDATE push_subscription SET reminder_time = ?, shopping_since = CASE WHEN shopping_enabled = 0 AND ? = 1 THEN ? ELSE shopping_since END, shopping_enabled = ? WHERE endpoint = ? AND author = ? RETURNING reminder_time, shopping_enabled").bind(body.reminderTime, body.shoppingEnabled ? 1 : 0, timestamp, body.shoppingEnabled ? 1 : 0, body.endpoint, author).first<{ reminder_time: string; shopping_enabled: number }>();
      return row ? reply({ reminderTime: row.reminder_time, shoppingEnabled: Boolean(row.shopping_enabled) }) : reply({ error: "Bitte Benachrichtigungen auf diesem Gerät aktivieren." }, 404);
    }
    if (body.action === "test") {
      if (!allowedPushEndpoint(body.endpoint)) return reply({ error: "Ungültiges Gerät." }, 400);
      const row = await db.prepare("UPDATE push_subscription SET last_test_at = ? WHERE endpoint = ? AND author = ? AND last_test_at < ? RETURNING subscription").bind(now(), body.endpoint, author, now() - 60_000).first<{ subscription: string }>();
      if (!row) {
        const registered = await db.prepare("SELECT 1 AS present FROM push_subscription WHERE endpoint = ? AND author = ?").bind(body.endpoint, author).first();
        return registered ? reply({ error: "Bitte zwischen Testnachrichten eine Minute warten." }, 429) : reply({ error: "Dieses Gerät ist nicht mehr registriert. Bitte Benachrichtigungen erneut aktivieren." }, 404);
      }
      const subscription = parsePushSubscription(JSON.parse(row.subscription));
      if (!subscription) return reply({ error: "Das Gerät muss erneut aktiviert werden." }, 409);
      try {
        const status = await send(subscription, { title: "Nest", body: "Benachrichtigungen auf diesem Gerät sind aktiviert.", tag: "nest-test", url: "/?view=tasks" });
        if (status === 404 || status === 410) {
          await db.prepare("DELETE FROM push_subscription WHERE endpoint = ? AND author = ?").bind(subscription.endpoint, author).run();
          return reply({ error: "Das Gerät muss erneut aktiviert werden.", providerStatus: status }, 409);
        }
        return status >= 200 && status < 300 ? reply({ sent: true, providerStatus: status }) : reply({ error: `Der Benachrichtigungsdienst hat den Test abgelehnt (HTTP ${status}).`, providerStatus: status }, 502);
      } catch { return reply({ error: "Die Testnachricht konnte nicht versendet werden." }, 502); }
    }
    const subscription = parsePushSubscription(body.subscription);
    if (!subscription) return reply({ error: "Ungültiges Benachrichtigungsgerät." }, 400);
    const count = await db.prepare("SELECT count(*) AS count FROM push_subscription WHERE author = ? AND endpoint <> ?").bind(author, subscription.endpoint).first<{ count: number }>();
    if ((count?.count ?? 0) >= 20) return reply({ error: "Zu viele aktivierte Geräte. Bitte ein anderes Gerät deaktivieren." }, 409);
    const timestamp = now();
    const saved = await db.prepare("INSERT INTO push_subscription (endpoint, author, subscription, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription, reminder_time = CASE WHEN push_subscription.author = excluded.author THEN push_subscription.reminder_time ELSE '08:00' END, shopping_enabled = CASE WHEN push_subscription.author = excluded.author THEN push_subscription.shopping_enabled ELSE 0 END, shopping_since = CASE WHEN push_subscription.author = excluded.author THEN push_subscription.shopping_since ELSE 0 END, created_at = CASE WHEN push_subscription.author = excluded.author THEN push_subscription.created_at ELSE excluded.created_at END, author = excluded.author, updated_at = excluded.updated_at RETURNING reminder_time, shopping_enabled")
      .bind(subscription.endpoint, author, JSON.stringify(subscription), timestamp, timestamp).first<{ reminder_time: string; shopping_enabled: number }>();
    return reply({ enabled: true, reminderTime: saved?.reminder_time ?? "08:00", shoppingEnabled: Boolean(saved?.shopping_enabled) });
  }
  return { GET: handle, POST: handle, DELETE: handle };
}

