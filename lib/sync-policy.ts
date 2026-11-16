export type SyncBase = { revision: number; data: string };
export type ReconnectDecision = "choose" | "unchanged" | "pull" | "defer-pull" | "conflict";
export function decideReconnect(saved: SyncBase | null, current: string, remoteRevision: number, hasRemoteData: boolean, suspendPull: boolean): ReconnectDecision {
  if (!saved || !Number.isSafeInteger(saved.revision) || typeof saved.data !== "string" || !hasRemoteData) return "choose";
  if (remoteRevision === saved.revision) return "unchanged";
  if (current !== saved.data) return "conflict";
  return suspendPull ? "defer-pull" : "pull";
}
export function canPull(saved: SyncBase | null, current: string, busy: boolean, suspendPull: boolean): boolean {
  return Boolean(saved && !busy && !suspendPull && current === saved.data);
}
