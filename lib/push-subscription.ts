export type StoredPushSubscription = { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } };

// Browser-selected push services only. Never send credentials or encrypted
// payloads to an arbitrary URL supplied in an API request.
export function allowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    if (url.hostname === "fcm.googleapis.com") return !url.search && /^\/(?:fcm\/send|wp)\/[A-Za-z0-9:_-]+$/.test(url.pathname);
    if (url.hostname === "updates.push.services.mozilla.com") return !url.search && /^\/wpush\/v[12]\/[A-Za-z0-9_-]+$/.test(url.pathname);
    if (url.hostname === "web.push.apple.com") return !url.search && /^\/[A-Za-z0-9/_-]+$/.test(url.pathname) && url.pathname.length > 1;
    return /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname) && /^\/w\/?$/.test(url.pathname) && Boolean(url.search);
  } catch { return false; }
}

function keyBytes(value: unknown, size: number): boolean {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false;
  try { return atob(value.replace(/-/g, "+").replace(/_/g, "/")).length === size; } catch { return false; }
}

export function parsePushSubscription(value: unknown): StoredPushSubscription | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<StoredPushSubscription>;
  if (!allowedPushEndpoint(input.endpoint) || !input.keys || !keyBytes(input.keys.p256dh, 65) || !keyBytes(input.keys.auth, 16)) return null;
  if (input.expirationTime !== undefined && input.expirationTime !== null && (!Number.isFinite(input.expirationTime) || input.expirationTime <= 0)) return null;
  return { endpoint: input.endpoint, expirationTime: input.expirationTime ?? null, keys: { p256dh: input.keys.p256dh, auth: input.keys.auth } };
}
