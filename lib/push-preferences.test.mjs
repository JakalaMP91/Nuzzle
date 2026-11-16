import assert from "node:assert/strict";
import test from "node:test";
import { shoppingNotifications, reminderForDevice } from "./push-scheduler.ts";
import { taskNotificationAt, taskReminderState } from "./task-reminders.ts";
test("Tagesaufgabe: 8 Uhr oder Gerätezeit, ohne frühere Fälligkeit", () => {
 const task={id:1,title:"A",assignee:"Gemeinsam",dueDate:"2026-06-01"}; const due=taskNotificationAt(task);
 assert.equal(new Date(due).toISOString(),"2026-06-01T06:00:00.000Z");
 assert.equal(new Date(taskNotificationAt(task,"09:30")).toISOString(),"2026-06-01T07:30:00.000Z");
 assert.equal(reminderForDevice(task,"Markus",due-86400000,due-1),null); assert.equal(reminderForDevice(task,"Markus",due-86400000,due).state,"overdue"); assert.equal(taskReminderState(task,due),"upcoming");
});
test("Einkauf: Karenzzeit, Fehlklick, eigene und rückgängig gemachte Änderungen", () => {
 const now=2000000000000, old=now-1800000, recent=now-60000; const item={id:old,name:"Milch",addedAt:old,createdBy:"Bettina"};
 const data={items:[item,{id:recent,name:"Kaffee",addedAt:recent,createdBy:"Bettina"},{...item,id:old+1,createdBy:"Markus"}],purchaseHistory:[{id:"ok",item,checkedAt:now-360000,actor:"Bettina"},{id:"misclick",item:{...item,addedAt:now-400000},checkedAt:now-360000,actor:"Bettina"},{id:"undo-window",item,checkedAt:recent,actor:"Bettina"}]};
 assert.deepEqual(shoppingNotifications(data,"Markus",now-3600000,now).map(x=>x.key),[`shopping-add:${old}`,"shopping-bought:ok"]);
 assert.deepEqual(shoppingNotifications({items:[],purchaseHistory:[]},"Markus",now-3600000,now),[]);
 assert.deepEqual(shoppingNotifications(data,"Markus",now-120000,now),[]);
});
