import { normalizeRecipeUrl } from "./recipe-url.ts";

const MAX_HTML_BYTES = 2_000_000;
const MAX_SUMMARY_CHARS = 18_000;
const MAX_IMAGE_BYTES = 4_000_000;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown, limit = 2_000): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function findRecipe(value: unknown): JsonObject | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipe(item);
      if (found) return found;
    }
  } else if (isObject(value)) {
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.some((type) => typeof type === "string" && type.toLowerCase() === "recipe")) return value;
    for (const key of ["@graph", "mainEntity", "itemListElement"]) {
      const found = findRecipe(value[key]);
      if (found) return found;
    }
  }
  return null;
}

function instructionTexts(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(instructionTexts);
  if (typeof value === "string") return clean(value, 3_000) ? [clean(value, 3_000)] : [];
  if (!isObject(value)) return [];
  if (value.itemListElement) return instructionTexts(value.itemListElement);
  if (value.steps) return instructionTexts(value.steps);
  const text = clean(value.text, 3_000);
  return text ? [text] : [];
}

function imageCandidate(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(imageCandidate).find(Boolean) ?? null;
  if (isObject(value)) return imageCandidate(value.url ?? value.contentUrl);
  return null;
}

function absoluteImageUrl(candidate: string | null, pageUrl: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate.replace(/&amp;/gi, "&"), pageUrl).toString();
    return url.startsWith("https://") && normalizeRecipeUrl(url) === url ? url : null;
  } catch { return null; }
}

export function extractRecipePage(html: string, pageUrl: string): { summary: string | null; imageUrl: string | null } {
  let imageUrl: string | null = null;
  let summary: string | null = null;
  const scripts = html.matchAll(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script\s*>/gi);
  for (const match of scripts) {
    try {
      if (match[1].length > 250_000) continue;
      const recipe = findRecipe(JSON.parse(match[1]));
      if (!recipe) continue;
      imageUrl = absoluteImageUrl(imageCandidate(recipe.image), pageUrl);
      const title = clean(recipe.name, 160);
      const ingredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient.map((item) => clean(item, 300)).filter(Boolean).slice(0, 100) : [];
      if (!title || ingredients.length === 0) continue;
      const steps = instructionTexts(recipe.recipeInstructions).slice(0, 50);
      const category = Array.isArray(recipe.recipeCategory) ? recipe.recipeCategory.map((item) => clean(item, 100)) : [clean(recipe.recipeCategory, 100)];
      const candidateSummary = JSON.stringify({
        title,
        description: clean(recipe.description, 1_000),
        totalTime: clean(recipe.totalTime, 50),
        prepTime: clean(recipe.prepTime, 50),
        cookTime: clean(recipe.cookTime, 50),
        recipeYield: Array.isArray(recipe.recipeYield) ? recipe.recipeYield.map((item) => clean(item, 100)) : clean(recipe.recipeYield, 100),
        categories: category.filter(Boolean),
        ingredients,
        steps,
      });
      summary = candidateSummary.length <= MAX_SUMMARY_CHARS ? candidateSummary : null;
      break;
    } catch {
      // Ungültiges JSON-LD einer Seite überspringen.
    }
  }
  if (!imageUrl) {
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
      const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]]));
      if (["og:image", "twitter:image"].includes(attributes.property ?? attributes.name)) {
        imageUrl = absoluteImageUrl(attributes.content ?? null, pageUrl);
        if (imageUrl) break;
      }
    }
  }
  return { summary, imageUrl };
}

export function extractRecipeSummary(html: string): string | null {
  return extractRecipePage(html, "https://example.com/").summary;
}

export async function fetchRecipePage(url: string): Promise<{ summary: string | null; imageUrl: string | null }> {
  try {
    let current = url;
    for (let redirect = 0; redirect <= 3; redirect++) {
      // Der direkte Abruf ist auf HTTPS-Seiten beschränkt. HTTP nutzt weiter Gemini URL Context.
      if (!current.startsWith("https://") || normalizeRecipeUrl(current) !== current) break;
      const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) break;
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) break;
      if (Number(response.headers.get("content-length") ?? 0) > MAX_HTML_BYTES || !response.body) break;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_HTML_BYTES) { await reader.cancel(); return { summary: null, imageUrl: null }; }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return extractRecipePage(new TextDecoder().decode(bytes), current);
    }
  } catch {
    // Netzwerkfehler und Seiten ohne lesbare strukturierte Daten nutzen den bisherigen Importweg.
  }
  return { summary: null, imageUrl: null };
}

export async function fetchRecipeImage(url: string): Promise<string | null> {
  try {
    let current = url;
    for (let redirect = 0; redirect <= 3; redirect++) {
      if (!current.startsWith("https://") || normalizeRecipeUrl(current) !== current) return null;
      const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Accept: "image/jpeg,image/png,image/webp" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      const mimeType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(mimeType ?? "") || Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES || !response.body) return null;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_BYTES) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
    }
  } catch {
    // Fehlt das Bild oder sperrt die Website den Abruf, bleibt das Rezept importierbar.
  }
  return null;
}
