import assert from "node:assert/strict";
import test from "node:test";
import { resolveRestoreLane } from "./task-archive.ts";
const lanes = [{ id: "open", title: "Offen", color: "purple" }];
test("Wiederherstellen nutzt den ursprünglichen Bereich", () => {
  assert.deepEqual(resolveRestoreLane("open", lanes, "unknown", "gray"), { status: "open" });
});
test("Fehlender Bereich wird angelegt oder wiederverwendet", () => {
  const result = resolveRestoreLane("deleted", lanes, "unknown", "gray");
  assert.deepEqual(result, { status: "unknown", newLane: { id: "unknown", title: "Unbekannt", color: "gray" } });
  assert.deepEqual(resolveRestoreLane("deleted", [...lanes, result.newLane], "unused", "gray"), { status: "unknown" });
});
