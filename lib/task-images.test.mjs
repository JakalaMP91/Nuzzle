import assert from "node:assert/strict";
import test from "node:test";
import { householdKeys } from "./household-data.ts";
import { applyTaskImageReplacements, imageIdFromPath, normalizeHouseholdImages } from "./household-images.ts";

const empty = () => Object.fromEntries(householdKeys.map((key) => [key, []]));
const picture = "data:image/jpeg;base64,/9j/2Q==";
test("Aufgabenbilder werden getrennt gespeichert und gleichzeitige Änderungen bleiben erhalten", async () => {
  const before = [{ id: 7, title: "Alt", status: "open", assignee: "Gemeinsam", images: [picture] }];
  const normalized = await normalizeHouseholdImages({ ...empty(), tasks: before });
  const stored = normalized.data.tasks[0];
  assert.ok(imageIdFromPath(stored.images[0]));
  assert.equal(normalized.images.length, 1);
  assert.equal(normalized.images[0].content, picture);
  const concurrent = [{ ...before[0], title: "Neu", images: [picture, "neues Bild"] }];
  const applied = applyTaskImageReplacements(concurrent, before, normalized.data.tasks);
  assert.equal(applied[0].title, "Neu");
  assert.ok(imageIdFromPath(applied[0].images[0]));
  assert.equal(applied[0].images[1], "neues Bild");
  assert.deepEqual(applyTaskImageReplacements([{ ...before[0], images: [] }], before, normalized.data.tasks)[0].images, []);
});

test("Ungültige eingebettete Aufgabenbilder werden abgewiesen", async () => {
  await assert.rejects(normalizeHouseholdImages({ ...empty(), tasks: [{ id: 1, images: ["data:image/svg+xml;base64,AAAA"] }] }));
});
