import test from "node:test";
import assert from "node:assert/strict";
import { scaleIngredientDetail, stepIngredientDetail } from "./recipe-step-amounts.ts";
test("skaliert Teilmengen und setzt niemals mehrfach die Gesamtmenge ein", () => {
  const ingredient = { id: "butter", detail: "150 g" };
  const a = { ingredientIds: ["butter"], ingredientAmounts: { butter: "50 g" } };
  const b = { ingredientIds: ["butter"], ingredientAmounts: { butter: "100 g" } };
  assert.equal(stepIngredientDetail(a, ingredient, [a, b], 2), "100 g");
  assert.equal(stepIngredientDetail(b, ingredient, [a, b], 2), "200 g");
  assert.equal(stepIngredientDetail({ ingredientIds: ["butter"] }, ingredient, [a, b], 2), "Teilmenge siehe Anleitung");
  assert.equal(stepIngredientDetail({ ingredientIds: ["butter"] }, ingredient, [a], 2), "300 g");
  assert.equal(scaleIngredientDetail("50 g + 2 EL", 2), "100 g + 4 EL");
});
