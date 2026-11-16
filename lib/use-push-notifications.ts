"use client";
import { useEffect, useState } from "react";
import { restorePushDevice } from "./push-restore";
import { readPushDiagnostics, writePushDiagnostic } from "./push-diagnostics";
import { version as appVersion } from "../package.json";

const KEY = "nest-push-enabled-v1";
class PushApiError extends Error { constructor(message: string, public status: number, public providerStatus?: number) { super(message); } }
function logError(event: "restore" | "activate" | "deactivate" | "test" | "preferences", error: unknown) { void writePushDiagnostic({ event, outcome: "error", ...(error instanceof PushApiError ? { status: error.status, providerStatus: error.providerStatus } : {}) }); }
function supportedBrowser() { return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
async function api(method: string, body?: unknown) {
  const response = await fetch("/api/push", { method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000), ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json() as { configured?: boolean; publicKey?: string; error?: string; enabled?: boolean; reminderTime?: string; shoppingEnabled?: boolean; providerStatus?: number; attempts?: { time: string; type: string; outcome: string; providerStatus?: number }[] };
  if (!response.ok) throw new PushApiError(result.error ?? "Benachrichtigungen konnten nicht eingerichtet werden.", response.status, result.providerStatus);
  return result;
}
function publicKeyBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function activeWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if (registration.active) return registration;
  await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Die Benachrichtigungsfunktion ist noch nicht bereit. Bitte erneut versuchen.")), 15000))]);
  return registration;
}
export function usePushNotifications(ready: boolean) {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<"checking" | "enabled" | "disabled" | "unavailable">("checking");
  const enabled = status === "enabled";
  const [busy, setBusy] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [shoppingEnabled, setShoppingEnabled] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!ready) return;
    const available = supportedBrowser(); setSupported(available);
    if (!available) { setStatus("disabled"); return; }
    let cancelled = false, inFlight = false;
    const restore = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const config = await api("GET");
        if (cancelled) return;
        setConfigured(Boolean(config.configured));
        if (!config.configured) { setStatus("unavailable"); return; }
        let preferences: { reminderTime?: string; shoppingEnabled?: boolean } | undefined;
        const result = await restorePushDevice(Notification.permission, async () => {
          const registration = await navigator.serviceWorker.getRegistration("/");
          return await registration?.pushManager.getSubscription() ?? null;
        }, async (subscription) => { preferences = await api("POST", { subscription: subscription.toJSON() }); });
        if (!cancelled) {
          setStatus(result); void writePushDiagnostic({ event: "restore", outcome: result });
          if (result === "enabled") {
            setReminderTime(preferences?.reminderTime ?? "08:00");
            setShoppingEnabled(Boolean(preferences?.shoppingEnabled));
            try { localStorage.setItem(KEY, "true"); } catch { /* Subscription is authoritative. */ }
          }
        }
      } catch (error) { if (!cancelled) { setStatus("unavailable"); logError("restore", error); } }
      finally { inFlight = false; }
    };
    if (status === "checking" || status === "unavailable") {
      void restore();
      const retry = () => { void restore(); };
      const timer = window.setInterval(retry, 30000);
      window.addEventListener("online", retry); window.addEventListener("focus", retry); document.addEventListener("visibilitychange", retry);
      return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); document.removeEventListener("visibilitychange", retry); };
    }
    return () => { cancelled = true; };
  }, [ready, status]);
  async function enable() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (!supportedBrowser()) throw new Error("Dieser Browser unterstützt keine Push-Benachrichtigungen. Auf iPhone und iPad Nuzzle zuerst zum Home-Bildschirm hinzufügen.");
      // Request before any network awaits so Safari keeps the user gesture.
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Benachrichtigungen sind nicht erlaubt. Bitte die Berechtigung in den Browser- oder Geräteeinstellungen freigeben.");
      const config = await api("GET");
      if (!config.configured || !config.publicKey) throw new Error("Benachrichtigungen sind serverseitig noch nicht eingerichtet.");
      const registration = await activeWorker();
      let subscription = await registration.pushManager.getSubscription();
      const key = publicKeyBytes(config.publicKey);
      if (subscription?.options.applicationServerKey && new Uint8Array(subscription.options.applicationServerKey).some((byte, index) => byte !== key[index])) { await subscription.unsubscribe(); subscription = null; }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const saved = await api("POST", { subscription: subscription.toJSON() });
      setReminderTime(saved.reminderTime ?? "08:00"); setShoppingEnabled(Boolean(saved.shoppingEnabled));
      try { localStorage.setItem(KEY, "true"); } catch { /* Current activation still works without local storage. */ }
      setStatus("enabled"); setConfigured(true); setMessage("Benachrichtigungen auf diesem Gerät aktiviert."); void writePushDiagnostic({ event: "activate", outcome: "success" });
    } catch (error) { logError("activate", error); setMessage(error instanceof Error ? error.message : "Aktivierung fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  async function disable() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) { await api("DELETE", { endpoint: subscription.endpoint }); await subscription.unsubscribe(); }
      try { localStorage.removeItem(KEY); } catch { /* Browser permission remains controlled by the user. */ }
      setStatus("disabled"); setMessage("Benachrichtigungen auf diesem Gerät deaktiviert."); void writePushDiagnostic({ event: "deactivate", outcome: "success" });
    } catch (error) { logError("deactivate", error); setMessage(error instanceof Error ? error.message : "Deaktivierung fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  async function test() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("Bitte Benachrichtigungen zuerst aktivieren.");
      const result = await api("POST", { action: "test", endpoint: subscription.endpoint });
      void writePushDiagnostic({ event: "test", outcome: "success", providerStatus: result.providerStatus });
      setMessage("Testnachricht an den Benachrichtigungsdienst versendet.");
    } catch (error) {
      logError("test", error);
      if (error instanceof PushApiError && (error.status === 404 || error.status === 409)) {
        if (error.status === 409) {
          try { const registration = await navigator.serviceWorker.getRegistration("/"); const stale = await registration?.pushManager.getSubscription(); await stale?.unsubscribe(); } catch { /* The user can retry activation. */ }
        }
        setStatus("disabled");
      }
      setMessage(error instanceof Error ? error.message : "Test fehlgeschlagen.");
    }
    finally { setBusy(false); }
  }
  async function savePreferences(time: string, shopping: boolean) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("Bitte Benachrichtigungen zuerst aktivieren.");
      const result = await api("POST", { action: "preferences", endpoint: subscription.endpoint, reminderTime: time, shoppingEnabled: shopping });
      setReminderTime(result.reminderTime ?? time); setShoppingEnabled(Boolean(result.shoppingEnabled)); setMessage("Einstellungen gespeichert."); void writePushDiagnostic({ event: "preferences", outcome: "success" });
    } catch (error) { logError("preferences", error); setMessage(error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden."); }
    finally { setBusy(false); }
  }
  async function downloadDiagnostics() {
    try {
      const local = await readPushDiagnostics();
      let subscription: PushSubscription | null = null;
      try { const registration = await navigator.serviceWorker?.getRegistration("/"); subscription = await registration?.pushManager?.getSubscription() ?? null; } catch { /* Report as unavailable below. */ }
      let server: { state: string; attempts?: { time: string; type: string; outcome: string; providerStatus?: number }[]; status?: number } = { state: "no_subscription" };
      if (subscription) {
        try { const result = await api("POST", { action: "diagnostics", endpoint: subscription.endpoint }); server = { state: "available", attempts: result.attempts ?? [] }; }
        catch (error) { server = { state: "unavailable", ...(error instanceof PushApiError ? { status: error.status } : {}) }; }
      }
      const report = { format: "nest-push-diagnostics-v1", exportedAt: new Date().toISOString(), appVersion, device: { supported, permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission, status, configured, subscriptionPresent: Boolean(subscription), online: navigator.onLine, shoppingEnabled, reminderTime }, local, server };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "nuzzle-benachrichtigungsprotokoll.json"; link.click(); URL.revokeObjectURL(url);
      setMessage(local.available ? "Benachrichtigungsprotokoll heruntergeladen." : "Protokoll heruntergeladen; der lokale Diagnosespeicher ist nicht verfügbar.");
    } catch { setMessage("Das Benachrichtigungsprotokoll konnte nicht heruntergeladen werden."); }
  }
  return { supported, configured, enabled, status, busy, message, reminderTime, shoppingEnabled, savePreferences, enable, disable, test, downloadDiagnostics };
}
