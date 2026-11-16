export const householdKeys = ["items", "recent", "recipeRecent", "pantry", "purchaseHistory", "recipes", "customCategories", "tasks", "taskLanes"] as const;
export type HouseholdData = Record<(typeof householdKeys)[number], unknown[]>;
export const maxHouseholdBytes = 1_500_000;

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const strings = (value: unknown) => Array.isArray(value) && value.every((entry) => typeof entry === "string");
const shopping = (value: unknown) => record(value) && typeof value.id === "number" && typeof value.name === "string" && typeof value.icon === "string";
const ingredient = (value: unknown) => record(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.detail === "string" && typeof value.icon === "string";
const step = (value: unknown) => record(value) && typeof value.id === "string" && typeof value.text === "string" && strings(value.ingredientIds) &&
  (value.ingredientAmounts === undefined || (record(value.ingredientAmounts) && Object.values(value.ingredientAmounts).every((amount) => typeof amount === "string")));
const version = (value: unknown) => record(value) && typeof value.id === "string" && typeof value.title === "string" &&
  Array.isArray(value.ingredients) && value.ingredients.every(ingredient) && Array.isArray(value.steps) && value.steps.every(step);
const recipe = (value: unknown) => record(value) && typeof value.id === "string" && typeof value.title === "string" &&
  typeof value.description === "string" && strings(value.categories) && ["bread", "pot", "cake"].includes(String(value.icon)) &&
  Array.isArray(value.ingredients) && value.ingredients.every(ingredient) &&
  (value.steps === undefined || (Array.isArray(value.steps) && value.steps.every(step))) &&
  (value.versions === undefined || (Array.isArray(value.versions) && value.versions.every(version)));

export function parseHouseholdData(value: unknown, byteLimit = maxHouseholdBytes): HouseholdData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length !== householdKeys.length || householdKeys.some((key) => !Array.isArray(obj[key]))) return null;
  const records = householdKeys.filter((key) => key !== "customCategories");
  if (records.some((key) => (obj[key] as unknown[]).some((item) => !item || typeof item !== "object" || Array.isArray(item)))) return null;
  if ((obj.customCategories as unknown[]).some((item) => typeof item !== "string")) return null;
  if (["items", "recent", "recipeRecent", "pantry"].some((key) => !(obj[key] as unknown[]).every(shopping))) return null;
  if (!(obj.purchaseHistory as unknown[]).every((item) => record(item) && typeof item.id === "string" && typeof item.checkedAt === "number" && shopping(item.item))) return null;
  if (!(obj.recipes as unknown[]).every(recipe)) return null;
  if (!(obj.tasks as unknown[]).every((item) => record(item) && typeof item.id === "number" && typeof item.title === "string" && typeof item.status === "string" && typeof item.assignee === "string")) return null;
  if (!(obj.taskLanes as unknown[]).every((item) => record(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.color === "string")) return null;
  if (new TextEncoder().encode(JSON.stringify(obj)).byteLength > byteLimit) return null;
  return Object.fromEntries(householdKeys.map((key) => [key, obj[key]])) as HouseholdData;
}
