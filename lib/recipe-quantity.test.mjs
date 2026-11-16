import assert from "node:assert/strict";
import test from "node:test";
import { formatRecipeQuantity, parsePositiveAmount, parseRecipeQuantity, scaleRecipeDetail } from "./recipe-quantity.ts";

test("Menge und Einheit aus typischen deutschen Rezeptangaben erkennen", () => {
  assert.deepEqual(parseRecipeQuantity("500 g · Type 550"), { amount: 500, unit: "g", remainder: "Type 550" });
  assert.deepEqual(parseRecipeQuantity("1,5 l Milch"), { amount: 1.5, unit: "l", remainder: "Milch" });
  assert.deepEqual(parseRecipeQuantity("2 EL"), { amount: 2, unit: "EL", remainder: "" });
  assert.deepEqual(parseRecipeQuantity("1 Päckchen · trocken"), { amount: 1, unit: "Päckchen", remainder: "trocken" });
  assert.deepEqual(parseRecipeQuantity("½ kg"), { amount: 0.5, unit: "kg", remainder: "" });
  assert.deepEqual(parseRecipeQuantity("2 Zehen · gehackt"), { amount: 2, unit: "Stk", remainder: "Zehen · gehackt" });
  assert.deepEqual(parseRecipeQuantity("1 1/2 TL"), { amount: 1.5, unit: "TL", remainder: "" });
  assert.deepEqual(parseRecipeQuantity("1 cup (240 ml)"), { amount: 240, unit: "ml", remainder: "1 cup" });
  assert.deepEqual(parseRecipeQuantity("2 Dosen à 400 g"), { amount: 2, unit: "Dose", remainder: "à 400 g" });
});

test("Portionsfaktor skaliert Zutaten mit Dezimalzahlen, Brüchen und Bereichen", () => {
  assert.equal(scaleRecipeDetail("500 g · Type 550", .5), "250 g · Type 550");
  assert.equal(scaleRecipeDetail("ca. 1,5 l", 2), "ca. 3 l");
  assert.equal(scaleRecipeDetail("1 1/2 EL", 2), "3 EL");
  assert.equal(scaleRecipeDetail("½ kg", .5), "0,25 kg");
  assert.equal(scaleRecipeDetail("2–3 Stück", .5), "1–1,5 Stück");
  assert.equal(scaleRecipeDetail("1 Dose à 400 g", 2), "2 Dose à 400 g");
  assert.equal(scaleRecipeDetail("3", .5), "1,5");
});
test("nicht erkennbare Mengen und der Originalwert bleiben erhalten", () => {
  assert.equal(scaleRecipeDetail("nach Bedarf", .5), "nach Bedarf");
  assert.equal(scaleRecipeDetail("1/0 TL", 2), "1/0 TL");
  assert.equal(scaleRecipeDetail("2 % Fett", 2), "2 % Fett");
  assert.equal(scaleRecipeDetail("½ kg", 1), "½ kg");
});

test("mehrdeutige Mengen bleiben als Freitext erhalten", () => {
  assert.deepEqual(parseRecipeQuantity("2–3 Stück"), { remainder: "2–3 Stück" });
  assert.deepEqual(parseRecipeQuantity("nach Bedarf"), { remainder: "nach Bedarf" });
  assert.equal(parsePositiveAmount("0"), null);
  assert.equal(parsePositiveAmount("1,5"), 1.5);
});

test("strukturierte Rezeptangaben bleiben deutsch formatiert", () => {
  assert.equal(formatRecipeQuantity(1.5, "l", "frisch"), "1,5 l · frisch");
  assert.equal(formatRecipeQuantity(1000, "g", ""), "1000 g");
  assert.equal(parseRecipeQuantity(formatRecipeQuantity(1000, "g", "")).amount, 1000);
});
