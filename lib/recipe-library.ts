type LibraryRecipe = { id: string; title: string; createdAt?: number; createdBy?: string };
export type RecipeSort = "alphabetical" | "chronological";
export function sortRecipes<T extends LibraryRecipe>(recipes: T[], mode: RecipeSort): T[] {
  if (mode === "alphabetical") return [...recipes].sort((a, b) => a.title.localeCompare(b.title, "de", { numeric: true, sensitivity: "base" }));
  const timestamp = (recipe: T) => recipe.createdAt ?? (/^\d{13}$/.test(recipe.id) ? Number(recipe.id) : 0);
  return [...recipes].sort((a, b) => timestamp(b) - timestamp(a));
}
export function unfamiliarRecipeIds(recipes: LibraryRecipe[], seen: string[], viewer: string | null): string[] {
  if (!viewer) return [];
  const known = new Set(seen);
  return recipes.filter((recipe) => (recipe.createdBy === "Markus" || recipe.createdBy === "Bettina") && recipe.createdBy !== viewer && !known.has(recipe.id)).map((recipe) => recipe.id);
}
