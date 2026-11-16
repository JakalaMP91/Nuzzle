export const shoppingUnits = ["Stk", "g", "kg", "ml", "l", "EL", "TL", "Packung", "Päckchen", "Dose", "Becher"] as const;
export type ShoppingUnit = typeof shoppingUnits[number];

const unitNames: Record<string, ShoppingUnit> = {
  stk: "Stk", stück: "Stk", stueck: "Stk", st: "Stk",
  g: "g", gramm: "g", kg: "kg", kilogramm: "kg", ml: "ml", milliliter: "ml", l: "l", liter: "l",
  el: "EL", esslöffel: "EL", essloeffel: "EL", tl: "TL", teelöffel: "TL", teeloeffel: "TL",
  packung: "Packung", packungen: "Packung", päckchen: "Päckchen", paeckchen: "Päckchen",
  dose: "Dose", dosen: "Dose", becher: "Becher",
};

export function parsePositiveAmount(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(clean)) return null;
  const amount = Number(clean.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseRecipeQuantity(detail: string): { amount?: number; unit?: ShoppingUnit; remainder: string } {
  const original = detail.trim();
  const metric = original.match(/\((\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\)/i);
  if (metric && /^\s*(?:ca\.?\s+)?\d/.test(original) && !/^\s*(?:ca\.?\s+)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)(?:\s|$|[·,(])/i.test(original) && !/\b(?:je|pro)\b|à/i.test(original.slice(0, metric.index))) {
    const amount = parsePositiveAmount(metric[1]);
    const unit = unitNames[metric[2].toLowerCase()];
    if (amount && unit) return { amount, unit, remainder: original.replace(metric[0], "").trim() };
  }
  const match = original.match(/^(?:(ca\.?|etwa|ungefähr)\s+)?(\d+\s*\d+\s*\/\s*\d+|\d+\s*[½¼¾]|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾])\s*(Stk\.?|Stück|Stueck|St\.?|g|Gramm|kg|Kilogramm|ml|Milliliter|l|Liter|EL|Esslöffel|Essloeffel|TL|Teelöffel|Teeloeffel|Packungen?|Päckchen|Paeckchen|Dosen?|Becher)(?=$|\s|[·,;()])/i);
  const loose = !match ? original.match(/^(?:(ca\.?|etwa|ungefähr)\s+)?(\d+\s+\d+\s*\/\s*\d+|\d+\s*[½¼¾]|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾])(?=$|\s)/i) : null;
  const chosen = match ?? loose;
  if (!chosen) return { remainder: original };
  const rawAmount = chosen[2].trim();
  const mixed = rawAmount.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  const compact = rawAmount.replace(/\s/g, "");
  const glyph = compact.match(/^(\d*)([½¼¾])$/);
  const amount = mixed ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : glyph ? Number(glyph[1] || 0) + ({ "½": .5, "¼": .25, "¾": .75 } as Record<string, number>)[glyph[2]] : compact.includes("/") ? (() => { const [top, bottom] = compact.split("/").map(Number); return bottom ? top / bottom : NaN; })() : parsePositiveAmount(compact);
  if (!match) {
    const rest = original.slice(chosen[0].length).replace(/^[\s·,;]+/, "").trim();
    if (!amount || !Number.isFinite(amount) || /^[%°–-]/.test(rest)) return { remainder: original };
    return { amount, unit: "Stk", remainder: [chosen[1], rest].filter(Boolean).join(" · ") };
  }
  const unit = unitNames[match[3].replace(/\.$/, "").toLocaleLowerCase("de-DE")];
  if (!amount || !Number.isFinite(amount) || !unit) return { remainder: original };
  const rest = original.slice(match[0].length).replace(/^[\s·,;]+/, "").trim();
  return { amount, unit, remainder: [match[1], rest].filter(Boolean).join(" · ") };
}

export function formatRecipeQuantity(amount: number | undefined, unit: ShoppingUnit | undefined, remainder: string): string {
  return [amount && unit ? `${amount.toLocaleString("de-DE", { useGrouping: false, maximumFractionDigits: 6 })} ${unit}` : "", remainder.trim()].filter(Boolean).join(" · ");
}

// Only scale leading ingredient quantities, never numbers embedded in free text.
export function scaleRecipeDetail(detail: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return detail;
  const number = "(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*[½¼¾]|\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?|[½¼¾])";
  const pattern = new RegExp(`^(\\s*(?:(?:ca\\.?|etwa|ungefähr)\\s+)?)(${number})(?:\\s*([–-])\\s*(${number}))?(?=$|[\\sA-Za-zÄÖÜäöüß·,;(])`, "i");
  const match = detail.match(pattern);
  if (!match) return detail;
  if (/^\s*[%°]/.test(detail.slice(match[0].length))) return detail;
  const parse = (raw: string): number => {
    const clean = raw.replace(/\s/g, "");
    const fraction = clean.match(/^(\d*)([½¼¾])$/);
    if (fraction) return Number(fraction[1] || 0) + ({ "½": .5, "¼": .25, "¾": .75 } as Record<string, number>)[fraction[2]];
    const mixed = raw.trim().match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    if (clean.includes("/")) { const [a, b] = clean.split("/").map(Number); return a / b; }
    return Number(clean.replace(",", "."));
  };
  const first = parse(match[2]), second = match[4] ? parse(match[4]) : null;
  if (!Number.isFinite(first) || first <= 0 || (second !== null && (!Number.isFinite(second) || second <= 0))) return detail;
  const format = (value: number) => (value * factor).toLocaleString("de-DE", { maximumFractionDigits: 3, useGrouping: false });
  return `${match[1]}${format(first)}${second === null ? "" : `${match[3]}${format(second)}`}${detail.slice(match[0].length)}`;
}
