import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
test("Service Worker zeigt Push auch ohne Diagnosespeicher", async () => {
 const handlers={}, shown=[]; const self={addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,options)=>shown.push({title,options})}};
 const context={self,indexedDB:{open(){throw new Error("blocked")}},setTimeout,clearTimeout,Promise,URL,Date};
 vm.runInNewContext(readFileSync(new URL("../public/sw.js",import.meta.url),"utf8"),context);
 let pending; handlers.push({data:{json:()=>({title:"Privat",body:"Inhalt",tag:"nest-test"})},waitUntil:p=>pending=p});
 await pending; assert.equal(shown.length,1); assert.equal(shown[0].title,"Privat");
});
