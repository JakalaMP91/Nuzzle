import assert from "node:assert/strict";
import test from "node:test";
import { findShoppingNameMatch } from "./shopping-similarity.ts";

test("exakte Treffer haben Vorrang vor ähnlichen", () => {
  assert.deepEqual(findShoppingNameMatch("Milch", ["Vollmilch", "Milch"]), { kind: "exact", name: "Milch" });
});

test("erkennt deutsche Produktvarianten und Pluralformen", () => {
  assert.deepEqual(findShoppingNameMatch("Milch", ["Vollmilch"]), { kind: "similar", name: "Vollmilch" });
  assert.deepEqual(findShoppingNameMatch("Vollmilch", ["Milch"]), { kind: "similar", name: "Milch" });
  assert.deepEqual(findShoppingNameMatch("Tomate", ["Bio-Tomaten"]), { kind: "similar", name: "Bio-Tomaten" });
  assert.deepEqual(findShoppingNameMatch("Karotte", ["Karotten"]), { kind: "similar", name: "Karotten" });
  assert.deepEqual(findShoppingNameMatch("Mehl", ["Weizenmehl"]), { kind: "similar", name: "Weizenmehl" });
});

test("erkennt einen Tippfehler bei längeren Namen", () => {
  assert.deepEqual(findShoppingNameMatch("Kartoffel", ["Kartofel"]), { kind: "similar", name: "Kartofel" });
});

test("vermeidet bloße Wortbestandteile und Kategorien als Treffer", () => {
  for (const name of ["Joghurt", "Milchreis", "Haferdrink", "Sahne"]) {
    assert.equal(findShoppingNameMatch("Milch", [name]), null, name);
  }
  assert.equal(findShoppingNameMatch("Apfel", ["Apfelsaft"]), null);
  assert.equal(findShoppingNameMatch("", ["Milch"]), null);
});
