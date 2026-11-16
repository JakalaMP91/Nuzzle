import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { readNuzzleTheme, saveNuzzleTheme } from "./nuzzle-theme.ts";

test("Nest Violett ist Standard; alle gewählten Farbschemata bleiben erhalten", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(readNuzzleTheme(storage), "classic");
  for (const theme of ["classic", "green", "coral"]) { saveNuzzleTheme(storage, theme); assert.equal(readNuzzleTheme(storage), theme); }
});

test("Unbekannte Werte und blockierter Speicher gefährden den Start nicht", () => {
  assert.equal(readNuzzleTheme({ getItem: () => "unexpected" }), "classic");
  assert.equal(readNuzzleTheme({ getItem: () => { throw Error("blocked"); } }), "classic");
  assert.doesNotThrow(() => saveNuzzleTheme({ setItem: () => { throw Error("blocked"); } }, "coral"));
});

test("Beide Manifest-Adressen liefern dieselbe App mit maskierbarem Icon", () => {
  const manifests = ["manifest.webmanifest", "manifest-violet.webmanifest"].map(f => JSON.parse(readFileSync(new URL("../public/" + f, import.meta.url))));
  assert.deepEqual(manifests[0], manifests[1]);
  assert.equal(manifests[0].id, "/"); assert.equal(manifests[0].start_url, "/");
  assert.equal(manifests[0].background_color, "#21194d");
  assert.ok(manifests[0].icons.some(icon => icon.purpose === "maskable" && icon.sizes === "512x512"));
  for (const icon of manifests[0].icons) assert.ok(existsSync(new URL("../public" + icon.src.split("?")[0], import.meta.url)));
});
