import assert from "node:assert/strict";
import test from "node:test";
import { canPull, decideReconnect } from "./sync-policy.ts";
const base={revision:10,data:"original"};
test("Fremde Änderungen werden bei unveränderten lokalen Daten geladen",()=>{
 assert.equal(decideReconnect(base,"original",11,true,false),"pull");
 assert.equal(decideReconnect(base,"original",11,true,true),"defer-pull");
 assert.equal(canPull(base,"original",false,false),true);
 assert.equal(canPull(base,"original",false,true),false);
});
test("Gleichzeitige lokale und fremde Änderungen bleiben als Konflikt erhalten",()=>{
 assert.equal(decideReconnect(base,"lokal verändert",11,true,false),"conflict");
 assert.equal(canPull(base,"lokal verändert",false,false),false);
 assert.equal(canPull(base,"original",true,false),false);
});
test("Erneutes Verbinden bei gleicher Revision erhält ungespeicherte lokale Änderungen",()=>{
 assert.equal(decideReconnect(base,"lokal verändert",10,true,false),"unchanged");
 assert.equal(decideReconnect(null,"lokal",10,true,false),"choose");
});
