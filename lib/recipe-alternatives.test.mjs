import assert from "node:assert/strict";
import test from "node:test";
import { addSourceIngredientAlternatives } from "./recipe-alternatives.ts";

test("macht aus den Carbonara-Zutaten echte Varianten", () => {
  const recipe = {
    ingredients: [
      { name: "Pancetta oder Guanciale", detail: "150 g am Stück - alternativ fetthaltiger Bauchspeck", optional: false },
      { name: "Parmesan oder Pecorino", detail: "50 g am Stück - alternativ halb/halb", optional: false },
      { name: "Salz aus der Mühle", detail: "", optional: false },
    ],
    versions: [], variants: [{ title: "Speck", replacesIngredientIndexes: [0], alternatives: [{ label: "Guanciale am Stück (alternativ fetthaltiger Bauchspeck)", ingredients: [{ name: "Guanciale", detail: "150 g; alternativ Bauchspeck", optional: false }] }] }],
  };
  addSourceIngredientAlternatives(recipe, [
    "150 g Pancetta oder Guanciale am Stück (alternativ fetthaltiger Bauchspeck)",
    "50 g Parmesan oder Pecorino am Stück (alternativ halb/halb)",
    "Salz aus der Mühle",
  ]);
  assert.equal(recipe.ingredients[0].name, "Pancetta");
  assert.equal(recipe.ingredients[1].name, "Parmesan");
  assert.deepEqual(recipe.variants.map((variant) => variant.alternatives.map((entry) => entry.label)), [
    ["Guanciale", "Fetthaltiger Bauchspeck"],
    ["Pecorino", "Parmesan & Pecorino (halb/halb)"],
  ]);
  assert.deepEqual(recipe.variants[1].alternatives[1].ingredients.map((entry) => entry.detail), ["25 g am Stück", "25 g am Stück"]);
});
