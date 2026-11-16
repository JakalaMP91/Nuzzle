import { findShoppingNameMatch } from "./shopping-similarity.ts";

function words(value: string) {
  return value.toLocaleLowerCase("de-DE")
    .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function isPantryIngredient(name: string, pantryNames: readonly string[]) {
  if (findShoppingNameMatch(name, pantryNames)) return true;
  const ingredientWords = words(name);
  return pantryNames.some((pantryName) => {
    const pantryWords = words(pantryName);
    if (!pantryWords.length || pantryWords.some((word) => word.length < 4)) return false;
    return pantryWords.every((word) => ingredientWords.includes(word));
  });
}
