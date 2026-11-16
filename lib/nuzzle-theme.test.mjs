import test from "node:test";
import assert from "node:assert/strict";
import { readNuzzleTheme, saveNuzzleTheme } from "./nuzzle-theme.ts";

test("Das Farbschema bleibt auf dem jeweiligen Gerät erhalten", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(readNuzzleTheme(storage), "green");
  saveNuzzleTheme(storage, "classic");
  assert.equal(readNuzzleTheme(storage), "classic");
  saveNuzzleTheme(storage, "green");
  assert.equal(readNuzzleTheme(storage), "green");
});

test("Unbekannte Werte und blockierter Speicher gefährden den Start nicht", () => {
  assert.equal(readNuzzleTheme({ getItem: () => "unexpected" }), "green");
  assert.equal(readNuzzleTheme({ getItem: () => { throw Error("blocked"); } }), "green");
  assert.doesNotThrow(() => saveNuzzleTheme({ setItem: () => { throw Error("blocked"); } }, "classic"));
});
