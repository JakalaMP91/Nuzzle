export type VersionIngredient = { id: string; name: string; detail: string; icon: string; optional?: boolean; pantry?: boolean };
export type VersionStep = { id: string; text: string; ingredientIds: string[]; ingredientAmounts?: Record<string, string>; output?: string; inputStepIds?: string[] };
export type Version<T extends VersionIngredient = VersionIngredient> = { id: string; title: string; ingredients: T[]; steps: VersionStep[] };

type Patch<T extends VersionIngredient> = {
  changes: Map<string, T | null>;
  additions: T[];
  steps: Map<string, VersionStep | null>;
  extraSteps: VersionStep[];
  touched: Set<string>;
};

const nameKey = (name: string) => name.trim().toLocaleLowerCase("de-DE");
const ingredientData = (item: VersionIngredient) => JSON.stringify([item.name, item.detail, item.optional ?? false, item.pantry ?? false]);
const stepData = (step: VersionStep) => JSON.stringify([step.text, step.output ?? "", step.ingredientIds, step.inputStepIds ?? [], Object.entries(step.ingredientAmounts ?? {}).sort(([a], [b]) => a.localeCompare(b))]);

function patchFor<T extends VersionIngredient>(baseIngredients: T[], baseSteps: VersionStep[], version: Version<T>): Patch<T> {
  const changes = new Map<string, T | null>();
  const additions: T[] = [];
  const steps = new Map<string, VersionStep | null>();
  const touched = new Set<string>();
  const matchedBase = new Set<string>();
  const idMap = new Map<string, string>();
  const baseById = new Map(baseIngredients.map((item) => [item.id, item]));
  for (const item of version.ingredients) {
    let base = baseById.get(item.id);
    if (base && matchedBase.has(base.id)) base = undefined;
    if (!base) {
      const candidates = baseIngredients.filter((entry) => !matchedBase.has(entry.id) && nameKey(entry.name) === nameKey(item.name));
      if (candidates.length === 1) base = candidates[0];
    }
    if (base) {
      matchedBase.add(base.id);
      idMap.set(item.id, base.id);
      if (ingredientData(base) !== ingredientData(item)) {
        changes.set(base.id, { ...item, id: base.id });
        touched.add(`ingredient:${base.id}`);
      }
    } else {
      additions.push(item);
      touched.add(`added:${nameKey(item.name)}`);
    }
  }
  for (const item of baseIngredients) if (!matchedBase.has(item.id)) {
    changes.set(item.id, null);
    touched.add(`ingredient:${item.id}`);
  }

  const matchedSteps = new Set<string>();
  const stepIdMap = new Map<string, string>();
  version.steps.forEach((step, index) => {
    const base = baseSteps.find((entry) => entry.id === step.id && !matchedSteps.has(entry.id))
      ?? (baseSteps[index] && !matchedSteps.has(baseSteps[index].id) ? baseSteps[index] : undefined);
    if (base) { matchedSteps.add(base.id); stepIdMap.set(step.id, base.id); }
  });
  const extraSteps: VersionStep[] = [];
  version.steps.forEach((step) => {
    const normalized = { ...step, id: stepIdMap.get(step.id) ?? step.id, ingredientIds: step.ingredientIds.map((id) => idMap.get(id) ?? id), ingredientAmounts: step.ingredientAmounts ? Object.fromEntries(Object.entries(step.ingredientAmounts).map(([id, amount]) => [idMap.get(id) ?? id, amount])) : undefined, inputStepIds: (step.inputStepIds ?? []).map((id) => stepIdMap.get(id) ?? id) };
    const base = baseSteps.find((entry) => entry.id === normalized.id);
    if (!base) { extraSteps.push(normalized); touched.add(`step:new:${normalized.id}`); }
    else if (stepData(base) !== stepData(normalized)) { steps.set(base.id, normalized); touched.add(`step:${base.id}`); }
  });
  for (const step of baseSteps) if (!matchedSteps.has(step.id)) { steps.set(step.id, null); touched.add(`step:${step.id}`); }
  return { changes, additions, steps, extraSteps, touched };
}

export function combineRecipeVersions<T extends VersionIngredient>(baseIngredients: T[], baseSteps: VersionStep[], versions: Version<T>[]) {
  const patches = versions.map((version) => patchFor(baseIngredients, baseSteps, version));
  const touched = new Set<string>();
  for (const patch of patches) for (const key of patch.touched) {
    if (touched.has(key)) return { compatible: false as const, ingredients: baseIngredients, steps: baseSteps };
    touched.add(key);
  }
  const changes = new Map(patches.flatMap((patch) => [...patch.changes]));
  const additionsAt = new Map<number, T[]>();
  for (const patch of patches) {
    const firstRemoved = baseIngredients.findIndex((item) => patch.changes.get(item.id) === null);
    const index = firstRemoved < 0 ? baseIngredients.length : firstRemoved;
    additionsAt.set(index, [...(additionsAt.get(index) ?? []), ...patch.additions]);
  }
  const ingredients: T[] = [];
  baseIngredients.forEach((item, index) => {
    ingredients.push(...(additionsAt.get(index) ?? []));
    const replacement = changes.get(item.id);
    if (replacement !== null) ingredients.push(replacement ?? item);
  });
  ingredients.push(...(additionsAt.get(baseIngredients.length) ?? []));
  const stepChanges = new Map(patches.flatMap((patch) => [...patch.steps]));
  const steps = baseSteps.flatMap((step) => {
    const replacement = stepChanges.get(step.id);
    return replacement === null ? [] : [replacement ?? step];
  });
  for (const patch of patches) steps.push(...patch.extraSteps);
  return { compatible: true as const, ingredients, steps };
}
