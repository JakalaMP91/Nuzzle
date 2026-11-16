export type PushDiagnosticEntry = { time: string; event: string; outcome: string; kind?: string; status?: number; providerStatus?: number };
const dbName = "nest-push-diagnostics-v1", storeName = "events", limit = 150;
const events = ["restore", "activate", "deactivate", "test", "preferences", "push_received", "notification_shown", "notification_failed"];
const outcomes = ["started", "enabled", "disabled", "success", "error", "received"];
const kinds = ["test", "task_created", "task_comment", "task_reminder", "shopping_added", "shopping_bought", "other"];
export function cleanPushDiagnostic(value: unknown): PushDiagnosticEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.time !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw.time) || typeof raw.event !== "string" || !events.includes(raw.event) || typeof raw.outcome !== "string" || !outcomes.includes(raw.outcome)) return null;
  const out: PushDiagnosticEntry = { time: raw.time, event: raw.event, outcome: raw.outcome };
  if (typeof raw.kind === "string" && kinds.includes(raw.kind)) out.kind = raw.kind;
  for (const field of ["status", "providerStatus"] as const) if (typeof raw[field] === "number" && Number.isInteger(raw[field]) && raw[field] >= 0 && raw[field] <= 599) out[field] = raw[field];
  return out;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName, { autoIncrement: true }); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); req.onblocked = () => reject(new Error("blocked"));
  });
}
async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 2500); })]); }
  finally { if (timer) clearTimeout(timer); }
}
export async function writePushDiagnostic(entry: Omit<PushDiagnosticEntry, "time">): Promise<boolean> {
  const safe = cleanPushDiagnostic({ ...entry, time: new Date().toISOString() });
  if (!safe) return false;
  try {
    return await bounded((async () => {
      const db = await database();
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite"), store = tx.objectStore(storeName);
        store.add(safe);
        const count = store.count(); count.onsuccess = () => { let remove = Math.max(0, count.result - limit); if (!remove) return; const cursor = store.openCursor(); cursor.onsuccess = () => { if (cursor.result && remove > 0) { cursor.result.delete(); remove--; cursor.result.continue(); } }; };
        tx.oncomplete = () => { db.close(); resolve(true); }; tx.onerror = () => { db.close(); reject(tx.error); }; tx.onabort = () => { db.close(); reject(tx.error); };
      });
    })());
  } catch { return false; }
}
export async function readPushDiagnostics(): Promise<{ available: boolean; entries: PushDiagnosticEntry[] }> {
  try { return await bounded((async () => { const db = await database(); return await new Promise<{ available: boolean; entries: PushDiagnosticEntry[] }>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly"), req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => { const entries = req.result.map(cleanPushDiagnostic).filter((entry): entry is PushDiagnosticEntry => entry !== null).slice(-limit); db.close(); resolve({ available: true, entries }); };
    req.onerror = () => { db.close(); reject(req.error); };
  }); })()); } catch { return { available: false, entries: [] }; }
}
