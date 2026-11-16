import assert from "node:assert/strict";
import test from "node:test";
import { taskDraftChanged } from "./task-draft.ts";
const legacy={title:"Test",status:"open",assignee:"Ich",note:"Hinweis"};
const viewed={title:"Test",status:"open",assignee:"Markus",description:"Hinweis",images:[],comments:[]};
test("Alte Aufgaben unverändert ansehen verursacht keine neue Version",()=>{assert.equal(taskDraftChanged(legacy,viewed),false)});
test("Neue Kommentare und geänderte Felder werden erkannt",()=>{
 assert.equal(taskDraftChanged(legacy,{...viewed,description:"Neu"}),true);
 assert.equal(taskDraftChanged(legacy,{...viewed,comments:[{id:"1"}]}),true);
 assert.equal(taskDraftChanged(legacy,{...viewed,images:["bild"]}),true);
});
