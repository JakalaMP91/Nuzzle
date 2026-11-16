import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { allowedPushEndpoint, parsePushSubscription } from "./push-subscription.ts";
import { createPushService } from "./push-service.ts";
import { reminderForDevice, runTaskPush } from "./push-scheduler.ts";
import { sendPush } from "./push-send.ts";
import { taskDueAt, taskReminderState } from "./task-reminders.ts";
import { householdKeys } from "./household-data.ts";

const config = { NEST_COMMENT_AUTHORS: JSON.stringify({"first@example.com":"Markus","second@example.com":"Bettina","alias@example.com":"Bettina"}), NEST_VAPID_PUBLIC_KEY: "test", NEST_VAPID_PRIVATE_KEY: "test", NEST_VAPID_SUBJECT: "https://nest.example" };
const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/device-1", expirationTime: null, keys: { p256dh: Buffer.alloc(65, 1).toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url") } };
function database() {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["0000_marvelous_firebrand.sql", "0002_task_push.sql", "0003_push_preferences.sql", "0004_push_diagnostics.sql"]) sql.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  return { sql, db: { prepare(query) { let params = []; return { bind(...values) { params = values; return this; }, async first() { return sql.prepare(query).get(...params) ?? null; }, async run() { return sql.prepare(query).run(...params); }, async all() { return { results: sql.prepare(query).all(...params) }; } }; } } };
}
const origin = "https://nest.example";
function request(method, body, user = "first@example.com", from = origin) {
  return new Request(origin + "/api/push", { method, headers: { ...(user ? { "test-user": user } : {}), origin: from, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test("Push-Ziele erlauben ausschließlich bekannte HTTPS-Push-Dienste", () => {
  for (const url of [subscription.endpoint, "https://fcm.googleapis.com/wp/token", "https://updates.push.services.mozilla.com/wpush/v2/abc_123", "https://web.push.apple.com/token", "https://wns2-db5p.notify.windows.com/w/?token=abc"]) assert.equal(allowedPushEndpoint(url), true, url);
  for (const url of ["https://127.0.0.1/push", "https://evil.example/push", "http://fcm.googleapis.com/fcm/send/x", "https://fcm.googleapis.com.evil.example/fcm/send/x", "https://user@fcm.googleapis.com/fcm/send/x", "https://fcm.googleapis.com:8443/fcm/send/x", "https://fcm.googleapis.com/fcm/send/x#hash", "https://notify.windows.com.evil.example/w/?x=y"]) assert.equal(allowedPushEndpoint(url), false, url);
  assert.ok(parsePushSubscription(subscription));
  assert.equal(parsePushSubscription({ ...subscription, keys: { auth: "invalid", p256dh: subscription.keys.p256dh } }), null);
});

test("Push-API autorisiert Besitzer, prüft Ursprung und begrenzt Testnachrichten", async () => {
  const { sql, db } = database();
  let now = 2_000_000; let messages = 0;
  const service = createPushService({ db, config, identify: async (req) => req.headers.get("test-user"), send: async () => { messages++; return 201; }, now: () => now });
  assert.equal((await service.GET(request("GET", null, ""))).status, 401);
  const details = await (await service.GET(request("GET"))).json();
  assert.equal(details.configured, true); assert.equal(details.publicKey, "test");
  assert.equal(JSON.stringify(details).includes("PRIVATE"), false);
  assert.equal((await service.POST(request("POST", { subscription }, undefined, "https://evil.example"))).status, 403);
  assert.equal((await service.POST(request("POST", { subscription: { ...subscription, endpoint: "https://evil.example/x" } }))).status, 400);
  assert.equal((await service.POST(request("POST", { subscription }))).status, 200);
  const created = sql.prepare("SELECT created_at FROM push_subscription").get().created_at;
  now += 10;
  assert.equal((await service.POST(request("POST", { subscription }))).status, 200);
  assert.equal(sql.prepare("SELECT created_at FROM push_subscription").get().created_at, created);
  assert.equal((await service.POST(request("POST", { action: "test", endpoint: subscription.endpoint }, "alias@example.com"))).status, 404);
  assert.equal((await service.POST(request("POST", { action: "test", endpoint: subscription.endpoint }))).status, 200);
  assert.equal((await service.POST(request("POST", { action: "test", endpoint: subscription.endpoint }))).status, 429);
  assert.equal(messages, 1);
  await service.DELETE(request("DELETE", { endpoint: subscription.endpoint }, "alias@example.com"));
  assert.equal(sql.prepare("SELECT count(*) AS n FROM push_subscription").get().n, 1);
  await service.DELETE(request("DELETE", { endpoint: subscription.endpoint }));
  assert.equal(sql.prepare("SELECT count(*) AS n FROM push_subscription").get().n, 0);
  sql.close();
});

test("Erinnerungen beachten Zuständigkeit, Termin, Anmeldung und ausgeschaltete Pushs", () => {
  const task = { id: 1, title: "Gießen", assignee: "Gemeinsam", dueDate: "2026-11-16", dueTime: "12:00", reminderMinutes: 60 };
  const due = taskDueAt(task), subscribed = due - 86400_000;
  assert.equal(reminderForDevice(task, "Markus", subscribed, due - 2 * 3600_000), null);
  assert.equal(reminderForDevice(task, "Markus", subscribed, due - 30 * 60_000).state, "upcoming");
  assert.equal(reminderForDevice(task, "Markus", subscribed, due).state, "overdue");
  assert.equal(reminderForDevice({ ...task, assignee: "Partner" }, "Markus", subscribed, due), null);
  assert.ok(reminderForDevice({ ...task, assignee: "Ich" }, "Markus", subscribed, due));
  assert.equal(reminderForDevice({ ...task, done: true }, "Markus", subscribed, due), null);
  assert.equal(reminderForDevice({ ...task, reminderMinutes: -1 }, "Markus", subscribed, due), null);
  assert.equal(reminderForDevice(task, "Markus", due + 1, due + 2), null);
  assert.equal(reminderForDevice(task, "Markus", subscribed, due + 2 * 86400_000), null);
});

test("Push-Vorwarnung am Vortag bleibt unabhängig von der neutralen Aufgabenfarbe", () => {
  const task = { id: 1, title: "Gießen", assignee: "Gemeinsam", dueDate: "2026-11-16", dueTime: "12:00", reminderMinutes: 1440 };
  const due = taskDueAt(task), previousDay = due - 23 * 3600_000, subscribed = due - 2 * 86400_000;
  assert.equal(taskReminderState(task, previousDay), "none");
  assert.equal(reminderForDevice(task, "Markus", subscribed, previousDay).state, "upcoming");
  assert.equal(reminderForDevice({ ...task, reminderMinutes: 0 }, "Markus", subscribed, previousDay), null);
  assert.equal(reminderForDevice({ ...task, reminderMinutes: 0 }, "Markus", subscribed, due).state, "overdue");
});

test("Cron versendet jede Phase je Gerät und Termin einmal, nur für offene zugeordnete Aufgaben", async () => {
  const { sql, db } = database();
  const task = { id: 1, title: "Gießen", status: "open", assignee: "Markus", dueDate: "2026-11-16", dueTime: "12:00", reminderMinutes: 60 };
  const due = taskDueAt(task);
  const data = Object.fromEntries(householdKeys.map((key) => [key, []]));
  data.tasks = [task, { ...task, id: 2, assignee: "Bettina" }, { ...task, id: 3, done: true }, { ...task, id: 4, reminderMinutes: -1 }];
  sql.prepare("INSERT INTO household VALUES (1, 1, ?, ?)").run(JSON.stringify(data), due - 86400_000);
  sql.prepare("INSERT INTO push_subscription (endpoint, author, subscription, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(subscription.endpoint, "Markus", JSON.stringify(subscription), due - 86400_000, due - 86400_000);
  const messages = []; const send = async (_sub, message) => { messages.push(message); return 201; };
  await runTaskPush({ db, config, send, now: due - 30 * 60_000 });
  await runTaskPush({ db, config, send, now: due - 20 * 60_000 });
  assert.equal(messages.length, 1); assert.equal(messages[0].body, task.title);
  await runTaskPush({ db, config, send, now: due });
  await runTaskPush({ db, config, send, now: due + 10 * 60_000 });
  assert.equal(messages.length, 2); assert.match(messages[1].title, /Aufgabe fällig/);
  sql.close();
});

test("Push-Dienstfehler werden später erneut versucht, abgelaufene Geräte entfernt", async () => {
  const { sql, db } = database();
  const task = { id: 1, title: "Gießen", status: "open", assignee: "Gemeinsam", dueDate: "2026-11-16", dueTime: "12:00" };
  const due = taskDueAt(task); const data = Object.fromEntries(householdKeys.map((key) => [key, []])); data.tasks = [task];
  sql.prepare("INSERT INTO household VALUES (1, 1, ?, ?)").run(JSON.stringify(data), due - 86400_000);
  sql.prepare("INSERT INTO push_subscription (endpoint, author, subscription, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(subscription.endpoint, "Markus", JSON.stringify(subscription), due - 86400_000, due - 86400_000);
  let attempts = 0;
  const send = async () => { attempts++; return attempts === 1 ? 503 : 410; };
  await runTaskPush({ db, config, send, now: due });
  await runTaskPush({ db, config, send, now: due + 5 * 60_000 });
  assert.equal(attempts, 1);
  await runTaskPush({ db, config, send, now: due + 16 * 60_000 });
  assert.equal(attempts, 2);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM push_subscription").get().n, 0);
  sql.close();
});

test("Web-Push wird verschlüsselt und ohne Weiterleitungen versendet", async () => {
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const browser = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", vapid.publicKey)).toString("base64url");
  const privateKey = (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d;
  const p256dh = Buffer.from(await crypto.subtle.exportKey("raw", browser.publicKey)).toString("base64url");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, payload) => {
    assert.equal(url, subscription.endpoint); assert.equal(payload.redirect, "manual");
    const headers = new Headers(payload.headers);
    assert.equal(headers.get("content-encoding"), "aes128gcm");
    assert.match(headers.get("authorization"), /^vapid /);
    assert.equal(Buffer.from(payload.body).includes(Buffer.from("Gießen")), false);
    return new Response(null, { status: 201 });
  };
  try { assert.equal(await sendPush({ ...subscription, keys: { ...subscription.keys, p256dh } }, { title: "Nest", body: "Gießen", tag: "test", url: "/?view=tasks" }, { NEST_VAPID_PUBLIC_KEY: publicKey, NEST_VAPID_PRIVATE_KEY: privateKey, NEST_VAPID_SUBJECT: "https://nest.example" }), 201); }
  finally { globalThis.fetch = originalFetch; }
});

test("ein angenommener Push bleibt erfolgreich, auch wenn das Schließen der Antwort scheitert", async () => {
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const browser = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const keys = { NEST_VAPID_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey("raw", vapid.publicKey)).toString("base64url"), NEST_VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d, NEST_VAPID_SUBJECT: "https://nest.example" };
  const target = { ...subscription, keys: { ...subscription.keys, p256dh: Buffer.from(await crypto.subtle.exportKey("raw", browser.publicKey)).toString("base64url") } };
  const previous = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 201, body: { cancel: async () => { throw new Error("closed"); } } });
  try { assert.equal(await sendPush(target, { title: "Nest", body: "Test", tag: "test", url: "/" }, keys), 201); }
  finally { globalThis.fetch = previous; }
});

test("Geräteeinstellungen bleiben für jeden Endpunkt geschützt", async () => {
  const { sql, db } = database(); let now = 2000000;
  const service = createPushService({ db, config, identify: async req => req.headers.get("test-user"), send: async () => 201, now: () => now });
  await service.POST(request("POST", { subscription }));
  const pref = { action: "preferences", endpoint: subscription.endpoint, reminderTime: "09:15", shoppingEnabled: true };
  assert.equal((await service.POST(request("POST", pref, "alias@example.com"))).status, 404);
  assert.equal((await service.POST(request("POST", { ...pref, reminderTime: "25:00" }))).status, 400);
  assert.equal((await service.POST(request("POST", pref))).status, 200);
  assert.equal(sql.prepare("SELECT shopping_since FROM push_subscription").get().shopping_since, now);
  now += 1000; await service.POST(request("POST", pref));
  assert.equal(sql.prepare("SELECT shopping_since FROM push_subscription").get().shopping_since, 2000000);
  await service.POST(request("POST", { ...pref, shoppingEnabled: false })); now += 1000;
  await service.POST(request("POST", pref)); assert.equal(sql.prepare("SELECT shopping_since FROM push_subscription").get().shopping_since, now);
  const saved=await (await service.POST(request("POST", { subscription }))).json();
  assert.equal(saved.reminderTime, "09:15"); assert.equal(saved.shoppingEnabled, true); sql.close();
});

test("Cron meldet fremde Einkaufsereignisse nur einmal und nur bei aktivierter Option", async () => {
  const { sql, db }=database(); const now=2000000000000; const item={id:now-3600000,name:"Milch",icon:"milk",addedAt:now-3600000,createdBy:"Bettina"};
  const data=Object.fromEntries(householdKeys.map(key=>[key,[]])); data.items=[item];
  sql.prepare("INSERT INTO household VALUES (1, 1, ?, ?)").run(JSON.stringify(data),now);
  sql.prepare("INSERT INTO push_subscription (endpoint,author,subscription,created_at,updated_at) VALUES (?,?,?,?,?)").run(subscription.endpoint,"Markus",JSON.stringify(subscription),now-7200000,now);
  const messages=[]; const send=async (_sub,msg)=>{messages.push(msg);return 201;};
  await runTaskPush({db,config,send,now}); assert.equal(messages.length,0);
  sql.prepare("UPDATE push_subscription SET shopping_enabled=1,shopping_since=?").run(now-7200000);
  await runTaskPush({db,config,send,now}); await runTaskPush({db,config,send,now:now+300000});
  assert.equal(messages.length,1); assert.equal(messages[0].url,"/?view=shopping"); sql.close();
});

test("Neue Aufgaben benachrichtigen nur andere berechtigte Konten und nur einmal", async () => {
 const {sql,db}=database(); const now=2000000000000;
 const data=Object.fromEntries(householdKeys.map(key=>[key,[]]));
 data.tasks=[{id:now-1000,createdAt:now-1000,createdBy:"Bettina",title:"Für Markus",status:"open",assignee:"Markus"},{id:now-2000,createdAt:now-2000,createdBy:"Bettina",title:"Gemeinsam",status:"open",assignee:"Gemeinsam"},{id:now-3000,createdAt:now-3000,createdBy:"Markus",title:"Eigene",status:"open",assignee:"Markus"},{id:now-4000,createdAt:now-4000,createdBy:"Bettina",title:"Nicht zuständig",status:"open",assignee:"Bettina"},{id:now-5000,createdBy:"Bettina",title:"Vor Update",status:"open",assignee:"Markus"}];
 sql.prepare("INSERT INTO household VALUES (1,1,?,?)").run(JSON.stringify(data),now);
 sql.prepare("INSERT INTO push_subscription (endpoint,author,subscription,created_at,updated_at) VALUES (?,?,?,?,?)").run(subscription.endpoint,"Markus",JSON.stringify(subscription),now-100000,now);
 const messages=[];const send=async (_s,msg)=>{messages.push(msg);return 201};
 await runTaskPush({db,config,send,now}); await runTaskPush({db,config,send,now:now+300000});
 assert.deepEqual(messages.map(x=>x.body).sort(),["Für Markus","Gemeinsam"]); assert.ok(messages.every(x=>x.title==="Nest · Neue Aufgabe")); sql.close();
});

test("Testversand unterscheidet Wartezeit und nicht registriertes Gerät", async () => {
 const {sql,db}=database(); const svc=createPushService({db,config,identify:async r=>r.headers.get("test-user"),send:async()=>201,now:()=>2000000});
 const payload={action:"test",endpoint:subscription.endpoint}; let r=await svc.POST(request("POST",payload)); assert.equal(r.status,404); assert.match((await r.json()).error,/nicht mehr registriert/);
 await svc.POST(request("POST",{subscription})); assert.equal((await svc.POST(request("POST",payload))).status,200);
 r=await svc.POST(request("POST",payload)); assert.equal(r.status,429); assert.match((await r.json()).error,/eine Minute warten/);sql.close();
});

test("Diagnose zeigt ausschließlich technische Daten des eigenen Geräts", async () => {
 const {sql,db}=database(); const svc=createPushService({db,config,identify:async req=>req.headers.get("test-user"),send:async()=>201,now:()=>2000000});
 await svc.POST(request("POST",{subscription}));
 sql.prepare("INSERT INTO push_delivery (endpoint,notification_key,attempted_at,sent,last_status) VALUES (?,?,?,?,?)").run(subscription.endpoint,"task-created:secret-task-id",2000000,0,503);
 const payload={action:"diagnostics",endpoint:subscription.endpoint};
 assert.equal((await svc.POST(request("POST",payload,"alias@example.com"))).status,404);
 const response=await svc.POST(request("POST",payload)); const result=await response.json();
 assert.equal(response.status,200); assert.deepEqual(result.attempts,[{time:new Date(2000000).toISOString(),type:"task_created",outcome:"not_accepted",providerStatus:503}]);
 assert.equal(JSON.stringify(result).includes("secret"),false); assert.equal(JSON.stringify(result).includes(subscription.endpoint),false); sql.close();
});

test("Fehlgeschlagener Scheduler-Versuch bewahrt Anbieterstatus für Diagnose", async () => {
 const {sql,db}=database(); const due=Date.UTC(2026,10,16,11), data=Object.fromEntries(householdKeys.map(k=>[k,[]]));
 data.tasks=[{id:1,title:"Privat",status:"open",assignee:"Markus",dueDate:"2026-11-16",dueTime:"12:00"}];
 sql.prepare("INSERT INTO household VALUES (1,1,?,?)").run(JSON.stringify(data),due);
 sql.prepare("INSERT INTO push_subscription (endpoint,author,subscription,created_at,updated_at) VALUES (?,?,?,?,?)").run(subscription.endpoint,"Markus",JSON.stringify(subscription),due-86400000,due);
 await runTaskPush({db,config,send:async()=>503,now:due});
 const row=sql.prepare("SELECT sent,last_status FROM push_delivery").get(); assert.equal(row.sent,0);assert.equal(row.last_status,503);sql.close();
});


test("Kommentar-Push erreicht nur das jeweils andere Konto und meldet alte Kommentare nicht nach", async () => {
 const {sql,db}=database(); const now=2000000000000; const data=Object.fromEntries(householdKeys.map(k=>[k,[]]));
 const comment=(id,author,time,eligible=true)=>({id,author,createdAt:new Date(time).toISOString(),pushEligible:eligible,text:"Privater Text"});
 data.tasks=[{id:1,title:"Aufgabe",status:"open",assignee:"Bettina",comments:[comment("a","Bettina",now-1000),comment("b","Markus",now-2000),comment("old","Bettina",now-3000,false),comment("before","Bettina",now-200000),comment("unknown","Andere",now-1000),null]}];
 sql.prepare("INSERT INTO household VALUES (1,1,?,?)").run(JSON.stringify(data),now);
 const second={...subscription,endpoint:"https://fcm.googleapis.com/fcm/send/device-2"};
 for(const [sub,author] of [[subscription,"Markus"],[second,"Bettina"]]) sql.prepare("INSERT INTO push_subscription (endpoint,author,subscription,created_at,updated_at) VALUES (?,?,?,?,?)").run(sub.endpoint,author,JSON.stringify(sub),now-100000,now);
 const sent=[]; const send=async (sub,msg)=>{sent.push([sub.endpoint,msg]);return 201};
 await runTaskPush({db,config,send,now}); await runTaskPush({db,config,send,now:now+300000});
 assert.equal(sent.length,2); assert.equal(sent[0][0],subscription.endpoint); assert.equal(sent[1][0],second.endpoint); assert.ok(sent.every(([,msg])=>msg.title==="Nest · Neuer Kommentar" && msg.body==="Aufgabe" && !JSON.stringify(msg).includes("Privater Text")));
 const svc=createPushService({db,config,identify:async req=>req.headers.get("test-user"),send,now:()=>now});
 const result=await (await svc.POST(request("POST",{action:"diagnostics",endpoint:subscription.endpoint}))).json();
 assert.equal(result.attempts[0].type,"task_comment"); assert.equal(JSON.stringify(result).includes("Aufgabe"),false);sql.close();
});
