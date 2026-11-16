"use client";

import { useEffect, useRef } from "react";

export type AppNavigation = {
  view: string;
  taskView: string;
  selectedRecipeId: string | null;
  recipeImageOpen: boolean;
  itemDialog: boolean;
  iconDialog: boolean;
  taskDialog: boolean;
  laneDialog: boolean;
  importDialog: boolean;
  shoppingDialog: boolean;
  recipeEditor: boolean;
  categoryDialog: boolean;
  pantryDialog: boolean;
  syncDialog: boolean;
  deleteRecipeDialog: boolean;
  cropSource: string | null;
};

const same = (a: AppNavigation, b: AppNavigation) => Object.keys(a).every((key) => a[key as keyof AppNavigation] === b[key as keyof AppNavigation]);
const isCloseOnly = (a: AppNavigation, b: AppNavigation) => {
  if (a.view !== b.view || a.taskView !== b.taskView) return false;
  return Object.keys(a).every((key) => {
    const before = a[key as keyof AppNavigation];
    const after = b[key as keyof AppNavigation];
    return before === after || (Boolean(before) && !after);
  });
};

// The guard lives in browser history; private application state remains in
// memory. Back consumes one Nuzzle state instead of returning to the login page.
export function useAppBack(ready: boolean, snapshot: AppNavigation, restore: (snapshot: AppNavigation) => void) {
  const current = useRef(snapshot);
  const previous = useRef(snapshot);
  const stack = useRef<AppNavigation[]>([]);
  const restoreRef = useRef(restore);
  const restoring = useRef(false);
  current.current = snapshot;
  restoreRef.current = restore;

  useEffect(() => {
    if (!ready) return;
    previous.current = current.current;
    const guard = () => window.history.pushState({ ...(window.history.state ?? {}), __nestBackGuard: true }, "");
    guard();
    const onBack = () => {
      const now = current.current;
      const target = stack.current.pop() ?? (now.view !== "home" ? { ...now, view: "home" } : now);
      if (!same(now, target)) {
        restoring.current = true;
        previous.current = target;
        restoreRef.current(target);
      }
      guard();
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    if (restoring.current) { restoring.current = false; previous.current = snapshot; return; }
    const before = previous.current;
    if (same(before, snapshot)) return;
    if (isCloseOnly(before, snapshot)) {
      let matching = -1;
      for (let i = stack.current.length - 1; i >= 0; i--) {
        if (same(stack.current[i], snapshot)) { matching = i; break; }
      }
      if (matching >= 0) stack.current.length = matching;
    } else stack.current.push(before);
    previous.current = snapshot;
  });
}
