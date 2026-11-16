/* Nuzzle receives visible notifications only. No request interception or cache. */
// Bounded, content-free device events. Diagnostics never block notification display.
function logPush(event, outcome, kind) {
  return new Promise((resolve) => {
    let finished = false; const done = () => { if (!finished) { finished = true; resolve(); } };
    const timer = setTimeout(done, 2000);
    try {
      const open = indexedDB.open("nest-push-diagnostics-v1", 1);
      open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains("events")) open.result.createObjectStore("events", { autoIncrement: true }); };
      open.onerror = open.onblocked = () => { clearTimeout(timer); done(); };
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction("events", "readwrite"), store = tx.objectStore("events");
          store.add({ time: new Date().toISOString(), event, outcome, kind });
          const count = store.count(); count.onsuccess = () => { let n = Math.max(0, count.result - 150); if (!n) return; const cursor = store.openCursor(); cursor.onsuccess = () => { if (cursor.result && n > 0) { cursor.result.delete(); n--; cursor.result.continue(); } }; };
          tx.oncomplete = tx.onerror = tx.onabort = () => { db.close(); clearTimeout(timer); done(); };
        } catch { db.close(); clearTimeout(timer); done(); }
      };
    } catch { clearTimeout(timer); done(); }
  });
}
function pushKind(tag) {
  if (tag === "nest-test") return "test";
  if (tag.startsWith("task-comment:")) return "task_comment";
  if (tag.startsWith("task-created:")) return "task_created";
  if (tag.startsWith("nest-task-")) return "task_reminder";
  if (tag.startsWith("shopping-add:")) return "shopping_added";
  if (tag.startsWith("shopping-bought:")) return "shopping_bought";
  return "other";
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let message = { title: "Nuzzle", body: "Eine Aufgabe wartet auf dich.", tag: "nest-task", url: "/?view=tasks" };
  try { if (event.data) message = { ...message, ...event.data.json() }; } catch { /* Display a useful generic notification. */ }
  const kind = pushKind(String(message.tag));
  const receipt = logPush("push_received", "received", kind);
  const display = self.registration.showNotification(String(message.title).slice(0, 100), {
    body: String(message.body).slice(0, 240), icon: "/nest-icon-192.png?v=nuzzle-green-1", tag: String(message.tag).slice(0, 100), data: { url: message.url === "/?view=shopping" ? "/?view=shopping" : "/?view=tasks" },
  }).then(() => logPush("notification_shown", "success", kind), () => logPush("notification_failed", "error", kind));
  event.waitUntil(Promise.all([receipt, display]));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url === "/?view=shopping" ? "/?view=shopping" : "/?view=tasks", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});
