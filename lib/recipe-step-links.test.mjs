import test from "node:test";
import assert from "node:assert/strict";
import { repairSuspiciousFirstStep } from "./recipe-step-links.ts";
const ingredients = ["Mehl", "Milch", "Eier", "Butter", "Zucker", "Salz"].map((name) => ({ name }));
test("korrigiert eine pauschale Zuordnung bei eindeutig genannten Zutaten", () => {
  const steps = [{ text: "Milch und Eier verquirlen", ingredientIndexes: [0, 1, 2, 3, 4, 5] }, { text: "Backen", ingredientIndexes: [] }];
  assert.deepEqual(repairSuspiciousFirstStep(ingredients, steps)[0].ingredientIndexes, [1, 2]);
});
test("erhält alle Zutaten bei ausdrücklicher Sammelanweisung oder unklarer Nennung", () => {
  for (const text of ["Alle Zutaten mit Milch verrühren", "Alles vermengen", "Vermengen"]) {
    const steps = [{ text, ingredientIndexes: [0, 1, 2, 3, 4, 5] }, { text: "Backen", ingredientIndexes: [] }];
    assert.deepEqual(repairSuspiciousFirstStep(ingredients, steps), steps);
  }
});
