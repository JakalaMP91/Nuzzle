type EditableTask = { title: string; status: string; assignee: string; dueDate?: string; dueTime?: string; reminderMinutes?: number; description?: string; note?: string; priority?: string; images?: string[]; comments?: unknown[] };
const normalizedAssignee = (value: string) => value === "Ich" ? "Markus" : value === "Partner" ? "Bettina" : value;
export function taskDraftChanged(before: EditableTask, after: EditableTask): boolean {
  return before.title !== after.title || before.status !== after.status || normalizedAssignee(before.assignee) !== after.assignee ||
    (before.dueDate ?? "") !== (after.dueDate ?? "") || (before.dueTime ?? "") !== (after.dueTime ?? "") || (before.reminderMinutes ?? 0) !== (after.reminderMinutes ?? 0) ||
    (before.description ?? before.note ?? "").trim() !== (after.description ?? "").trim() || (before.priority ?? "") !== (after.priority ?? "") ||
    JSON.stringify(before.images ?? []) !== JSON.stringify(after.images ?? []) || JSON.stringify(before.comments ?? []) !== JSON.stringify(after.comments ?? []);
}
