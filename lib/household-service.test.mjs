import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHouseholdService } from "./household-service.ts";
import { householdKeys } from "./household-data.ts";
import { mergeHousehold } from "./household-merge.ts";

test("Haushalts-API schützt Daten und behandelt konkurrierende Änderungen", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../drizzle/0000_marvelous_firebrand.sql", import.meta.url), "utf8"));
  const db = { prepare(query) {
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async first() { return sql.prepare(query).get(...params) ?? null; },
    };
  } };
  const service = createHouseholdService({ db, identify: async (request) => request.headers.get("test-user"), commentAuthors: JSON.stringify({"first@example.com":"Markus"}) });
  const origin = "https://nest.example";
  const data = Object.fromEntries(householdKeys.map((key) => [key, []]));
  const get = (user) => new Request(origin + "/api/household", { headers: user ? { "test-user": user } : {} });
  const put = (user, revision, snapshot, from = origin) => new Request(origin + "/api/household", {
    method: "PUT", headers: { "test-user": user, origin: from, "content-type": "application/json" },
    body: JSON.stringify({ revision, data: snapshot }),
  });

  assert.equal((await service.GET(get())).status, 401);
  assert.equal((await service.PUT(put("", 0, data))).status, 401);
  assert.equal((await service.PUT(put("one", 0, data, "https://evil.example"))).status, 403);
  assert.deepEqual(await (await service.GET(get("one"))).json(), { revision: 0, data: null, author: null });
  assert.equal((await service.PUT(put("one", 0, data))).status, 200);
  assert.equal((await service.PUT(put("two", 0, data))).status, 409);
  const changed = { ...data, tasks: [{ id: 1, title: "Einkaufen", status: "open", assignee: "Gemeinsam" }] };
  assert.equal((await service.PUT(put("one", 1, changed))).status, 200);
  assert.equal((await service.PUT(put("two", 1, data))).status, 409);
  assert.deepEqual(await (await service.GET(get("two"))).json(), { revision: 2, data: changed, author: null });
  const own = await (await service.GET(get("first@example.com"))).json();
  assert.equal(own.author, "Markus");
  assert.equal((await service.PUT(put("one", 2, { ...data, tasks: [null] }))).status, 400);
  sql.close();
});

test("zwei Geräte führen vereinbare Änderungen nach einer abgelehnten Revision zusammen", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../drizzle/0000_marvelous_firebrand.sql", import.meta.url), "utf8"));
  const db = { prepare(query) { let params = []; return { bind(...values) { params = values; return this; }, async first() { return sql.prepare(query).get(...params) ?? null; } }; } };
  const service = createHouseholdService({ db, identify: async () => "user" });
  const origin = "https://nest.example";
  const get = () => new Request(origin + "/api/household");
  const put = (revision, data) => new Request(origin + "/api/household", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ revision, data }) });
  const base = Object.fromEntries(householdKeys.map((key) => [key, []]));
  base.tasks = [{ id: 1, title: "Aufgabe", status: "open", assignee: "Markus" }];
  assert.equal((await service.PUT(put(0, base))).status, 200);
  const local = structuredClone(base), other = structuredClone(base);
  local.tasks[0].title = "Neuer Titel";
  other.tasks[0].assignee = "Bettina";
  assert.equal((await service.PUT(put(1, other))).status, 200);
  assert.equal((await service.PUT(put(1, local))).status, 409);
  const current = await (await service.GET(get())).json();
  const merged = mergeHousehold(base, local, current.data);
  assert.equal((await service.PUT(put(current.revision, merged))).status, 200);
  const result = await (await service.GET(get())).json();
  assert.equal(result.data.tasks[0].title, "Neuer Titel");
  assert.equal(result.data.tasks[0].assignee, "Bettina");
  assert.equal(result.revision, 3);
  sql.close();
});

test("zwei Geräte behalten gleichzeitig hinzugefügte Artikel nach HTTP 409", async () => {
  const sql=new DatabaseSync(":memory:"); sql.exec(readFileSync(new URL("../drizzle/0000_marvelous_firebrand.sql",import.meta.url),"utf8"));
  const db={prepare(query){let params=[];return {bind(...values){params=values;return this;},async first(){return sql.prepare(query).get(...params)??null;}};}};
  const service=createHouseholdService({db,identify:async()=>"user"}), origin="https://nest.example";
  const put=(revision,data)=>new Request(origin+"/api/household",{method:"PUT",headers:{origin,"content-type":"application/json"},body:JSON.stringify({revision,data})});
  const get=()=>new Request(origin+"/api/household"); const base=Object.fromEntries(householdKeys.map(key=>[key,[]]));
  await service.PUT(put(0,base)); const a=structuredClone(base),b=structuredClone(base);
  a.items.push({id:1,name:"Milch",icon:"milk"}); b.items.push({id:2,name:"Brot",icon:"bread"});
  assert.equal((await service.PUT(put(1,b))).status,200); assert.equal((await service.PUT(put(1,a))).status,409);
  const current=await (await service.GET(get())).json(); const merged=mergeHousehold(base,a,current.data);
  assert.equal((await service.PUT(put(current.revision,merged))).status,200);
  const result=await (await service.GET(get())).json(); assert.deepEqual(result.data.items.map(item=>item.id),[1,2]); assert.equal(result.revision,3); sql.close();
});
