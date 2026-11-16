"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HouseholdData } from "@/lib/household-data";
import { isEmbeddedImage } from "@/lib/household-images";
import { canPull, decideReconnect } from "@/lib/sync-policy";
import { mergeHousehold } from "@/lib/household-merge";
import type { CommentAuthor } from "@/lib/household-identity";
import { syncErrorDetails, syncLog, type SyncLogEntry } from "@/lib/sync-log";

type Remote = { revision: number; data: HouseholdData | null; author?: CommentAuthor | null };
type Phase = "local" | "checking" | "choose" | "synced" | "saving" | "conflict" | "error";
const META_KEY = "nest-sync-v1";
class SessionExpiredError extends Error { constructor(public status?: number) { super("Deine Anmeldung ist abgelaufen oder dein Zugriff wurde verweigert. Bitte melde dich erneut an."); this.name = "SessionExpiredError"; } }
class SyncHttpError extends Error { constructor(message: string, public status: number) { super(message); this.name = "SyncHttpError"; } }
class InvalidSyncResponseError extends Error { constructor(message: string) { super(message); this.name = "InvalidSyncResponseError"; } }
const errorMessage = (error: unknown, fallback: string) => error instanceof Error && !["TimeoutError", "AbortError", "TypeError"].includes(error.name) ? error.message : fallback;
const logSync = (entry: Omit<SyncLogEntry, "time">) => syncLog.append({ ...entry, online: navigator.onLine });

export function useHouseholdSync(ready: boolean, data: HouseholdData, apply: (value: HouseholdData) => void, applyImages: (before: HouseholdData, after: HouseholdData) => void, suspendPull = false, onRemote?: (base: HouseholdData, local: HouseholdData, remote: HouseholdData, author: CommentAuthor | null) => void) {
  const [phase, setPhase] = useState<Phase>("local");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [remote, setRemote] = useState<Remote | null>(null);
  const current = JSON.stringify(data);
  const currentRef = useRef(current);
  const applyRef = useRef(apply);
  const applyImagesRef = useRef(applyImages);
  const onRemoteRef = useRef(onRemote);
  const base = useRef<{ revision: number; data: string } | null>(null);
  const busy = useRef(false);
  const started = useRef(false);
  const deferredMerge = useRef(false);
  const suspendPullRef = useRef(suspendPull);
  currentRef.current = current;
  applyRef.current = apply;
  applyImagesRef.current = applyImages;
  onRemoteRef.current = onRemote;
  suspendPullRef.current = suspendPull;

  const remember = useCallback((revision: number, snapshot: string) => {
    // Persist the exact common ancestor so a restart can detect unsaved edits.
    window.localStorage.setItem(META_KEY, JSON.stringify({ revision, data: snapshot }));
    base.current = { revision, data: snapshot };
  }, []);

  const notifyIncoming = useCallback((saved: { revision: number; data: string } | null, incoming: HouseholdData, author: CommentAuthor | null | undefined) => {
    if (!saved) return;
    try { onRemoteRef.current?.(JSON.parse(saved.data) as HouseholdData, JSON.parse(currentRef.current) as HouseholdData, incoming, author === "Markus" || author === "Bettina" ? author : null); }
    catch { /* Notifications must not interfere with synchronizing user data. */ }
  }, []);

  const mergeRemote = useCallback((saved: { revision: number; data: string } | null, result: Remote) => {
    if (!saved || !result.data || suspendPullRef.current) {
      logSync({ operation: "merge", outcome: "deferred", reason: suspendPullRef.current ? "editing" : "missing-local", revision: saved?.revision, remoteRevision: result.revision });
      return false;
    }
    try {
      const local = JSON.parse(currentRef.current) as HouseholdData;
      let conflictArea: "shopping" | "recipes" | "tasks" | undefined;
      const merged = mergeHousehold(JSON.parse(saved.data) as HouseholdData, local, result.data, (area) => { conflictArea = area; });
      if (!merged) { logSync({ operation: "merge", outcome: "conflict", reason: "merge-conflict", conflictArea, revision: saved.revision, remoteRevision: result.revision }); return false; }
      // Persist the merged local data before advancing the ancestor. If interrupted,
      // the old ancestor can safely be used to retry the merge.
      const raw = window.localStorage.getItem("nest-local-v1");
      if (!raw) { logSync({ operation: "merge", outcome: "unavailable", reason: "missing-local", revision: saved.revision, remoteRevision: result.revision }); return false; }
      const stored = JSON.parse(raw) as Record<string, unknown>;
      window.localStorage.setItem("nest-local-v1", JSON.stringify({ ...stored, ...merged }));
      notifyIncoming(saved, result.data, result.author);
      remember(result.revision, JSON.stringify(result.data));
      applyRef.current(merged);
      logSync({ operation: "merge", outcome: "success", revision: saved.revision, remoteRevision: result.revision });
      return true;
    } catch (error) { logSync({ operation: "merge", outcome: "error", ...syncErrorDetails(error), revision: saved.revision, remoteRevision: result.revision }); return false; }
  }, [remember, notifyIncoming]);

  const fetchRemote = useCallback(async (): Promise<Remote> => {
    const response = await fetch("/api/household", { cache: "no-store", credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" }, signal: AbortSignal.timeout(8000) });
    if (response.status === 401 || response.status === 403 || response.redirected) throw new SessionExpiredError(response.status);
    if (!response.ok) throw new SyncHttpError("Der gemeinsame Speicher ist vorübergehend nicht erreichbar. Deine Änderungen bleiben auf diesem Gerät.", response.status);
    if (!response.headers.get("content-type")?.includes("application/json")) throw new SessionExpiredError(response.status);
    const result = await response.json() as Remote;
    if (!Number.isSafeInteger(result.revision) || result.revision < 0 || (result.revision > 0 && !result.data)) throw new InvalidSyncResponseError("Die Antwort des gemeinsamen Speichers ist ungültig.");
    return result;
  }, []);

  const connect = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const startedAt = Date.now();
    logSync({ operation: "connect", outcome: "started", revision: base.current?.revision });
    setPhase("checking");
    setMessage("");
    try {
      const result = await fetchRemote();
      setRequiresLogin(false);
      setRemote(result);
      let saved: { revision: number; data: string } | null = null;
      try { saved = JSON.parse(window.localStorage.getItem(META_KEY) ?? "null"); } catch { /* requires explicit choice */ }
      const decision = decideReconnect(saved, currentRef.current, result.revision, Boolean(result.data), suspendPullRef.current);
      logSync({ operation: "connect", outcome: decision === "conflict" ? "conflict" : "success", revision: saved?.revision, remoteRevision: result.revision, durationMs: Date.now() - startedAt });
      if (decision === "choose") setPhase("choose");
      else {
        base.current = saved;
        if (decision === "conflict" && !mergeRemote(saved, result)) { deferredMerge.current = suspendPullRef.current; setPhase("conflict"); setMessage("Auf diesem Gerät und im gemeinsamen Speicher gibt es unterschiedliche Änderungen. Bitte prüfe beide Versionen, bevor du gemeinsame Daten lädst."); setWarning("Auf diesem Gerät und im gemeinsamen Speicher gibt es unterschiedliche Änderungen."); }
        else {
          if (decision === "pull" && result.data) { notifyIncoming(saved, result.data, result.author); remember(result.revision, JSON.stringify(result.data)); applyRef.current(result.data); }
          setPhase("synced");
          setWarning("");
        }
      }
    } catch (error) {
      logSync({ operation: "connect", outcome: "error", ...syncErrorDetails(error), revision: base.current?.revision, durationMs: Date.now() - startedAt });
      setRequiresLogin(error instanceof SessionExpiredError);
      setPhase("error");
      const detail = errorMessage(error, "Verbindung fehlgeschlagen. Deine Änderungen bleiben auf diesem Gerät.");
      setMessage(detail); setWarning(detail);
    } finally {
      busy.current = false;
    }
  }, [fetchRemote, remember, mergeRemote, notifyIncoming]);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (window.localStorage.getItem(META_KEY)) void connect();
  }, [ready, connect]);

  const save = useCallback(async (revision: number, snapshot: string) => {
    if (busy.current) return;
    busy.current = true;
    const startedAt = Date.now();
    logSync({ operation: "save", outcome: "started", revision });
    setPhase("saving");
    try {
      const response = await fetch("/api/household", {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ revision, data: JSON.parse(snapshot) }), signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401 || response.status === 403 || response.redirected) throw new SessionExpiredError(response.status);
      if (response.status === 409) {
        logSync({ operation: "save", outcome: "conflict", reason: "http", status: 409, revision, durationMs: Date.now() - startedAt });
        const latest = await fetchRemote();
        if (mergeRemote(base.current, latest)) {
          setMessage(""); setWarning(""); setPhase("synced");
          return;
        }
        deferredMerge.current = suspendPullRef.current;
        setPhase("conflict");
        setMessage("Die Daten wurden auf einem anderen Gerät geändert. Deine Änderungen bleiben auf diesem Gerät erhalten.");
        setWarning("Die Daten wurden auf einem anderen Gerät geändert. Deine Änderungen bleiben auf diesem Gerät erhalten.");
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new SyncHttpError(result?.error ?? "Änderungen konnten nicht gespeichert werden.", response.status);
      }
      const result = await response.json() as { revision: number; data: HouseholdData };
      if (!result.data || !Number.isSafeInteger(result.revision) || result.revision < 0) throw new InvalidSyncResponseError("Die Speicherantwort ist unvollständig.");
      const before = JSON.parse(snapshot) as HouseholdData;
      remember(result.revision, JSON.stringify(result.data));
      applyImagesRef.current(before, result.data);
      setMessage("");
      setPhase("synced");
      setWarning("");
      logSync({ operation: "save", outcome: "success", revision, remoteRevision: result.revision, durationMs: Date.now() - startedAt });
    } catch (error) {
      logSync({ operation: "save", outcome: "error", ...syncErrorDetails(error), revision, durationMs: Date.now() - startedAt });
      setRequiresLogin(error instanceof SessionExpiredError);
      setPhase("error");
      const detail = errorMessage(error, "Änderungen konnten nicht gespeichert werden. Sie bleiben auf diesem Gerät.");
      setMessage(detail); setWarning(detail);
    } finally {
      busy.current = false;
    }
  }, [remember, fetchRemote, mergeRemote]);

  useEffect(() => {
    if (phase === "conflict" && !suspendPull && deferredMerge.current) {
      deferredMerge.current = false;
      void connect();
    }
  }, [phase, suspendPull, connect]);

  useEffect(() => {
    const hasImages = data.recipes.some((recipe) => isEmbeddedImage((recipe as { image?: unknown }).image)) || data.tasks.some((task) => ((task as { images?: unknown[] }).images ?? []).some(isEmbeddedImage));
    if (phase !== "synced" || !base.current || (base.current.data === current && !hasImages)) return;
    const timer = window.setTimeout(() => { if (base.current) void save(base.current.revision, currentRef.current); }, 900);
    return () => window.clearTimeout(timer);
  }, [phase, current, save]);

  const refresh = useCallback(async (): Promise<HouseholdData | null> => {
      if (phase !== "synced" || !canPull(base.current, currentRef.current, busy.current, suspendPullRef.current)) return null;
      const before = currentRef.current;
      const startedAt = Date.now();
      try {
        const result = await fetchRemote();
        if (canPull(base.current, currentRef.current, busy.current, suspendPullRef.current) && base.current && result.data && result.revision >= base.current.revision && before === currentRef.current) {
          if (result.revision > base.current.revision) {
            logSync({ operation: "refresh", outcome: "success", revision: base.current.revision, remoteRevision: result.revision, durationMs: Date.now() - startedAt });
            notifyIncoming(base.current, result.data, result.author);
            remember(result.revision, JSON.stringify(result.data));
            applyRef.current(result.data);
          }
          return result.data;
        }
      } catch (error) {
        logSync({ operation: "refresh", outcome: "error", ...syncErrorDetails(error), revision: base.current?.revision, durationMs: Date.now() - startedAt });
        if (!busy.current) {
          setRequiresLogin(error instanceof SessionExpiredError);
          const detail = errorMessage(error, "Verbindung unterbrochen. Änderungen bleiben auf diesem Gerät.");
          setMessage(detail); setWarning(detail);
          setPhase("error");
        }
      }
      return null;
  }, [phase, fetchRemote, remember, notifyIncoming]);

  useEffect(() => {
    if (phase !== "synced") return;
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    if (!suspendPull) void refresh();
    const timer = window.setInterval(onVisible, 15000);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [phase, refresh, suspendPull]);

  useEffect(() => {
    if (phase !== "error" || requiresLogin) return;
    const retry = () => { if (document.visibilityState === "visible" && navigator.onLine) void connect(); };
    const timer = window.setInterval(retry, 30000);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    return () => { window.clearInterval(timer); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); document.removeEventListener("visibilitychange", retry); };
  }, [phase, connect, requiresLogin]);

  useEffect(() => {
    if (phase !== "synced") return;
    const offline = () => {
      logSync({ operation: "network", outcome: "error", reason: "network", revision: base.current?.revision });
      const detail = "Keine Internetverbindung. Änderungen bleiben auf diesem Gerät.";
      setMessage(detail); setWarning(detail); setPhase("error");
    };
    window.addEventListener("offline", offline);
    if (!navigator.onLine) offline();
    return () => window.removeEventListener("offline", offline);
  }, [phase]);

  const useCloud = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const startedAt = Date.now();
    logSync({ operation: "load-cloud", outcome: "started", revision: base.current?.revision });
    try {
      // Re-read after the user decides, rather than accepting a stale snapshot.
      const result = await fetchRemote();
      if (!result.data) throw new Error("Es sind keine gemeinsamen Daten vorhanden.");
      const original = window.localStorage.getItem("nest-local-v1");
      if (original) window.localStorage.setItem("nest-backup-" + Date.now(), original);
      remember(result.revision, JSON.stringify(result.data));
      applyRef.current(result.data);
      setMessage("");
      setPhase("synced");
      setWarning("");
      logSync({ operation: "load-cloud", outcome: "success", remoteRevision: result.revision, durationMs: Date.now() - startedAt });
    } catch (error) {
      logSync({ operation: "load-cloud", outcome: "error", ...syncErrorDetails(error), revision: base.current?.revision, durationMs: Date.now() - startedAt });
      setRequiresLogin(error instanceof SessionExpiredError);
      setPhase("error");
      const detail = errorMessage(error, "Gemeinsame Daten konnten nicht geladen werden.");
      setMessage(detail); setWarning(detail);
    } finally { busy.current = false; }
  }, [fetchRemote, remember]);

  const importLocal = useCallback(() => {
    // Initial creation only. A concurrent creation returns 409 instead of overwriting.
    if (remote?.revision === 0) void save(0, currentRef.current);
  }, [remote, save]);

  return { phase, message, warning, requiresLogin, remote, connect, useCloud, importLocal, refresh };
}
