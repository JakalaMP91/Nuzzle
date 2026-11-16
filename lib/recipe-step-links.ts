type Ingredient = { name: string };
type Step = { text: string; ingredientIndexes: number[] };

// Only repair the characteristic "all ingredients on step one" error when
// a conventional text source explicitly names a very small subset. Grouped
// photos are deliberately excluded by the caller because their layout matters.
export function repairSuspiciousFirstStep<I extends Ingredient, S extends Step>(ingredients: I[], steps: S[]): S[] {
  if (ingredients.length < 5 || steps.length < 2) return steps;
  const first = steps[0];
  const links = [...new Set(first.ingredientIndexes.filter((index) => index >= 0 && index < ingredients.length))];
  if (links.length < 5 || links.length / ingredients.length < .8 || /\b(?:alle|alles|sämtliche|übrige|rest|zutaten|mischung|zusammen)\b/i.test(first.text)) return steps;
  const text = first.text.toLocaleLowerCase("de-DE");
  const explicitlyNamed = links.filter((index) => ingredients[index].name.toLocaleLowerCase("de-DE").split(/[^\p{L}\p{N}]+/u).filter((part) => part.length >= 4).some((part) => text.includes(part)));
  if (explicitlyNamed.length < 1 || explicitlyNamed.length > 2 || explicitlyNamed.length * 2 >= links.length) return steps;
  return [{ ...first, ingredientIndexes: explicitlyNamed }, ...steps.slice(1)];
}
