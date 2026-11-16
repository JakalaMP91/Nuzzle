import test from "node:test";
import assert from "node:assert/strict";
import { mergeHousehold } from "./household-merge.ts";

const data = () => ({ items: [], recent: [], recipeRecent: [], pantry: [], purchaseHistory: [], recipes: [], customCategories: [], taskLanes: [{ id: "open", title: "Offen", color: "red" }], tasks: [{ id: 1, title: "Erste", status: "open", assignee: "Markus" }, { id: 2, title: "Zweite", status: "open", assignee: "Bettina" }] });
const copy = (value) => structuredClone(value);

test("verschiedene Aufgaben und Felder werden zusammengeführt", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.tasks[0].title = "Lokal";
  remote.tasks[1].title = "Gemeinsam";
  remote.tasks[0].assignee = "Bettina";
  const result = mergeHousehold(base, local, remote);
  assert.equal(result.tasks[0].title, "Lokal");
  assert.equal(result.tasks[0].assignee, "Bettina");
  assert.equal(result.tasks[1].title, "Gemeinsam");
});
test("das gleiche unterschiedlich geänderte Feld bleibt ein Konflikt", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.tasks[0].title = "Eins"; remote.tasks[0].title = "Zwei";
  assert.equal(mergeHousehold(base, local, remote), null);
});
test("Löschen gegen Bearbeiten und konkurrierende Sortierung bleiben Konflikte", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.tasks.shift(); remote.tasks[0].title = "Bearbeitet";
  assert.equal(mergeHousehold(base, local, remote), null);
  const l = copy(base), r = copy(base);
  l.tasks.reverse(); r.tasks.push({ id: 3, title: "Neu", status: "open", assignee: "Markus" });
  assert.equal(mergeHousehold(base, l, r), null);
});
test("Bereichsänderungen und gleichzeitige Aufgabenänderungen bleiben Konflikte", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.taskLanes = []; remote.tasks[0].title = "Bearbeitet";
  assert.equal(mergeHousehold(base, local, remote), null);
});
test("Einkauf und Aufgaben sowie unabhängige Ergänzungen werden zusammengeführt", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.items = [{ id: 1, name: "Milch", icon: "milk" }]; remote.tasks[0].title = "Aktualisiert";
  assert.deepEqual(mergeHousehold(base, local, remote).items, local.items);
  remote.recent = [{ id: 2, name: "Brot", icon: "bread" }];
  assert.deepEqual(mergeHousehold(base, local, remote).recent, remote.recent);
});
test("gleiche Änderungen und einseitige Aufgabe-Erstellung sind wiederholbar", () => {
  const base = data(), local = copy(base), remote = copy(base);
  local.tasks.push({ id: 3, title: "Neu", status: "open", assignee: "Markus" });
  remote.tasks[0].assignee = "Gemeinsam";
  const merged = mergeHousehold(base, local, remote);
  assert.equal(merged.tasks.length, 3);
  assert.equal(merged.tasks[0].assignee, "Gemeinsam");
  assert.deepEqual(mergeHousehold(base, merged, remote), merged);
});


test("zwei Geräte fügen Artikel und Vorschläge ohne Verlust zusammen", () => {
  const base=data(), local=copy(base), remote=copy(base);
  base.items=[{id:10,name:"Alt",icon:"milk"}]; local.items=copy(base.items); remote.items=copy(base.items);
  local.items.push({id:11,name:"Lokal",icon:"milk"}); remote.items.push({id:12,name:"Fremd",icon:"bread"});
  local.recent.unshift({id:13,name:"Lokal",icon:"milk"}); remote.recent.unshift({id:14,name:"Fremd",icon:"bread"});
  const merged=mergeHousehold(base,local,remote);
  assert.deepEqual(merged.items.map(x=>x.id),[10,11,12]); assert.deepEqual(merged.recent.map(x=>x.id),[13,14]);
  assert.deepEqual(mergeHousehold(base,merged,remote),merged);
});
test("Einkauf und unabhängige Rezeptbearbeitung können zusammengeführt werden", () => {
  const base=data(),local=copy(base),remote=copy(base);
  local.items.push({id:11,name:"Milch",icon:"milk"}); remote.recipes.push({id:"r1",title:"Essen"});
  const merged=mergeHousehold(base,local,remote); assert.deepEqual(merged.items,local.items); assert.deepEqual(merged.recipes,remote.recipes);
});
test("gleichzeitige Löschung, Bearbeitung, Reihenfolge und ID-Kollision bleiben geschützt", () => {
  const base=data(); base.items=[{id:1,name:"Milch",icon:"milk"},{id:2,name:"Brot",icon:"bread"}];
  const local=copy(base),remote=copy(base); local.items.pop(); remote.items.push({id:3,name:"Käse",icon:"milk"});
  let area; assert.equal(mergeHousehold(base,local,remote,x=>area=x),null); assert.equal(area,"shopping");
  const a=copy(base),b=copy(base); a.items[0].name="Lokal"; b.items.push({id:4,name:"Neu",icon:"milk"}); assert.equal(mergeHousehold(base,a,b),null);
  const c=copy(base),d=copy(base); c.items.reverse(); d.items.push({id:5,name:"Neu",icon:"milk"}); assert.equal(mergeHousehold(base,c,d),null);
  const e=copy(base),f=copy(base); e.items.push({id:7,name:"Eins",icon:"milk"}); f.items.push({id:7,name:"Zwei",icon:"milk"}); assert.equal(mergeHousehold(base,e,f),null);
});
test("verschiedene Positionen und entgegengesetzte Reihenfolge gemeinsamer neuer Einträge bleiben Konflikt", () => {
  const base=data(); base.items=[{id:1,name:"Alt",icon:"milk"}];
  const l=copy(base),r=copy(base); const x={id:2,name:"Neu",icon:"milk"}; l.items.unshift(x);r.items.push(x);assert.equal(mergeHousehold(base,l,r),null);
  const a=copy(base),b=copy(base),y={id:3,name:"Andere",icon:"milk"};a.items.push(x,y);b.items.push(y,x);assert.equal(mergeHousehold(base,a,b),null);
});
