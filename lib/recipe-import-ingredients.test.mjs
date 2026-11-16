import assert from "node:assert/strict";
import test from "node:test";
import { normalizeImportedIngredients } from "./recipe-import-ingredients.ts";

test("trennt Plus-Zutaten und erhält die Zuordnung zum gemeinsamen Schritt", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Äpfel", detail: "1 kg" }, { name: "Zucker + Zimt", detail: "" }, { name: "Milch", detail: "zum Backen · Menge nicht angegeben" }],
    [{ text: "backen", ingredientIndexes: [0, 1, 2] }],
  );
  assert.deepEqual(result.ingredients.map((ingredient) => ingredient.name), ["Äpfel", "Zucker", "Zimt", "Milch"]);
  assert.deepEqual(result.steps[0].ingredientIndexes, [0, 1, 2, 3]);
  assert.deepEqual(result.indexMap, [[0], [1, 2], [3]]);
});

test("verdoppelt eine unklare gemeinsame Mengenangabe nicht", () => {
  const result = normalizeImportedIngredients([{ name: "Salz & Pfeffer", detail: "1 TL" }], [{ ingredientIndexes: [0] }]);
  assert.deepEqual(result.ingredients, [{ name: "Salz", detail: "1 TL" }, { name: "Pfeffer", detail: "" }]);
  assert.deepEqual(result.steps[0].ingredientIndexes, [0, 1]);
});

test("verknüpft im Schritt erneut erwähnte vorhandene Zutaten ohne Dublette", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Butter", detail: "5 EL" }, { name: "Milch", detail: "zum Backen · Menge nicht angegeben" }, { name: "Butter", detail: "wenig" }],
    [{ ingredientIndexes: [0, 1, 2] }],
  );
  assert.deepEqual(result.ingredients.map((ingredient) => ingredient.name), ["Butter", "Milch"]);
  assert.deepEqual(result.steps[0].ingredientIndexes, [0, 1]);
  assert.deepEqual(result.indexMap, [[0], [1], [0]]);
});

test("fasst gleiche Zutaten mit inkompatiblen Einheiten als explizite Summe zusammen", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Butter", detail: "5 EL" }, { name: "Butter", detail: "20 g" }],
    [{ ingredientIndexes: [0] }, { ingredientIndexes: [1] }],
  );
  assert.deepEqual(result.ingredients, [{ name: "Butter", detail: "5 EL + 20 g" }]);
  assert.deepEqual(result.steps.map((step) => step.ingredientIndexes), [[0], [0]]);
  assert.deepEqual(result.steps.map((step) => step.ingredientAmounts), [[{ ingredientIndex: 0, detail: "5 EL" }], [{ ingredientIndex: 0, detail: "20 g" }]]);
});

test("addiert konkrete Teilmengen und erhält deren Verteilung in Arbeitsschritten", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Butter", detail: "100 g · weich" }, { name: "butter", detail: "50 g · zum Bestreichen" }],
    [{ ingredientIndexes: [0] }, { ingredientIndexes: [1] }, { ingredientIndexes: [0, 1, 0] }],
  );
  assert.deepEqual(result.ingredients, [{ name: "Butter", detail: "150 g · weich · zum Bestreichen" }]);
  assert.deepEqual(result.indexMap, [[0], [0]]);
  assert.deepEqual(result.steps.map((step) => step.ingredientAmounts), [
    [{ ingredientIndex: 0, detail: "100 g · weich" }],
    [{ ingredientIndex: 0, detail: "50 g · zum Bestreichen" }],
    [{ ingredientIndex: 0, detail: "150 g · weich · zum Bestreichen" }],
  ]);
});

test("konvertiert Masse, Volumen und Löffel ausschließlich innerhalb ihrer Dimension", () => {
  const result = normalizeImportedIngredients([
    { name: "Mehl", detail: "1 kg" }, { name: "Mehl", detail: "500 g" },
    { name: "Milch", detail: "250 ml" }, { name: "Milch", detail: "0,5 l" },
    { name: "Öl", detail: "1 EL" }, { name: "Öl", detail: "3 TL" },
  ], []);
  assert.deepEqual(result.ingredients.map((entry) => entry.detail), ["1,5 kg", "750 ml", "2 EL"]);
});

test("bewahrt explizite Teilmengen am zusammengefassten Zutatenindex", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Butter", detail: "150 g" }],
    [
      { ingredientIndexes: [0], ingredientAmounts: [{ ingredientIndex: 0, detail: "100 g" }] },
      { ingredientIndexes: [0], ingredientAmounts: [{ ingredientIndex: 0, detail: "50 g" }] },
    ],
  );
  assert.equal(result.ingredients[0].detail, "150 g");
  assert.deepEqual(result.steps.map((entry) => entry.ingredientAmounts), [[{ ingredientIndex: 0, detail: "100 g" }], [{ ingredientIndex: 0, detail: "50 g" }]]);
});

test("explizite Teilmengen haben Vorrang und werden über alte Indizes umgeschlüsselt", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Mehl", detail: "100 g" }, { name: "Butter", detail: "50 g" }, { name: "Mehl", detail: "200 g" }],
    [{ ingredientIndexes: [2], ingredientAmounts: [{ ingredientIndex: 2, detail: "25 g" }, { ingredientIndex: 99, detail: "99 g" }] }],
  );
  assert.deepEqual(result.steps[0].ingredientIndexes, [0]);
  assert.deepEqual(result.steps[0].ingredientAmounts, [{ ingredientIndex: 0, detail: "25 g" }]);
});

test("erfindet bei mehrfach verwendeter Gesamtmenge keine Teilmengen", () => {
  const result = normalizeImportedIngredients([{ name: "Butter", detail: "150 g" }], [{ ingredientIndexes: [0] }, { ingredientIndexes: [0] }]);
  assert.equal(result.ingredients[0].detail, "150 g");
  assert.equal(result.steps[0].ingredientAmounts, undefined);
  assert.equal(result.steps[1].ingredientAmounts, undefined);
});

test("addiert ein ausdrücklich gekennzeichnetes Gesamt nicht erneut mit seinen Teilmengen", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Butter", detail: "150 g · insgesamt" }, { name: "Butter", detail: "100 g" }, { name: "Butter", detail: "50 g" }],
    [{ ingredientIndexes: [1] }, { ingredientIndexes: [2] }],
  );
  assert.equal(result.ingredients[0].detail, "150 g · insgesamt");
  assert.deepEqual(result.steps.map((entry) => entry.ingredientAmounts[0].detail), ["100 g", "50 g"]);
});

test("hält optionale zusätzliche Zutaten von erforderlichen Mengen getrennt", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Zucker", detail: "100 g", optional: false }, { name: "Zucker", detail: "20 g", optional: true }],
    [{ ingredientIndexes: [0, 1] }],
  );
  assert.equal(result.ingredients.length, 2);
  assert.deepEqual(result.steps[0].ingredientIndexes, [0, 1]);
});

test("vervielfacht explizite Mengen von Plus-Zutaten nicht", () => {
  const result = normalizeImportedIngredients(
    [{ name: "Salz & Pfeffer", detail: "1 TL" }],
    [{ ingredientIndexes: [0], ingredientAmounts: [{ ingredientIndex: 0, detail: "1 TL" }] }],
  );
  assert.deepEqual(result.steps[0].ingredientAmounts, [{ ingredientIndex: 0, detail: "1 TL" }]);
});

test("fasst verschiedene lose Einheiten nicht als gewöhnliche Stückzahl zusammen", () => {
  const result = normalizeImportedIngredients([{ name: "Petersilie", detail: "1 Bund" }, { name: "Petersilie", detail: "2 EL" }], []);
  assert.equal(result.ingredients[0].detail, "1 Stk · Bund + 2 EL");
});

test("erhält bereits zusammengesetzte Summen und kann weitere Teilmengen addieren", () => {
  const single = normalizeImportedIngredients([{ name: "Butter", detail: "5 EL + 20 g" }], []);
  assert.equal(single.ingredients[0].detail, "5 EL + 20 g");
  const result = normalizeImportedIngredients([{ name: "Butter", detail: "5 EL + 20 g" }, { name: "Butter", detail: "10 g" }], []);
  assert.equal(result.ingredients[0].detail, "5 EL + 30 g");
});

test("verändert Eingabedaten nicht und erhält frei formulierte unklare Mengen", () => {
  const ingredients = [{ name: "Butter", detail: "100–150 g" }, { name: "Butter", detail: "nach Bedarf" }];
  const before = structuredClone(ingredients);
  const result = normalizeImportedIngredients(ingredients, []);
  assert.equal(result.ingredients[0].detail, "100–150 g · nach Bedarf");
  assert.deepEqual(ingredients, before);
});

test("verschiebt Mengen aus dem Zutatenname in die Mengenangabe", () => {
  const result = normalizeImportedIngredients([{ name: "250 g Mehl", detail: "Type 550" }, { name: "2 Zehen Knoblauch", detail: "" }], []);
  assert.deepEqual(result.ingredients, [{ name: "Mehl", detail: "250 g · Type 550" }, { name: "Knoblauch", detail: "2 Stk · Zehen" }]);
});

test("schreibt große erkannte Mengen ohne mehrdeutigen Tausenderpunkt", () => {
  const result = normalizeImportedIngredients([{ name: "1000 g Mehl", detail: "" }, { name: "Mehl", detail: "500 g" }], []);
  assert.equal(result.ingredients[0].detail, "1500 g");
});
