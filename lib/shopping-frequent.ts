// Group only clearly matching product names; quantities and details remain those of the latest purchase.
export const frequentProductKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
export function frequentPurchases<T extends { name: string }>(history: { item: T; checkedAt: number }[]) {
  const groups = new Map<string, { key: string; item: T; count: number; last: number }>();
  for (const record of history) {
    const key = frequentProductKey(record.item.name);
    if (!key || !Number.isFinite(record.checkedAt)) continue;
    const group = groups.get(key);
    if (!group) groups.set(key, { key, item: record.item, count: 1, last: record.checkedAt });
    else { group.count++; if (record.checkedAt > group.last) { group.last = record.checkedAt; group.item = record.item; } }
  }
  return [...groups.values()].filter(group => group.count >= 2).sort((a, b) => b.count - a.count || b.last - a.last || a.key.localeCompare(b.key, "de"));
}
