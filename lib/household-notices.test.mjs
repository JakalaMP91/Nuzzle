import test from "node:test";
import assert from "node:assert/strict";
import { describeNotices, emptyNotices, incomingNotices as incoming, noticePreviews } from "./household-notices.ts";
const incomingNotices = (state, base, local, remote, viewer = "Markus") => incoming(state, base, local, remote, viewer);

const data = () => ({ items: [], recent: [], recipeRecent: [], pantry: [], purchaseHistory: [], recipes: [], customCategories: [], tasks: [{ id: 1, title: "Aufgabe", status: "open", assignee: "Markus", comments: [], images: [] }], taskLanes: [] });
const copy = (value) => structuredClone(value);
test("neue gemeinsame Artikel, Aufgaben, Kommentare, Bilder und Rezepte werden gezählt", () => {
  const base = data(), local = copy(base), remote = copy(base);
  remote.items.push({ id: 2, name: "Brot", icon: "bread", createdBy: "Bettina" });
  remote.recipes.push({ id: "r1", title: "Rezept", createdBy: "Bettina" });
  remote.tasks[0].comments.push({ id: "c1", author: "Bettina" }); remote.tasks[0].images.push("/api/household-image?id=one"); remote.tasks[0].imageAuthors = ["Bettina"];
  remote.tasks.push({ id: 2, title: "Neu", status: "open", assignee: "Bettina", createdBy: "Bettina", comments: [{ id: "initial" }], images: ["/image"] });
  const result = incomingNotices(emptyNotices(), base, local, remote);
  assert.equal(result.shopping.length, 1); assert.deepEqual(result.newItems, [2]);
  assert.equal(result.tasks.length, 3); assert.equal(result.recipes.length, 1);
  assert.deepEqual(describeNotices(result, "tasks"), ["1 neue Aufgabe", "1 neuer Kommentar", "1 neues Foto"]);
  assert.deepEqual(describeNotices(result, "shopping"), ["1 neuer Artikel"]);
  assert.deepEqual(describeNotices(result, "recipes"), ["1 neues Rezept"]);
  assert.deepEqual(incomingNotices(result, base, local, remote), result);
});
test("eigene bereits vorhandene und alte Einträge lösen keine Hinweise aus", () => {
  const base = data(), local = copy(base), remote = copy(base);
  const item = { id: 3, name: "Milch", icon: "milk" }; local.items.push(item); remote.items.push(item);
  local.tasks[0].comments.push({ id: "eigen" }); remote.tasks[0].comments.push({ id: "eigen" });
  local.tasks[0].images.push("/eigen"); remote.tasks[0].images.push("/eigen");
  assert.deepEqual(incomingNotices(emptyNotices(), base, local, remote), emptyNotices());
  assert.deepEqual(incomingNotices(emptyNotices(), remote, remote, remote), emptyNotices());
});
test("eigene Änderungen auf einem anderen Gerät und unbekannte Urheber melden keine Neuigkeit", () => {
  const base = data(), local = copy(base), remote = copy(base);
  remote.items.push({ id: 10, name: "Milch", icon: "milk", createdBy: "Markus" }, { id: 11, name: "Alt", icon: "milk" });
  remote.recipes.push({ id: "r1", title: "Rezept", createdBy: "Markus" });
  remote.tasks[0].comments.push({ id: "own", author: "Markus" });
  remote.tasks[0].images.push("/own"); remote.tasks[0].imageAuthors = ["Markus"];
  remote.tasks.push({ id: 2, title: "Eigene", status: "open", createdBy: "Markus" });
  assert.deepEqual(incomingNotices(emptyNotices(), base, local, remote), emptyNotices());
  assert.deepEqual(incomingNotices(emptyNotices(), base, local, remote, null), emptyNotices());
});
test("entfernte Einkaufsposten verschwinden aus Zähler und Neu-Markierung", () => {
  const base = data(), local = copy(base), remote = copy(base);
  const state = { shopping: ["item:7"], tasks: [], recipes: [], newItems: [7] };
  assert.deepEqual(incomingNotices(state, base, local, remote), emptyNotices());
});

test("Abschlüsse und Einkäufe von anderen Geräten erscheinen mit Vorschau", () => {
  const base = data(), local = copy(base), remote = copy(base);
  base.items.push({ id: 11, name: "Milch", icon: "milk" }); local.items = copy(base.items);
  remote.tasks[0].done = true; remote.tasks[0].completedAt = "2026-11-12T12:00:00Z"; remote.tasks[0].completedBy = "Bettina";
  remote.purchaseHistory.push({ id: "purchase-1", item: { id: 11, name: "Milch", icon: "milk" }, checkedAt: 1794484800000, actor: "Bettina" });
  const result = incomingNotices(emptyNotices(), base, local, remote);
  assert.deepEqual(describeNotices(result, "tasks"), ["1 Aufgabe erledigt"]);
  assert.deepEqual(describeNotices(result, "shopping"), ["1 Artikel eingekauft"]);
  assert.equal(noticePreviews(result, "completed-task")[0].label, "Aufgabe");
  assert.equal(noticePreviews(result, "purchased")[0].label, "Milch");
  assert.deepEqual(incomingNotices(result, base, local, remote), result);
  const restored = copy(remote); restored.tasks[0].done = false;
  assert.equal(noticePreviews(incomingNotices(result, remote, remote, restored), "completed-task").length, 0);
  restored.purchaseHistory = [];
  assert.equal(noticePreviews(incomingNotices(result, remote, remote, restored), "purchased").length, 0);
});

test("eigene Abschlüsse und Einkäufe auf anderen Geräten bleiben ohne Hinweise", () => {
  const base = data(), local = copy(base), remote = copy(base);
  remote.tasks[0].done = true; remote.tasks[0].completedAt = "2026-11-12T12:00:00Z"; remote.tasks[0].completedBy = "Markus";
  remote.purchaseHistory.push({ id: "purchase-own", item: { id: 11, name: "Milch", icon: "milk" }, checkedAt: 1794484800000, actor: "Markus" });
  assert.deepEqual(incomingNotices(emptyNotices(), base, local, remote, "Markus"), emptyNotices());
  const other = incomingNotices(emptyNotices(), base, local, remote, "Bettina");
  assert.deepEqual(describeNotices(other, "tasks"), ["1 Aufgabe erledigt"]);
  assert.deepEqual(describeNotices(other, "shopping"), ["1 Artikel eingekauft"]);
});

test("alte lokale Hinweise erscheinen nicht mehr auf Home", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.tasks[0].done = true;
  local.purchaseHistory.push({ id: "mine", item: { id: 11, name: "Milch", icon: "milk" }, checkedAt: 10 });
  const state = { ...emptyNotices(), previews: [{ key: "local:done:1", kind: "completed-task", label: "Aufgabe", at: 1 }, { key: "local:purchase:mine", kind: "purchased", label: "Milch", at: 2 }] };
  const result = incomingNotices(state, base, local, remote);
  assert.equal(noticePreviews(result, "completed-task").length, 0);
  assert.equal(noticePreviews(result, "purchased").length, 0);
  assert.equal(result.tasks.length, 0);
  assert.equal(result.shopping.length, 0);
});

test("Vorschau zeigt höchstens vier jüngste Einträge je Art", () => {
  const base = data(), local = copy(base), remote = copy(base);
  remote.items = Array.from({ length: 6 }, (_, i) => ({ id: i + 10, name: `Artikel ${i}`, icon: "milk", addedAt: 100 + i, createdBy: "Bettina" }));
  const result = incomingNotices(emptyNotices(), base, local, remote);
  assert.deepEqual(noticePreviews(result, "new-item").map((item) => item.label), ["Artikel 5", "Artikel 4", "Artikel 3", "Artikel 2"]);
  assert.equal(result.shopping.length, 6);
});
