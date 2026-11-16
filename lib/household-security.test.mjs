import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { parseAccessConfig, verifyAccessToken } from "./access-token.ts";
import { householdKeys, parseHouseholdData } from "./household-data.ts";
import { fetchAccessKeys } from "./access-keys.ts";

const crypto = globalThis.crypto ?? webcrypto;
const to64 = (value) => Buffer.from(value).toString("base64url");
const issuer = "https://nest-test.cloudflareaccess.com";
const config = { issuer, audience: "app-audience", allowedEmails: ["one@example.com", "two@example.com"] };
const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...await crypto.subtle.exportKey("jwk", keys.publicKey), kid: "key-1", alg: "RS256" };
async function token(overrides = {}, headerOverrides = {}) {
  const head = to64(JSON.stringify({ alg: "RS256", kid: "key-1", ...headerOverrides }));
  const body = to64(JSON.stringify({ iss: issuer, aud: ["app-audience"], exp: 2000, email: "one@example.com", ...overrides }));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(head + "." + body));
  return head + "." + body + "." + to64(signature);
}
const verify = async (jwt) => verifyAccessToken(jwt, config, async () => [jwk], 1000);

test("validiert signierte Access-Identität und beide freigegebenen Konten", async () => {
  assert.equal(await verify(await token()), "one@example.com");
  assert.equal(await verify(await token({ email: "TWO@example.com" })), "two@example.com");
});

test("lehnt fremde, abgelaufene, manipulierte oder falsch adressierte Tokens ab", async () => {
  for (const claims of [
    { email: "intruder@example.com" }, { exp: 1000 }, { nbf: 1001 },
    { iss: "https://evil.cloudflareaccess.com" }, { aud: ["other-app"] },
  ]) assert.equal(await verify(await token(claims)), null);
  const good = await token();
  const parts = good.split(".");
  parts[1] = to64(JSON.stringify({ iss: issuer, aud: "app-audience", exp: 2000, email: "two@example.com" }));
  assert.equal(await verify(parts.join(".")), null);
  assert.equal(await verify(await token({}, { alg: "none" })), null);
  assert.equal(await verifyAccessToken(good, config, async () => [], 1000), null);
});

test("unvollständige Access-Konfiguration bleibt geschlossen", () => {
  assert.equal(parseAccessConfig("example.com", "aud", "one@example.com"), null);
  assert.equal(parseAccessConfig("nest-test.cloudflareaccess.com", "", "one@example.com"), null);
  assert.equal(parseAccessConfig("nest-test.cloudflareaccess.com", "aud", ""), null);
  assert.equal(parseAccessConfig("https://nest-test.cloudflareaccess.com", "aud", "ONE@example.com").allowedEmails[0], "one@example.com");
});

test("nur bekannte Datenfelder und gültige Sammlungen werden angenommen", () => {
  const data = Object.fromEntries(householdKeys.map((key) => [key, []]));
  assert.deepEqual(parseHouseholdData(data), data);
  assert.equal(parseHouseholdData({ ...data, ui: {} }), null);
  assert.equal(parseHouseholdData({ ...data, tasks: [null] }), null);
  assert.equal(parseHouseholdData({ ...data, customCategories: [1] }), null);
  assert.equal(parseHouseholdData({ ...data, customCategories: ["x".repeat(1_500_001)] }), null);
});

test("Access-Schlüssel werden Workers-kompatibel geladen, Weiterleitungen aber abgewiesen", async () => {
  let options;
  const keys = await fetchAccessKeys(issuer, async (_url, init) => {
    options = init;
    return Response.json({ keys: [jwk] });
  });
  assert.equal(options.redirect, "manual");
  assert.equal(keys[0].kid, "key-1");
  await assert.rejects(() => fetchAccessKeys(issuer, async () => new Response(null, { status: 302, headers: { Location: "https://example.com" } })));
  await assert.rejects(() => fetchAccessKeys(issuer, async () => Response.json({ keys: null })));
});
