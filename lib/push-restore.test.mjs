import test from "node:test";
import assert from "node:assert/strict";
import { restorePushDevice } from "./push-restore.ts";
test("Vorhandene Browseranmeldung wird ohne lokalen Merker wiederhergestellt", async () => {
 let registered=0; assert.equal(await restorePushDevice("granted",async()=>({id:1}),async()=>{registered++}),"enabled"); assert.equal(registered,1);
});
test("Fehlende Berechtigung oder Subscription wird ohne erneute Berechtigungsabfrage erkannt", async () => {
 let called=false; assert.equal(await restorePushDevice("denied",async()=>{called=true;return null},async()=>{}),"disabled"); assert.equal(called,false);
 assert.equal(await restorePushDevice("granted",async()=>null,async()=>{throw Error("unexpected")}),"disabled");
});
test("Vorübergehender Serverfehler wird nicht als deaktiviertes Gerät interpretiert", async () => {
 await assert.rejects(restorePushDevice("granted",async()=>({id:1}),async()=>{throw new TypeError("network")}),TypeError);
});
