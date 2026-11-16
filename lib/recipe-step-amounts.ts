import { scaleRecipeDetail } from "./recipe-quantity.ts";
type Step = { ingredientIds: string[]; ingredientAmounts?: Record<string, string> };
// Explicit sums contain incompatible units; scale every listed component.
export function scaleIngredientDetail(detail: string, factor: number): string {
  return detail.split(/ (\+) /).map((part) => part === "+" ? part : scaleRecipeDetail(part, factor)).join(" ").replace(/\s+/g, " ").trim();
}
export function stepIngredientDetail(step: Step, ingredient: { id: string; detail: string }, steps: Step[], factor: number): string {
  const explicit = step.ingredientAmounts?.[ingredient.id];
  if (explicit?.trim()) return scaleIngredientDetail(explicit, factor);
  if (steps.filter((entry) => entry.ingredientIds.includes(ingredient.id)).length > 1) return "Teilmenge siehe Anleitung";
  return scaleIngredientDetail(ingredient.detail, factor);
}
