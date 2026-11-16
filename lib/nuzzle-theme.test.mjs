import test from "node:test";
import assert from "node:assert/strict";
import { nuzzleThemeAssets, readNuzzleTheme, saveNuzzleTheme } from "./nuzzle-theme.ts";

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


test("Für jedes Farbschema sind passende Icons und ein kompatibles Manifest vorhanden", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const green = nuzzleThemeAssets("green"), classic = nuzzleThemeAssets("classic");
  assert.notEqual(green.icon, classic.icon);
  for (const assets of [green, classic]) {
    for (const value of Object.values(assets)) assert.ok(existsSync(new URL("../public" + value.split("?")[0], import.meta.url)));
    const manifest = JSON.parse(readFileSync(new URL("../public" + assets.manifest.split("?")[0], import.meta.url)));
    assert.equal(manifest.id, "/"); assert.equal(manifest.start_url, "/");
    for (const icon of manifest.icons) assert.ok(existsSync(new URL("../public" + icon.src.split("?")[0], import.meta.url)));
  }
});
