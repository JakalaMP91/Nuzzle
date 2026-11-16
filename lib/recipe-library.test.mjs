import test from "node:test";
import assert from "node:assert/strict";
import { sortRecipes, unfamiliarRecipeIds } from "./recipe-library.ts";
test("sortiert deutsch und chronologisch mit stabilen älteren Rezepten", () => {
  const recipes = [{ id: "old", title: "Zopf" }, { id: "1794730000000", title: "Äpfel" }, { id: "new", title: "Brot", createdAt: 1794740000000 }];
  assert.deepEqual(sortRecipes(recipes, "alphabetical").map((r) => r.title), ["Äpfel", "Brot", "Zopf"]);
  assert.deepEqual(sortRecipes(recipes, "chronological").map((r) => r.id), ["new", "1794730000000", "old"]);
});
test("stellt nur unbekannte fremde Rezepte einmal vor", () => {
  const recipes = [{ id: "a", title: "A", createdBy: "Bettina" }, { id: "b", title: "B", createdBy: "Markus" }, { id: "c", title: "C" }];
  assert.deepEqual(unfamiliarRecipeIds(recipes, [], "Markus"), ["a"]);
  assert.deepEqual(unfamiliarRecipeIds(recipes, ["a"], "Markus"), []);
  assert.deepEqual(unfamiliarRecipeIds(recipes, [], null), []);
});
