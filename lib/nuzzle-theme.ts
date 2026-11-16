export type NuzzleTheme = "green" | "classic" | "coral";
export const themeStorageKey = "nuzzle-theme-v1";

export function readNuzzleTheme(storage: Pick<Storage, "getItem">): NuzzleTheme {
  try {
    const stored = storage.getItem(themeStorageKey);
    return stored === "green" || stored === "coral" || stored === "classic" ? stored : "classic";
  } catch { return "classic"; }
}

export function saveNuzzleTheme(storage: Pick<Storage, "setItem">, theme: NuzzleTheme): void {
  try { storage.setItem(themeStorageKey, theme); } catch { /* Continue with the current session's choice. */ }
}
