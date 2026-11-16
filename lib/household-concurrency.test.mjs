import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

test("gleichzeitige Schreibversuche überschreiben keine neuere Revision", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0000_marvelous_firebrand.sql", import.meta.url), "utf8"));
  const create = db.prepare("INSERT INTO household (id, revision, data, updated_at) VALUES (1, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING revision");
  const update = db.prepare("UPDATE household SET data = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ? RETURNING revision");
  assert.equal(create.get("initial", 1).revision, 1);
  assert.equal(create.get("zweites Gerät", 1), undefined);
  assert.equal(update.get("Gerät A", 2, 1).revision, 2);
  assert.equal(update.get("Gerät B", 3, 1), undefined);
  assert.equal(db.prepare("SELECT data FROM household WHERE id = 1").get().data, "Gerät A");
  db.close();
});
