// Calendar-day groups use Berlin dates, including daylight-saving changes.
type RecentItem = { id: number; lastPurchasedAt?: number };
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
function dayNumber(timestamp: number): number {
  const parts = Object.fromEntries(dayFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000;
}
export function recentPurchaseTime(item: RecentItem, now: number): number | null {
  // Older completed suggestions used a millisecond timestamp as the shelf ID.
  const value = item.lastPurchasedAt ?? item.id;
  return Number.isFinite(value) && value >= 946684800000 && value <= now ? value : null;
}
export function groupRecentPurchases<T extends RecentItem>(items: T[], now: number): { label: string; items: T[] }[] {
  const buckets = new Map<number, { item: T; at: number | null; index: number }[]>();
  items.forEach((item, index) => {
    const at = recentPurchaseTime(item, now);
    const age = at === null ? 16 : Math.min(15, Math.max(0, dayNumber(now) - dayNumber(at)));
    const bucket = buckets.get(age) ?? [];
    bucket.push({ item, at, index }); buckets.set(age, bucket);
  });
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([age, entries]) => ({
    label: age === 0 ? "Heute" : age === 1 ? "Gestern" : age === 2 ? "Vorgestern" : age <= 14 ? `Vor ${age} Tagen` : age === 15 ? "Vor über 2 Wochen" : "Datum unbekannt",
    items: entries.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || a.index - b.index).map(({ item }) => item),
  }));
}
