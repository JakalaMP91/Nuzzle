export type NuzzleTheme = "green" | "classic";
export const themeStorageKey = "nuzzle-theme-v1";

export function nuzzleThemeAssets(theme: NuzzleTheme) {
  return theme === "classic"
    ? { icon: "/nuzzle-icon-violet.svg?v=1", apple: "/nuzzle-icon-violet-180.png?v=1", manifest: "/manifest-violet.webmanifest?v=1" }
    : { icon: "/favicon.svg?v=nuzzle-green-1", apple: "/nuzzle-icon-180.png?v=nuzzle-green-1", manifest: "/manifest.webmanifest?v=nuzzle-green-1" };
}

export function readNuzzleTheme(storage: Pick<Storage, "getItem">): NuzzleTheme {
  try { return storage.getItem(themeStorageKey) === "classic" ? "classic" : "green"; }
  catch { return "green"; }
}

export function saveNuzzleTheme(storage: Pick<Storage, "setItem">, theme: NuzzleTheme): void {
  try { storage.setItem(themeStorageKey, theme); } catch { /* Continue with the current session's choice. */ }
}
