export type NuzzleTheme = "green" | "classic";
export const themeStorageKey = "nuzzle-theme-v1";

export function readNuzzleTheme(storage: Pick<Storage, "getItem">): NuzzleTheme {
  try { return storage.getItem(themeStorageKey) === "classic" ? "classic" : "green"; }
  catch { return "green"; }
}

export function saveNuzzleTheme(storage: Pick<Storage, "setItem">, theme: NuzzleTheme): void {
  try { storage.setItem(themeStorageKey, theme); } catch { /* Continue with the current session's choice. */ }
}
