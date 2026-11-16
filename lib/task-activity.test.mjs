import assert from "node:assert/strict";
import test from "node:test";
import { taskActivity, mergeReadCommentIds } from "./task-activity.ts";

test("Zähler unterscheiden gelesene, eigene und neue Kommentare sowie Bilder", () => {
  const comments=[{id:"one",author:"Markus"},{id:"two",author:"Bettina"},{id:"three",author:"Bettina"}];
  assert.deepEqual(taskActivity(comments, ["a","b"], ["two"], "Markus"), {comments:3,unread:1,images:2});
  assert.deepEqual(taskActivity(comments, [], ["two"], null), {comments:3,unread:2,images:0});
  assert.deepEqual(taskActivity(undefined, undefined, undefined, null), {comments:0,unread:0,images:0});
  assert.deepEqual(mergeReadCommentIds(["one"], comments), ["one","two","three"]);
});
