import test from "node:test";
import assert from "node:assert/strict";
import { commentAuthorForEmail, createIdentityService } from "./household-identity.ts";

const config = JSON.stringify({ "first@example.com": "Markus", "second@example.com": "Bettina", "alias@example.com": "Bettina" });
test("Kommentarnamen werden ausschließlich konfigurierten Konten zugeordnet", () => {
  assert.equal(commentAuthorForEmail(" First@Example.com ", config), "Markus");
  assert.equal(commentAuthorForEmail("alias@example.com", config), "Bettina");
  assert.equal(commentAuthorForEmail("unknown@example.com", config), null);
  for (const value of [undefined, "{", "[]", JSON.stringify({"first@example.com":"unbekannt"}), JSON.stringify({"first@example.com":"Markus","FIRST@example.com":"Bettina"})]) assert.equal(commentAuthorForEmail("first@example.com", value), null);
});
test("Identität erfordert Prüfung und liefert keine Mailadresse", async () => {
  const request = new Request("https://nest.example/api/household-identity");
  assert.equal((await createIdentityService(async () => null, () => config)(request)).status, 401);
  const response = await createIdentityService(async () => "first@example.com", () => config)(request);
  assert.deepEqual(await response.json(), { author: "Markus" });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
