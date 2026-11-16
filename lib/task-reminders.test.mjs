import test from "node:test";
import assert from "node:assert/strict";
import { taskDueAt, taskReminderState } from "./task-reminders.ts";
const task = { id: 1, title: "Gießen", assignee: "Gemeinsam", dueDate: "2026-11-15", dueTime: "12:00" };
test("markiert nur am Fälligkeitstag und wechselt exakt zur Fälligkeit", () => {
  const due = taskDueAt(task);
  assert.equal(due, Date.parse("2026-11-15T11:00:00Z"));
  assert.equal(taskReminderState(task, due - 86400001), "none");
  assert.equal(taskReminderState(task, due - 86400000), "none");
  assert.equal(taskReminderState(task, Date.parse("2026-11-14T22:59:59Z")), "none");
  assert.equal(taskReminderState(task, Date.parse("2026-11-14T23:00:00Z")), "upcoming");
  assert.equal(taskReminderState(task, due), "overdue");
  assert.equal(taskReminderState({ ...task, done: true }, due + 1), "none");
  assert.equal(taskReminderState({ ...task, reminderMinutes: -1 }, due - 1), "upcoming");
  assert.equal(taskReminderState({ ...task, reminderMinutes: 15 }, due - 16 * 60000), "upcoming");
});
test("Datum ohne Uhrzeit bleibt bis Tagesende offen", () => {
  assert.equal(taskDueAt({ dueDate: "2026-11-15" }), Date.parse("2026-11-15T22:59:59.999Z"));
  assert.equal(taskDueAt({ dueDate: "2026-07-15", dueTime: "12:00" }), Date.parse("2026-07-15T10:00:00Z"));
});
test("behandelt Sommerzeit und lehnt ungültige Termine ab", () => {
  assert.equal(taskDueAt({ dueDate: "2026-03-29", dueTime: "01:30" }), Date.parse("2026-03-29T00:30Z"));
  assert.equal(taskDueAt({ dueDate: "2026-03-29", dueTime: "02:30" }), null);
  assert.equal(taskDueAt({ dueDate: "2026-03-29", dueTime: "03:30" }), Date.parse("2026-03-29T01:30Z"));
  assert.equal(taskDueAt({ dueDate: "2026-02-30", dueTime: "12:00" }), null);
  assert.equal(taskDueAt({ dueDate: "2026-11-15", dueTime: "25:00" }), null);
  assert.equal(taskReminderState({ ...task, dueDate: undefined }, Date.now()), "none");
});
