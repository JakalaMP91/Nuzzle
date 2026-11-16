import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { householdKeys } from "./household-data.ts";
import { applyImageReplacements, imageIdFromPath, normalizeHouseholdImages } from "./household-images.ts";
import { createHouseholdService } from "./household-service.ts";
import { createHouseholdImageService } from "./household-image-service.ts";

function makeDatabase() {
  const sql = new DatabaseSync(":memory:");
  for (const file of ["0000_marvelous_firebrand.sql", "0001_careless_ultimates.sql"]) sql.exec(readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"));
  const db = {
    prepare(query) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sql.prepare(query).get(...values) ?? null; },
        async run() { return sql.prepare(query).run(...values); },
        execute() { const statement = sql.prepare(query); return /RETURNING/i.test(query) ? statement.all(...values) : (statement.run(...values), []); },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try { const results = statements.map((statement) => ({ results: statement.execute() })); sql.exec("COMMIT"); return results; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  return { sql, db };
}

const initial = () => Object.fromEntries(householdKeys.map((key) => [key, []]));
const image = "data:image/jpeg;base64,/9j/2Q==";
const recipe = { id: "r1", title: "Test", description: "", icon: "pot", categories: [], ingredients: [], image };
const origin = "https://nest.example";
const put = (revision, data) => new Request(origin + "/api/household", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ revision, data }) });

test("Bilder werden getrennt gespeichert und bei veralteter Revision nicht eingefügt", async () => {
  const { db, sql } = makeDatabase();
  const service = createHouseholdService({ db, identify: async () => "allowed" });
  const first = await service.PUT(put(0, { ...initial(), recipes: [recipe] }));
  assert.equal(first.status, 200);
  const result = await first.json();
  const ref = result.data.recipes[0].image;
  assert.ok(imageIdFromPath(ref));
  assert.equal(sql.prepare("SELECT count(*) AS count FROM household_image").get().count, 1);
  assert.equal(sql.prepare("SELECT content FROM household_image").get().content, image);
  assert.equal(sql.prepare("SELECT data FROM household").get().data.includes("base64"), false);
  const stale = await service.PUT(put(0, { ...initial(), recipes: [{ ...recipe, image: "data:image/png;base64,AQID" }] }));
  assert.equal(stale.status, 409);
  assert.equal(sql.prepare("SELECT count(*) AS count FROM household_image").get().count, 1);
  sql.close();
});

test("Bildantwort ersetzt keine parallelen Änderungen", async () => {
  const result = await normalizeHouseholdImages({ ...initial(), recipes: [recipe] });
  const concurrent = [{ ...recipe, title: "Neu" }, { ...recipe, id: "r2", image: "another" }];
  const applied = applyImageReplacements(concurrent, [recipe], result.data.recipes);
  assert.equal(applied[0].title, "Neu");
  assert.ok(imageIdFromPath(applied[0].image));
  assert.equal(applied[1].image, "another");
  assert.equal(applyImageReplacements([{ ...recipe, image: "changed" }], [recipe], result.data.recipes)[0].image, "changed");
});

test("Bildzugriff erfordert Anmeldung und gibt exakte Bilddaten zurück", async () => {
  const { db, sql } = makeDatabase();
  const service = createHouseholdImageService({ db, identify: async (request) => request.headers.get("test-user") });
  const post = (user, content, from = origin) => new Request(origin + "/api/household-image", { method: "POST", headers: { "test-user": user, origin: from, "content-type": "application/json" }, body: JSON.stringify({ content }) });
  assert.equal((await service.POST(post("", image))).status, 401);
  assert.equal((await service.POST(post("user", image, "https://other.example"))).status, 403);
  assert.equal((await service.POST(post("user", "data:image/svg+xml;base64,AA=="))).status, 400);
  const saved = await service.POST(post("user", image));
  assert.equal(saved.status, 200);
  const { path } = await saved.json();
  assert.equal((await service.GET(new Request(origin + path))).status, 401);
  const retrieved = await service.GET(new Request(origin + path, { headers: { "test-user": "user" } }));
  assert.equal(retrieved.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await retrieved.arrayBuffer()), Buffer.from("/9j/2Q==", "base64"));
  sql.close();
});
