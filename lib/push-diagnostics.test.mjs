import test from "node:test";
import assert from "node:assert/strict";
import {cleanPushDiagnostic,readPushDiagnostics,writePushDiagnostic} from "./push-diagnostics.ts";
test("Gerätediagnose filtert Namen, Endpunkte und unbekannte Kategorien",()=>{
 const raw={time:"2026-11-15T12:00:00.000Z",event:"test",outcome:"error",status:502,providerStatus:403,endpoint:"secret",task:"Milch kaufen",kind:"task_reminder"};
 assert.deepEqual(cleanPushDiagnostic(raw),{time:raw.time,event:"test",outcome:"error",status:502,providerStatus:403,kind:"task_reminder"});
 assert.equal(cleanPushDiagnostic({...raw,event:"secret"}),null); assert.equal(cleanPushDiagnostic({...raw,kind:"secret"}).kind,undefined);
});
test("Nicht verfügbarer Diagnosespeicher wirft keine Fehler",async()=>{
 assert.equal(await writePushDiagnostic({event:"test",outcome:"success"}),false);
 assert.deepEqual(await readPushDiagnostics(),{available:false,entries:[]});
});
