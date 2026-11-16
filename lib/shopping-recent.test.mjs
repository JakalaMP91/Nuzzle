import test from "node:test";
import assert from "node:assert/strict";
import { groupRecentPurchases, recentPurchaseTime } from "./shopping-recent.ts";
const time=(iso)=>Date.parse(iso);
test("Gruppen folgen Berliner Kalendertagen und sind absteigend sortiert",()=>{
 const now=time("2026-11-15T12:00:00Z");
 const entries=[{id:1,lastPurchasedAt:time("2026-11-12T13:00:00Z")},{id:2,lastPurchasedAt:time("2026-11-15T01:00:00Z")},{id:3,lastPurchasedAt:time("2026-11-14T23:30:00Z")},{id:4,lastPurchasedAt:time("2026-11-14T20:00:00Z")},{id:5,lastPurchasedAt:time("2026-11-13T12:00:00Z")},{id:6,lastPurchasedAt:time("2026-11-01T12:00:00Z")},{id:7,lastPurchasedAt:time("2026-10-31T12:00:00Z")},{id:8}];
 const groups=groupRecentPurchases(entries,now);
 assert.deepEqual(groups.map(g=>g.label),["Heute","Gestern","Vorgestern","Vor 3 Tagen","Vor 14 Tagen","Vor über 2 Wochen","Datum unbekannt"]);
 assert.deepEqual(groups[0].items.map(x=>x.id),[2,3]);
});
test("Zeitstempel alter Einträge nur bei plausibler ID und nicht bei zukünftigen Daten",()=>{
 const now=time("2026-11-15T12:00:00Z"), y=time("2026-11-14T10:00:00Z");
 assert.equal(recentPurchaseTime({id:y+0.5},now),y+0.5); assert.equal(recentPurchaseTime({id:101},now),null); assert.equal(recentPurchaseTime({id:now+100},now),null);
 const group=groupRecentPurchases([{id:y}],now); assert.equal(group[0].label,"Gestern");
});
test("Sommerzeitwechsel trennt Kalendertage statt 24-Stunden-Abstände",()=>{
 const now=time("2026-03-29T10:00:00Z"), yesterday=time("2026-03-28T22:00:00Z");
 assert.equal(groupRecentPurchases([{id:yesterday}],now)[0].label,"Gestern");
});
