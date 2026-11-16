"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { nuzzleThemeAssets, readNuzzleTheme, saveNuzzleTheme, type NuzzleTheme } from "@/lib/nuzzle-theme";

const ThemeContext = createContext<{ theme: NuzzleTheme; choose: (theme: NuzzleTheme) => void } | null>(null);

export function NuzzleThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<NuzzleTheme>("green");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setTheme(readNuzzleTheme(window.localStorage)); } catch { /* Use the default when storage is unavailable. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.nuzzleTheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f8f7fc");
    const assets = nuzzleThemeAssets(theme);
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => link.setAttribute("href", assets.icon));
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute("href", assets.apple);
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", assets.manifest);
    try { saveNuzzleTheme(window.localStorage, theme); } catch { /* The choice still applies for this session. */ }
  }, [theme, ready]);

  return <ThemeContext.Provider value={{ theme, choose: setTheme }}>{children}</ThemeContext.Provider>;
}

export function NuzzleThemeSettings() {
  const value = useContext(ThemeContext);
  if (!value) return null;
  return <div className="settings-card nuzzle-theme-settings">
    <h2>Farbschema</h2>
    <p>Wähle die Farben für dieses Gerät.</p>
    <div className="nuzzle-theme-choices" role="group" aria-label="Farbschema">
      <Button type="button" variant={value.theme === "green" ? "default" : "outline"} aria-pressed={value.theme === "green"} onClick={() => value.choose("green")}>Nuzzle Grün</Button>
      <Button type="button" variant={value.theme === "classic" ? "default" : "outline"} aria-pressed={value.theme === "classic"} onClick={() => value.choose("classic")}>Bisheriges Violett</Button>
    </div>
  </div>;
}
