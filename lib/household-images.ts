import type { HouseholdData } from "./household-data.ts";

export const maxImageDataLength = 1_300_000;
export const maxHouseholdInputBytes = 8_000_000;
const imageDataPattern = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const imagePathPattern = /^\/api\/household-image\?id=([a-f0-9]{64})$/;
type RecipeImage = { id?: unknown; image?: unknown; [key: string]: unknown };

export function isEmbeddedImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}
export function imageIdFromPath(value: unknown): string | null {
  return typeof value === "string" ? imagePathPattern.exec(value)?.[1] ?? null : null;
}
export function imagePayload(content: string): { mime: string; encoded: string } | null {
  if (content.length > maxImageDataLength) return null;
  const match = imageDataPattern.exec(content);
  if (!match || match[2].length % 4 !== 0) return null;
  return { mime: "image/" + match[1], encoded: match[2] };
}
export async function imageId(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function normalizeHouseholdImages(data: HouseholdData): Promise<{ data: HouseholdData; images: { id: string; content: string }[] }> {
  const images = new Map<string, string>();
  async function normalize(value: unknown): Promise<unknown> {
    if (!isEmbeddedImage(value)) return value;
    if (!imagePayload(value)) throw new Error("Ein Bild ist ungültig oder zu groß.");
    const id = await imageId(value);
    images.set(id, value);
    return "/api/household-image?id=" + id;
  }
  const recipes = await Promise.all((data.recipes as RecipeImage[]).map(async (recipe) => {
    return isEmbeddedImage(recipe.image) ? { ...recipe, image: await normalize(recipe.image) } : recipe;
  }));
  const tasks = await Promise.all((data.tasks as RecipeImage[]).map(async (task) => Array.isArray(task.images)
    ? { ...task, images: await Promise.all(task.images.map(normalize)) } : task));
  if (images.size > 30) throw new Error("Bitte höchstens 30 neue Bilder gleichzeitig synchronisieren.");
  return { data: { ...data, recipes, tasks }, images: Array.from(images, ([id, content]) => ({ id, content })) };
}

export function applyTaskImageReplacements(current: unknown[], before: unknown[], after: unknown[]): unknown[] {
  const replacements = new Map<unknown, Map<string, string>>();
  for (let i = 0; i < before.length; i++) {
    const oldTask = before[i] as RecipeImage;
    const newTask = after[i] as RecipeImage | undefined;
    if (!Array.isArray(oldTask?.images) || !Array.isArray(newTask?.images) || oldTask.id !== newTask.id) continue;
    const map = new Map<string, string>();
    oldTask.images.forEach((value: unknown, index: number) => {
      const next = (newTask.images as unknown[])[index];
      if (typeof value === "string" && typeof next === "string" && value !== next) map.set(value, next);
    });
    replacements.set(oldTask.id, map);
  }
  return current.map((entry) => {
    const task = entry as RecipeImage;
    const map = replacements.get(task.id);
    return map && Array.isArray(task.images) ? { ...task, images: task.images.map((image: string) => map.get(image) ?? image) } : entry;
  });
}

// Applying only image changes prevents an upload response from overwriting
// edits made while that upload was in flight.
export function applyImageReplacements(current: unknown[], before: unknown[], after: unknown[]): unknown[] {
  const replacements = new Map<string, { before: string; after: string }>();
  for (let i = 0; i < before.length; i++) {
    const oldRecipe = before[i] as RecipeImage;
    const newRecipe = after[i] as RecipeImage | undefined;
    if (typeof oldRecipe?.id === "string" && typeof oldRecipe.image === "string" && typeof newRecipe?.image === "string" && oldRecipe.image !== newRecipe.image) {
      replacements.set(oldRecipe.id, { before: oldRecipe.image, after: newRecipe.image });
    }
  }
  return current.map((entry) => {
    const recipe = entry as RecipeImage;
    const replacement = typeof recipe?.id === "string" ? replacements.get(recipe.id) : undefined;
    return replacement && recipe.image === replacement.before ? { ...recipe, image: replacement.after } : entry;
  });
}
