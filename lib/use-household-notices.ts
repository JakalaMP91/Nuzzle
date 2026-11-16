"use client";
import { useCallback, useState } from "react";
import type { HouseholdData } from "@/lib/household-data";
import type { CommentAuthor } from "@/lib/household-identity";
import { emptyNotices, incomingNotices, type NoticeSection, type NoticeState } from "@/lib/household-notices";

const KEY = "nest-notices-v2";
function load(): NoticeState {
  if (typeof window === "undefined") return emptyNotices();
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (value && ["shopping", "tasks", "recipes"].every((key) => Array.isArray(value[key]) && value[key].every((id: unknown) => typeof id === "string")) && Array.isArray(value.newItems) && value.newItems.every((id: unknown) => typeof id === "number")) {
      value.previews = Array.isArray(value.previews) ? value.previews.filter((entry: unknown) => entry && typeof entry === "object" && typeof (entry as { key?: unknown }).key === "string" && typeof (entry as { label?: unknown }).label === "string" && typeof (entry as { at?: unknown }).at === "number" && ["new-item", "purchased", "new-task", "completed-task"].includes(String((entry as { kind?: unknown }).kind))) : [];
      value.seenItems = Array.isArray(value.seenItems) ? value.seenItems.filter((id: unknown) => typeof id === "number") : [];
      return value as NoticeState;
    }
  } catch { /* A malformed local notice list is safely reset. */ }
  return emptyNotices();
}
export function useHouseholdNotices() {
  const [state, setState] = useState<NoticeState>(load);
  const update = useCallback((change: (value: NoticeState) => NoticeState) => {
    setState((value) => {
      const next = change(value);
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* App data remains unaffected. */ }
      return next;
    });
  }, []);
  const receive = useCallback((base: HouseholdData, local: HouseholdData, remote: HouseholdData, viewer: CommentAuthor | null) => update((value) => incomingNotices(value, base, local, remote, viewer)), [update]);
  const acknowledge = useCallback((section: NoticeSection) => update((value) => ({ ...value, [section]: [], previews: (value.previews ?? []).filter((entry) => !value[section].includes(entry.key) && !(section === "shopping" && entry.key.startsWith("local:purchase:")) && !(section === "tasks" && entry.key.startsWith("local:done:"))) })), [update]);
  const markShoppingSeen = useCallback(() => update((value) => ({ ...value, seenItems: [...value.newItems] })), [update]);
  const visitShopping = useCallback(() => update((value) => { const newItems = value.newItems.filter((id) => !(value.seenItems ?? []).includes(id)); return { ...value, newItems, seenItems: [...newItems] }; }), [update]);
  const acknowledgeItem = useCallback((id: number) => update((value) => ({ ...value, newItems: value.newItems.filter((item) => item !== id), shopping: value.shopping.filter((item) => item !== `item:${id}`), previews: (value.previews ?? []).filter((entry) => entry.key !== `item:${id}`) })), [update]);
  return { state, receive, acknowledge, acknowledgeItem, markShoppingSeen, visitShopping };
}
