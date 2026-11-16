type Ingredient = { name: string; detail: string; optional: boolean };
type Alternative = { label: string; ingredients: Ingredient[] };
type Variant = { title: string; replacesIngredientIndexes: number[]; alternatives: Alternative[] };

function key(value: string) {
  return value.toLocaleLowerCase("de-DE").replaceAll("ä", "a").replaceAll("ö", "o").replaceAll("ü", "u").replaceAll("ß", "ss").replace(/[^a-z0-9]+/g, " ").trim();
}

export function addSourceIngredientAlternatives<T extends { ingredients: Ingredient[]; variants: Variant[]; versions: { title: string; ingredients: Ingredient[] }[] }>(recipe: T, sourceLines: string[]): T {
  if (!sourceLines.length) return recipe;
  const variants = [...recipe.variants];
  sourceLines.forEach((line, sourceIndex) => {
    const quantity = line.match(/^\s*(\d+(?:[,.]\d+)?\s*(?:g|kg|ml|l|EL|TL|Stk\.?|Stück|Prise[n]?))\s+/i)?.[1] ?? "";
    const body = line.slice(quantity.length).trim().replace(/\s*\((alternativ[^)]*)\)/gi, " - $1");
    const [choiceText, ...notes] = body.split(/\s+-\s+/);
    const choices = choiceText.split(/\s+oder\s+/i).map((part) => part.trim());
    if (choices.length !== 2 || !choices[0] || !choices[1]) return;
    const suffix = choices[1].match(/\s+(am Stück|im Stück|frisch gerieben)$/i)?.[1] ?? "";
    const primary = choices[0].replace(/\s+(am Stück|im Stück|frisch gerieben)$/i, "").trim();
    const secondary = choices[1].replace(/\s+(am Stück|im Stück|frisch gerieben)$/i, "").trim();
    if (!primary || !secondary || /\d/.test(primary + secondary)) return;
    const index = recipe.ingredients.findIndex((ingredient) => {
      const text = key(`${ingredient.name} ${ingredient.detail}`);
      return text.includes(key(primary)) || text.includes(key(secondary));
    });
    const ingredientIndex = index >= 0 ? index : recipe.ingredients.length === sourceLines.length ? sourceIndex : -1;
    if (ingredientIndex < 0) return;
    for (let index = variants.length - 1; index >= 0; index--) {
      if (variants[index].replacesIngredientIndexes.includes(ingredientIndex)) variants.splice(index, 1);
    }
    const base = recipe.ingredients[ingredientIndex];
    const detail = [quantity || base.detail.match(/^\s*\d+(?:[,.]\d+)?\s*(?:g|kg|ml|l|EL|TL|Stk\.?|Stück)/i)?.[0]?.trim(), suffix].filter(Boolean).join(" ") || base.detail;
    const candidate = (name: string, amount = detail): Ingredient => ({ name, detail: amount, optional: base.optional });
    const alternatives: Alternative[] = [{ label: secondary, ingredients: [candidate(secondary)] }];
    for (const note of notes) {
      const alternative = note.match(/^alternativ\s+(.+)$/i)?.[1]?.trim();
      if (!alternative) continue;
      if (/^halb\s*\/\s*halb$/i.test(alternative) && quantity) {
        const parsed = quantity.match(/^(\d+(?:[,.]\d+)?)\s*(.+)$/);
        if (parsed) {
          const half = `${Number(parsed[1].replace(",", ".")) / 2} ${parsed[2]}${suffix ? ` ${suffix}` : ""}`;
          alternatives.push({ label: `${primary} & ${secondary} (halb/halb)`, ingredients: [candidate(primary, half), candidate(secondary, half)] });
        }
      } else if (!/\b(?:nach Belieben|zum Servieren)\b/i.test(alternative)) {
        alternatives.push({ label: alternative[0].toLocaleUpperCase("de-DE") + alternative.slice(1), ingredients: [candidate(alternative)] });
      }
    }
    const alreadyCovered = (alternative: Alternative) => recipe.versions.some((version) => alternative.ingredients.every((entry) => version.ingredients.some((ingredient) => key(ingredient.name) === key(entry.name) && key(ingredient.detail) === key(entry.detail))))
      || variants.some((variant) => variant.alternatives.some((entry) => entry.label === alternative.label));
    const missing = alternatives.filter((alternative) => !alreadyCovered(alternative));
    if (!missing.length) return;
    if (/\boder\b|\balternativ\b/i.test(`${base.name} ${base.detail}`)) {
      recipe.ingredients[ingredientIndex] = candidate(primary);
    }
    variants.push({ title: primary, replacesIngredientIndexes: [ingredientIndex], alternatives: missing });
  });
  recipe.variants = variants;
  return recipe;
}
