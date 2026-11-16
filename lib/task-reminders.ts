export type ReminderTask = { id: number; title: string; assignee: string; dueDate?: string; dueTime?: string; reminderMinutes?: number; done?: boolean };
export const reminderOptions = [
  { value: 1440, label: "1 Tag vorher" }, { value: 120, label: "2 Stunden vorher" },
  { value: 60, label: "1 Stunde vorher" }, { value: 15, label: "15 Minuten vorher" },
  { value: 0, label: "Zum Termin" }, { value: -1, label: "Keine Benachrichtigung" },
] as const;
const berlin = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function wallClock(timestamp: number): number {
  const parts = Object.fromEntries(berlin.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}
// Dates are shared household appointments in Europe/Berlin, including DST.
// Without a time, the whole calendar day remains available.
export function taskDueAt(task: Pick<ReminderTask, "dueDate" | "dueTime">): number | null {
  if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || (task.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime))) return null;
  const [year, month, day] = task.dueDate.split("-").map(Number);
  const [hour, minute] = (task.dueTime || "23:59").split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, task.dueTime ? 0 : 59);
  if (new Date(target).toISOString().slice(0, 10) !== task.dueDate) return null;
  let result = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const difference = target - wallClock(result);
    if (!difference) return result + (task.dueTime ? 0 : 999);
    result += difference;
  }
  return null; // Nonexistent local time at the spring DST change.
}
// Notification time for date-only tasks is independent from end-of-day visual status.
export function taskNotificationAt(task: Pick<ReminderTask, "dueDate" | "dueTime">, defaultTime = "08:00"): number | null {
  return taskDueAt({ ...task, dueTime: task.dueTime || defaultTime });
}
export function taskReminderState(task: ReminderTask, now: number): "none" | "upcoming" | "overdue" {
  if (task.done) return "none";
  const due = taskDueAt(task);
  if (due === null) return "none";
  if (now >= due) return "overdue";
  const today = new Date(wallClock(now)).toISOString().slice(0, 10);
  return today === task.dueDate ? "upcoming" : "none";
}
