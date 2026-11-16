import assert from "node:assert/strict";
import test from "node:test";
import { createSyncLog, syncErrorDetails } from "./sync-log.ts";

function storage() {
  let value = null;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

test("Protokoll begrenzt Einträge, speichert nur technische Felder und übersteht Neuladen", () => {
  const target = storage();
  const log = createSyncLog(() => target);
  for (let i = 0; i < 205; i++) log.append({ operation: "save", outcome: "error", reason: "http", status: 413, revision: i, secret: "private Rezeptdaten" });
  const restored = createSyncLog(() => target).snapshot();
  assert.equal(restored.entries.length, 200);
  assert.equal(restored.entries[0].revision, 5);
  assert.equal(restored.entries[199].status, 413);
  assert.equal(restored.persistent, true);
  assert.equal(JSON.stringify(restored).includes("private Rezeptdaten"), false);
});

test("Fehlender Gerätespeicher verhindert weder Protokollierung im Speicher noch Export", () => {
  const log = createSyncLog(() => { throw new Error("storage blocked"); });
  assert.doesNotThrow(() => log.append({ operation: "connect", outcome: "error", reason: "network" }));
  assert.equal(log.snapshot().persistent, false);
  assert.equal(log.snapshot().entries.length, 1);
});

test("Fehler werden ohne Nachricht und private Details klassifiziert", () => {
  assert.deepEqual(syncErrorDetails({ name: "SessionExpiredError", status: 401, message: "private" }), { reason: "session", status: 401 });
  assert.deepEqual(syncErrorDetails({ name: "SyncHttpError", status: 503 }), { reason: "http", status: 503 });
  assert.deepEqual(syncErrorDetails({ name: "TimeoutError" }), { reason: "timeout" });
  assert.deepEqual(syncErrorDetails(new TypeError("private")), { reason: "network" });
  assert.deepEqual(syncErrorDetails({ name: "QuotaExceededError" }), { reason: "storage" });
  assert.deepEqual(syncErrorDetails({ name: "InvalidSyncResponseError" }), { reason: "invalid-response" });
});


test("Konfliktbereich wird ohne Inhalte protokolliert und validiert", () => {
  const target=storage(), log=createSyncLog(() => target);
  log.append({operation:"merge", outcome:"conflict", reason:"merge-conflict", conflictArea:"shopping", privateName:"Milch"});
  log.append({operation:"merge", outcome:"conflict", conflictArea:"Milch"});
  const entries=log.snapshot().entries;
  assert.equal(entries[0].conflictArea,"shopping"); assert.equal(entries[1].conflictArea,undefined);
  assert.equal(JSON.stringify(entries).includes("Milch"),false);
});
