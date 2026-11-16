import type { HouseholdData } from "./household-data.ts";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shoppingKeys = ["items", "recent", "recipeRecent", "pantry", "purchaseHistory"] as const;
const recipeKeys = ["recipes", "customCategories"] as const;
export type MergeConflictArea = "shopping" | "recipes" | "tasks";
type Identified = { id: string | number };

// Preserve the relative order of existing records and insertions from each
// device. Only pure additions are eligible; edits, removals and reorders stay
// conflicts so cross-list moves cannot be silently undone.
function mergeAdditions(base: unknown[], local: unknown[], remote: unknown[]): unknown[] | null {
  const valid = (list: unknown[]): list is Identified[] => list.every((x) => Boolean(x && typeof x === "object" && (typeof (x as Identified).id === "string" || typeof (x as Identified).id === "number"))) && new Set(list.map((x) => (x as Identified).id)).size === list.length;
  if (!valid(base) || !valid(local) || !valid(remote)) return null;
  const baseById = new Map(base.map((x) => [x.id, x]));
  const split = (list: Identified[]) => {
    const gaps: Identified[][] = Array.from({ length: base.length + 1 }, () => []);
    let index = 0;
    for (const entry of list) {
      if (baseById.has(entry.id)) {
        if (index >= base.length || entry.id !== base[index].id || !same(entry, base[index])) return null;
        index++;
      } else gaps[index].push(entry);
    }
    return index === base.length ? gaps : null;
  };
  const left = split(local), right = split(remote);
  if (!left || !right) return null;
  const newLeft = new Map(local.filter((x) => !baseById.has(x.id)).map((x) => [x.id, x]));
  const rightNew = remote.filter((x) => !baseById.has(x.id));
  // An identical insertion must also occupy the same gap in both orders.
  for (const entry of rightNew) if (newLeft.has(entry.id)) {
    if (!same(newLeft.get(entry.id), entry)) return null;
    if (left.findIndex((gap) => gap.some((x) => x.id === entry.id)) !== right.findIndex((gap) => gap.some((x) => x.id === entry.id))) return null;
  }
  for (let i = 0; i <= base.length; i++) {
    const sharedIds = new Set(right[i].filter((entry) => newLeft.has(entry.id)).map((entry) => entry.id));
    if (!same(left[i].filter((entry) => sharedIds.has(entry.id)).map((entry) => entry.id), right[i].filter((entry) => sharedIds.has(entry.id)).map((entry) => entry.id))) return null;
  }
  const result: Identified[] = [];
  for (let i = 0; i <= base.length; i++) {
    result.push(...left[i], ...right[i].filter((entry) => !newLeft.has(entry.id)));
    if (i < base.length) result.push(base[i]);
  }
  return result;
}
type Task = Record<string, unknown> & { id: number };

// A missing value is distinct from a field whose value is null.
const absent = Symbol("absent");
function mergeTask(base: Task, local: Task, remote: Task): Task | null {
  const result: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = Object.hasOwn(base, key) ? base[key] : absent;
    const l = Object.hasOwn(local, key) ? local[key] : absent;
    const r = Object.hasOwn(remote, key) ? remote[key] : absent;
    let value: unknown;
    if (same(l, r)) value = l;
    else if (same(l, b)) value = r;
    else if (same(r, b)) value = l;
    else return null;
    if (value !== absent) result[key] = value;
  }
  return result as Task;
}

// Use the common ancestor; preserve conflicts whenever changes cannot be
// proven independent. Never include field contents in conflict diagnostics.
export function mergeHousehold(base: HouseholdData, local: HouseholdData, remote: HouseholdData, onConflict?: (area: MergeConflictArea) => void): HouseholdData | null {
  const conflict = (area: MergeConflictArea): null => { onConflict?.(area); return null; };
  const pickGroup = (keys: readonly (keyof HouseholdData)[]) => {
    const group = (data: HouseholdData) => keys.map((key) => data[key]);
    if (same(group(local), group(remote))) return local;
    if (same(group(base), group(local))) return remote;
    if (same(group(base), group(remote))) return local;
    return null;
  };
  let shopping = pickGroup(shoppingKeys);
  if (!shopping) {
    const merged = { ...base };
    for (const key of shoppingKeys) {
      const result = mergeAdditions(base[key], local[key], remote[key]);
      if (!result) return conflict("shopping");
      merged[key] = result;
    }
    shopping = merged;
  }
  const recipes = pickGroup(recipeKeys);
  if (!recipes) return conflict("recipes");
  const other = { ...shopping, recipes: recipes.recipes, customCategories: recipes.customCategories };
  const taskGroup = pickGroup(["tasks", "taskLanes"]);
  if (taskGroup) return { ...other, tasks: taskGroup.tasks, taskLanes: taskGroup.taskLanes };
  // Lane changes can move or orphan tasks, so do not mix them with task edits.
  if (!same(base.taskLanes, local.taskLanes) || !same(base.taskLanes, remote.taskLanes)) return conflict("tasks");
  const b = base.tasks as Task[], l = local.tasks as Task[], r = remote.tasks as Task[];
  const ids = (tasks: Task[]) => tasks.map((task) => task.id);
  if ([b, l, r].some((tasks) => new Set(ids(tasks)).size !== tasks.length)) return conflict("tasks");
  const order = same(ids(l), ids(r)) ? l : same(ids(b), ids(l)) ? r : same(ids(b), ids(r)) ? l : null;
  if (!order) return conflict("tasks");
  const bm = new Map(b.map((task) => [task.id, task]));
  const lm = new Map(l.map((task) => [task.id, task]));
  const rm = new Map(r.map((task) => [task.id, task]));
  const merged = new Map<number, Task>();
  for (const id of new Set([...bm.keys(), ...lm.keys(), ...rm.keys()])) {
    const before = bm.get(id), left = lm.get(id), right = rm.get(id);
    let value: Task | undefined | null;
    if (same(left, right)) value = left;
    else if (same(left, before)) value = right;
    else if (same(right, before)) value = left;
    else if (before && left && right) value = mergeTask(before, left, right);
    else return conflict("tasks");
    if (value === null) return conflict("tasks");
    if (value) merged.set(id, value);
  }
  if (merged.size !== order.length || order.some((task) => !merged.has(task.id))) return conflict("tasks");
  return { ...other, taskLanes: base.taskLanes, tasks: order.map((task) => merged.get(task.id)!) };
}
