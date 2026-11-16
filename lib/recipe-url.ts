export function normalizeRecipeUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
    if (host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
