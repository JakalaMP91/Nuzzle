import assert from "node:assert/strict";
import test from "node:test";
import { isPantryIngredient } from "./pantry-match.ts";

test("erkennt bekannte Immer-da-Produkte auch mit beschreibenden Zusätzen", () => {
  const pantry = ["Salz", "Pfeffer", "Olivenöl", "Milch"];
  assert.equal(isPantryIngredient("Salz aus der Mühle", pantry), true);
  assert.equal(isPantryIngredient("Schwarzer Pfeffer", pantry), true);
  assert.equal(isPantryIngredient("Vollmilch", pantry), true);
  assert.equal(isPantryIngredient("Olivenöl extra vergine", pantry), true);
  assert.equal(isPantryIngredient("Salzstangen", pantry), false);
  assert.equal(isPantryIngredient("Pancetta", pantry), false);
});
