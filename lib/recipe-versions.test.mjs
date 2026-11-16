import assert from "node:assert/strict";
import test from "node:test";
import { combineRecipeVersions } from "./recipe-versions.ts";

const ingredient = (id, name, detail) => ({ id, name, detail, icon: "bread" });
const base = [ingredient("milk", "Milch", "100 ml"), ingredient("sugar", "Zucker", "100 g")];
const step = { id: "mix", text: "Alles mischen.", ingredientIds: ["milk", "sugar"] };
const milk = { id: "v-milk", title: "Mit Sahne", ingredients: [ingredient("cream", "Sahne", "100 ml"), base[1]], steps: [{ ...step, ingredientIds: ["cream", "sugar"] }] };
const sugar = { id: "v-sugar", title: "Weniger Zucker", ingredients: [base[0], ingredient("sugar", "Zucker", "60 g")], steps: [step] };

test("unabhängige Zutatenvarianten lassen sich kombinieren", () => {
  const result = combineRecipeVersions(base, [step], [milk, sugar]);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.ingredients.map(({ name, detail }) => [name, detail]), [["Sahne", "100 ml"], ["Zucker", "60 g"]]);
  assert.deepEqual(result.steps[0].ingredientIds, ["cream", "sugar"]);
});

test("zwei Änderungen derselben Zutat bleiben inkompatibel", () => {
  const otherSugar = { id: "v-sugar-2", title: "Noch weniger Zucker", ingredients: [base[0], ingredient("sugar", "Zucker", "25 g")], steps: [step] };
  assert.equal(combineRecipeVersions(base, [step], [sugar, otherSugar]).compatible, false);
});

test("zwei Änderungen desselben Schritts bleiben inkompatibel", () => {
  const first = { id: "a", title: "A", ingredients: base, steps: [{ ...step, text: "Kurz mischen." }] };
  const second = { id: "b", title: "B", ingredients: base, steps: [{ ...step, text: "Lange mischen." }] };
  assert.equal(combineRecipeVersions(base, [step], [first, second]).compatible, false);
});

test("importierte Varianten ohne gemeinsame IDs erkennen unveränderte Zutaten", () => {
  const imported = { id: "c", title: "Import", ingredients: [ingredient("new-milk", "Milch", "100 ml"), ingredient("new-sugar", "Zucker", "60 g")], steps: [{ id: "new-step", text: step.text, ingredientIds: ["new-milk", "new-sugar"] }] };
  const result = combineRecipeVersions(base, [step], [imported]);
  assert.equal(result.compatible, true);
  assert.equal(result.ingredients[1].id, "sugar");
  assert.deepEqual(result.steps[0].ingredientIds, ["milk", "sugar"]);
});

test("importierte Schrittmengen folgen den zugeordneten Zutaten-IDs", () => {
  const imported = { id: "amounts", title: "Teilmenge", ingredients: [ingredient("new-milk", "Milch", "100 ml"), base[1]], steps: [{ ...step, ingredientIds: ["new-milk", "sugar"], ingredientAmounts: { "new-milk": "50 ml" } }] };
  const result = combineRecipeVersions(base, [step], [imported]);
  assert.deepEqual(result.steps[0].ingredientAmounts, { milk: "50 ml" });
  const other = { ...imported, id: "other", steps: [{ ...imported.steps[0], ingredientAmounts: { "new-milk": "25 ml" } }] };
  assert.equal(combineRecipeVersions(base, [step], [imported, other]).compatible, false);
});
