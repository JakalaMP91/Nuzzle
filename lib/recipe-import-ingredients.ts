import { parseRecipeQuantity } from "./recipe-quantity.ts";
type Ingredient = { name: string; detail: string; optional?: boolean };
type IngredientAmount = { ingredientIndex: number; detail: string };
type Step = { ingredientIndexes: number[]; ingredientAmounts?: IngredientAmount[] };
const nameKey = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

// Convert only exact unit relationships. An EL of flour has no fixed gram weight.
function measurement(detail: string) {
  const parsed = parseRecipeQuantity(detail);
  if (!parsed.amount || !parsed.unit) return null;
  const conversions: Record<string, { dimension: string; factor: number }> = {
    g: { dimension: "mass", factor: 1 }, kg: { dimension: "mass", factor: 1000 },
    ml: { dimension: "volume", factor: 1 }, l: { dimension: "volume", factor: 1000 },
    TL: { dimension: "spoon", factor: 1 }, EL: { dimension: "spoon", factor: 3 },
  };
  // Loose units are kept in the remainder by the quantity parser. Keep them
  // separate from ordinary pieces and from other loose units.
  const looseUnit = parsed.unit === "Stk" ? parsed.remainder.match(/^(Zehen?|Scheiben?|Prisen?|Bund|Tassen?|cups?)\b/i)?.[1].toLocaleLowerCase("de-DE").replace(/en$/, "e").replace(/n$/, "") : undefined;
  const conversion = conversions[parsed.unit] ?? { dimension: `${parsed.unit}:${looseUnit ?? ""}`, factor: 1 };
  return { ...parsed, amount: parsed.amount, unit: parsed.unit, ...conversion };
}

function sumDetails(details: string[]): string {
  const nonempty = details.map((detail) => detail.trim()).filter(Boolean);
  if (nonempty.length === 1) return nonempty[0];
  const measured = nonempty.flatMap((detail) => detail.split(/\s+\+\s+(?=(?:\d|[¼½¾]))/u)).map((detail) => ({ detail, value: measurement(detail) }));
  // An explicitly labelled total is not another portion to add to its parts.
  const total = measured.find(({ detail, value }) => value && /\b(?:insgesamt|gesamt|gesamtmenge)\b/i.test(detail));
  if (total) return total.detail;
  const groups = new Map<string, { amount: number; unit: NonNullable<ReturnType<typeof measurement>>["unit"]; factor: number; notes: string[] }>();
  const unmeasured: string[] = [];
  for (const { detail, value } of measured) {
    if (!value) { if (detail.trim()) unmeasured.push(detail); continue; }
    const group = groups.get(value.dimension);
    if (group) { group.amount += value.amount * value.factor / group.factor; group.notes.push(value.remainder); }
    else groups.set(value.dimension, { amount: value.amount, unit: value.unit, factor: value.factor, notes: [value.remainder] });
  }
  if (!groups.size) return unique(unmeasured).join(" · ");
  const quantities = [...groups.values()].map((group) => {
    const amount = group.amount.toLocaleString("de-DE", { maximumFractionDigits: 6, useGrouping: false });
    return [`${amount} ${group.unit}`, ...unique(group.notes)].join(" · ");
  });
  // Unlike dimensions remain an explicit sum, rather than a fabricated conversion.
  return [quantities.join(" + "), ...unique(unmeasured)].join(" · ");
}

export function normalizeImportedIngredients<I extends Ingredient, S extends Step>(ingredients: I[], steps: S[]) {
  const expanded: I[] = [];
  const indexMap = ingredients.map((entry) => {
    const detail = entry.detail.replace(/^\s*(?:menge|quantity)\s*:\s*/i, "").trim();
    const fromName = /^\s*(?:\d|[¼½¾])/.test(entry.name) ? parseRecipeQuantity(entry.name) : null;
    const fromDetail = parseRecipeQuantity(detail);
    const otherUnit = fromName?.unit === "Stk" ? fromName.remainder.match(/^(Zehen?|Scheiben?|Prisen?|Bund|Tassen?|cups?)\s+(.+)$/i) : null;
    const ingredient = fromName?.amount && fromName.remainder && !fromDetail.amount
      ? { ...entry, name: otherUnit?.[2] ?? fromName.remainder, detail: [`${fromName.amount.toLocaleString("de-DE", { maximumFractionDigits: 6, useGrouping: false })} ${fromName.unit}`, otherUnit?.[1], detail].filter(Boolean).join(" · ") }
      : { ...entry, detail };
    const names = ingredient.name.split(/\s*\+\s*|\s+&\s+/u).map((name) => name.trim()).filter(Boolean);
    const parts = names.length > 1 ? names : [ingredient.name];
    const indexes = parts.map((name, partIndex) => {
      const index = expanded.length;
      const hasAmount = Boolean(measurement(ingredient.detail));
      expanded.push({ ...ingredient, name, detail: partIndex > 0 && hasAmount ? "" : ingredient.detail });
      return index;
    });
    return indexes;
  });
  const normalized: I[] = [];
  const groupedDetails: string[][] = [];
  const groupIndexes = new Map<string, number>();
  const expandedIndexMap = expanded.map((ingredient) => {
    // An optional extra and a required amount remain distinct choices.
    const key = `${nameKey(ingredient.name)}:${Boolean(ingredient.optional)}`;
    const existing = groupIndexes.get(key);
    if (existing !== undefined) { groupedDetails[existing].push(ingredient.detail); return existing; }
    const index = normalized.length;
    normalized.push({ ...ingredient }); groupedDetails.push([ingredient.detail]); groupIndexes.set(key, index);
    return index;
  });
  normalized.forEach((ingredient, index) => { ingredient.detail = sumDetails(groupedDetails[index]); });
  const finalIndexMap = indexMap.map((indexes) => [...new Set(indexes.map((index) => expandedIndexMap[index]))]);
  return {
    ingredients: normalized,
    steps: steps.map((step) => {
      const explicit = new Map<number, string[]>();
      for (const amount of step.ingredientAmounts ?? []) {
        // A combined "Salz & Pfeffer" quantity is not duplicated on both products.
        const index = indexMap[amount.ingredientIndex]?.[0];
        if (index === undefined || !amount.detail.trim()) continue;
        const mapped = expandedIndexMap[index];
        explicit.set(mapped, [...(explicit.get(mapped) ?? []), amount.detail.trim()]);
      }
      const inferred = new Map<number, string[]>();
      for (const sourceIndex of new Set(step.ingredientIndexes)) {
        for (const index of indexMap[sourceIndex] ?? []) {
          const mapped = expandedIndexMap[index];
          // Preserve known original portions when formerly separate ingredient
          // rows are combined. A single total reused by steps is never divided.
          if (groupedDetails[mapped].length > 1 && expanded[index].detail && !explicit.has(mapped)) {
            inferred.set(mapped, [...(inferred.get(mapped) ?? []), expanded[index].detail]);
          }
        }
      }
      const ingredientAmounts = [...new Map([...inferred, ...explicit])].map(([ingredientIndex, details]) => ({ ingredientIndex, detail: sumDetails(details) }));
      return { ...step, ingredientIndexes: [...new Set([...step.ingredientIndexes.flatMap((index) => finalIndexMap[index] ?? []), ...explicit.keys()])], ...(ingredientAmounts.length || step.ingredientAmounts ? { ingredientAmounts } : {}) };
    }),
    indexMap: finalIndexMap,
  };
}
