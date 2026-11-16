import type { HouseholdData } from "./household-data.ts";
import type { CommentAuthor } from "./household-identity.ts";

export type NoticeSection = "shopping" | "tasks" | "recipes";
export type PreviewKind = "new-item" | "purchased" | "new-task" | "completed-task";
export type NoticePreview = { key: string; kind: PreviewKind; label: string; at: number };
export type NoticeState = { shopping: string[]; tasks: string[]; recipes: string[]; newItems: number[]; seenItems?: number[]; previews?: NoticePreview[] };
export const emptyNotices = (): NoticeState => ({ shopping: [], tasks: [], recipes: [], newItems: [], previews: [] });
type IdRecord = { id: string | number };
type Task = IdRecord & { title: string; done?: boolean; completedAt?: string; createdBy?: CommentAuthor; completedBy?: CommentAuthor; comments?: { id: string; author?: CommentAuthor }[]; images?: string[]; imageAuthors?: (CommentAuthor | null)[] };
type Item = { id: number; name: string; addedAt?: number; createdBy?: CommentAuthor };
type Purchase = { id: string; item: Item; checkedAt: number; actor?: CommentAuthor };
const ids = (items: unknown[]) => new Set((items as IdRecord[]).map((item) => item.id));
const union = <T,>(a: T[], b: T[]) => [...new Set([...a, ...b])];

// Compare incoming data with both the common ancestor and this device. This
// excludes things already created locally, including unsent local changes.
export function incomingNotices(state: NoticeState, base: HouseholdData, local: HouseholdData, remote: HouseholdData, viewer: CommentAuthor | null): NoticeState {
  const other = (author: unknown) => Boolean(viewer && (author === "Markus" || author === "Bettina") && author !== viewer);
  const oldItems = ids(base.items), localItems = ids(local.items);
  const newItems = (remote.items as Item[]).filter((item) => !oldItems.has(item.id) && !localItems.has(item.id) && other(item.createdBy));
  const additions = newItems.map((item) => item.id);
  const liveItems = ids(remote.items);
  const oldRecipes = ids(base.recipes), localRecipes = ids(local.recipes);
  const recipes = (remote.recipes as (IdRecord & { createdBy?: CommentAuthor })[]).filter((recipe) => !oldRecipes.has(recipe.id) && !localRecipes.has(recipe.id) && other(recipe.createdBy)).map((recipe) => `recipe:${recipe.id}`);
  const before = new Map((base.tasks as Task[]).map((task) => [task.id, task]));
  const here = new Map((local.tasks as Task[]).map((task) => [task.id, task]));
  const remoteTasks = new Map((remote.tasks as Task[]).map((task) => [task.id, task]));
  const events: string[] = [];
  const previews: NoticePreview[] = [];
  const observedAt = Date.now();
  const addPreview = (key: string, kind: PreviewKind, label: string, at: number) => previews.push({ key, kind, label, at: Number.isFinite(at) && at > 0 ? at : observedAt });
  for (const item of newItems) addPreview(`item:${item.id}`, "new-item", item.name, item.addedAt ?? (item.id > 946684800000 ? item.id : observedAt));
  const oldPurchases = ids(base.purchaseHistory), localPurchases = ids(local.purchaseHistory);
  const livePurchases = ids(remote.purchaseHistory);
  const purchases = (remote.purchaseHistory as Purchase[]).filter((record) => !oldPurchases.has(record.id) && !localPurchases.has(record.id) && other(record.actor));
  for (const purchase of purchases) addPreview(`purchase:${purchase.id}`, "purchased", purchase.item.name, purchase.checkedAt);
  for (const task of remote.tasks as Task[]) {
    const old = before.get(task.id), mine = here.get(task.id);
    if (!old) {
      if (!mine && other(task.done ? task.completedBy : task.createdBy)) {
        const key = task.done ? `done:${task.id}:${task.completedAt ?? ""}` : `task:${task.id}`;
        events.push(key);
        addPreview(key, task.done ? "completed-task" : "new-task", task.title, task.done ? Date.parse(task.completedAt ?? "") : typeof task.id === "number" && task.id > 946684800000 ? task.id : observedAt);
      }
      continue;
    }
    if (!mine) continue;
    if (!old.done && task.done && !mine.done && other(task.completedBy)) {
      const key = `done:${task.id}:${task.completedAt ?? ""}`;
      events.push(key); addPreview(key, "completed-task", task.title, Date.parse(task.completedAt ?? ""));
    }
    const oldComments = new Set((old.comments ?? []).map((comment) => comment.id));
    const myComments = new Set((mine.comments ?? []).map((comment) => comment.id));
    for (const comment of task.comments ?? []) if (!oldComments.has(comment.id) && !myComments.has(comment.id) && other(comment.author)) events.push(`comment:${task.id}:${comment.id}`);
    const oldImages = new Set(old.images ?? []), myImages = new Set(mine.images ?? []);
    for (const [index, image] of (task.images ?? []).entries()) if (!oldImages.has(image) && !myImages.has(image) && other(task.imageAuthors?.[index])) events.push(`image:${task.id}:${image}`);
  }
  const shopping = union(state.shopping.filter((key) => key.startsWith("item:") ? liveItems.has(Number(key.slice(5))) : key.startsWith("purchase:") ? livePurchases.has(key.slice(9)) : true), [...additions.map((id) => `item:${id}`), ...purchases.map((purchase) => `purchase:${purchase.id}`)]);
  const tasks = union(state.tasks.filter((key) => {
    if (key.startsWith("task:")) { const task = remoteTasks.get(Number(key.slice(5))); return Boolean(task && !task.done); }
    if (key.startsWith("done:")) return Boolean(remoteTasks.get(Number(key.split(":")[1]))?.done);
    return true;
  }), events);
  const liveKeys = new Set([...shopping, ...tasks]);
  const previous = (state.previews ?? []).filter((preview) => !preview.key.startsWith("local:") && liveKeys.has(preview.key));
  const unique = new Map([...previews, ...previous].map((preview) => [preview.key, preview]));
  return { shopping, tasks, recipes: union(state.recipes, recipes), newItems: union(state.newItems.filter((id) => liveItems.has(id)), additions), ...(state.seenItems ? { seenItems: state.seenItems.filter((id) => liveItems.has(id)) } : {}), previews: [...unique.values()] };
}

export function describeNotices(state: NoticeState, section: NoticeSection): string[] {
  const count = (prefix: string) => state[section].filter((entry) => entry.startsWith(`${prefix}:`)).length;
  const part = (n: number, singular: string, plural: string) => n ? `${n} ${n === 1 ? singular : plural}` : "";
  if (section === "shopping") return [part(count("item"), "neuer Artikel", "neue Artikel"), part(count("purchase"), "Artikel eingekauft", "Artikel eingekauft")].filter(Boolean);
  if (section === "recipes") return [part(count("recipe"), "neues Rezept", "neue Rezepte")].filter(Boolean);
  return [part(count("task"), "neue Aufgabe", "neue Aufgaben"), part(count("done"), "Aufgabe erledigt", "Aufgaben erledigt"), part(count("comment"), "neuer Kommentar", "neue Kommentare"), part(count("image"), "neues Foto", "neue Fotos")].filter(Boolean);
}

export function noticePreviews(state: NoticeState, kind: PreviewKind): NoticePreview[] {
  const active = new Set([...state.shopping, ...state.tasks]);
  return (state.previews ?? []).filter((preview) => preview.kind === kind && active.has(preview.key)).sort((a, b) => b.at - a.at).slice(0, 4);
}
