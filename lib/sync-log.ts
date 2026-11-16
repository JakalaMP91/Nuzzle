export type SyncOperation = "connect" | "save" | "refresh" | "load-cloud" | "merge" | "network";
export type SyncOutcome = "started" | "success" | "error" | "conflict" | "deferred" | "unavailable";
export type SyncReason = "http" | "session" | "timeout" | "network" | "aborted" | "invalid-response" | "storage" | "merge-conflict" | "editing" | "missing-local" | "unknown";
export type SyncLogEntry = { time: string; operation: SyncOperation; outcome: SyncOutcome; reason?: SyncReason; conflictArea?: "shopping" | "recipes" | "tasks"; status?: number; revision?: number; remoteRevision?: number; durationMs?: number; online?: boolean };
type StorageLike = Pick<Storage, "getItem" | "setItem">;

const key = "nest-sync-log-v1";
const limit = 200;
const operations = ["connect", "save", "refresh", "load-cloud", "merge", "network"];
const outcomes = ["started", "success", "error", "conflict", "deferred", "unavailable"];
const reasons = ["http", "session", "timeout", "network", "aborted", "invalid-response", "storage", "merge-conflict", "editing", "missing-local", "unknown"];

function sanitize(value: unknown): SyncLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.time !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw.time) || !operations.includes(String(raw.operation)) || !outcomes.includes(String(raw.outcome))) return null;
  const entry: SyncLogEntry = { time: raw.time, operation: raw.operation as SyncOperation, outcome: raw.outcome as SyncOutcome };
  if (typeof raw.reason === "string" && reasons.includes(raw.reason)) entry.reason = raw.reason as SyncReason;
  for (const field of ["status", "revision", "remoteRevision", "durationMs"] as const) {
    const number = raw[field];
    if (typeof number === "number" && Number.isSafeInteger(number) && number >= 0 && number <= 1_000_000_000) entry[field] = number;
  }
  if (raw.conflictArea === "shopping" || raw.conflictArea === "recipes" || raw.conflictArea === "tasks") entry.conflictArea = raw.conflictArea;
  if (typeof raw.online === "boolean") entry.online = raw.online;
  return entry;
}

export function createSyncLog(getStorage: () => StorageLike) {
  let memory: SyncLogEntry[] = [];
  let persistent = true;
  let loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const value: unknown = JSON.parse(getStorage().getItem(key) ?? "[]");
      if (Array.isArray(value)) memory = value.map(sanitize).filter((entry): entry is SyncLogEntry => entry !== null).slice(-limit);
    } catch { persistent = false; }
  }
  return {
    append(details: Omit<SyncLogEntry, "time">) {
      load();
      const entry = sanitize({ ...details, time: new Date().toISOString() });
      if (!entry) return;
      memory = [...memory, entry].slice(-limit);
      try { getStorage().setItem(key, JSON.stringify(memory)); persistent = true; } catch { persistent = false; }
    },
    snapshot() { load(); return { persistent, entries: [...memory] }; },
  };
}

export const syncLog = createSyncLog(() => window.localStorage);

export function syncErrorDetails(error: unknown): { reason: SyncReason; status?: number } {
  if (error && typeof error === "object") {
    const value = error as { name?: unknown; status?: unknown };
    const status = typeof value.status === "number" && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599 ? value.status : undefined;
    if (value.name === "SessionExpiredError") return { reason: "session", status };
    if (status !== undefined) return { reason: "http", status };
    if (value.name === "TimeoutError") return { reason: "timeout" };
    if (value.name === "AbortError") return { reason: "aborted" };
    if (value.name === "TypeError") return { reason: "network" };
    if (value.name === "QuotaExceededError" || value.name === "SecurityError") return { reason: "storage" };
    if (value.name === "InvalidSyncResponseError" || value.name === "SyntaxError") return { reason: "invalid-response" };
  }
  return { reason: "unknown" };
}
