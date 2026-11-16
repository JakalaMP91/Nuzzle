"use client";
/* eslint-disable @next/next/no-img-element -- Cloud and local data URLs are already optimized by the image pipeline. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Coffee as CoffeeIcon, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCoffeeBackup, type Coffee, type CoffeeBackup, type CoffeeProfile } from "@/lib/coffee-import";

const empty = (): CoffeeBackup => ({ coffees: [], profileNames: [] });
const blankProfile = (): CoffeeProfile => ({ grind: "", amount: "", extractionProfile: "", taste: "", rating: 0, comment: "" });
const makeCoffee = (): Coffee => ({ id: crypto.randomUUID(), name: "", type: "normal", available: true, photo: null, profiles: [blankProfile()], createdAt: Date.now(), updatedAt: Date.now() });
const draftKey = "nuzzle-coffee-draft";
function CoffeeCrop({ bitmap, onApply, onCancel }: { bitmap: ImageBitmap; onApply: (photo: string) => void; onCancel: () => void }) {
  const [zoom, setZoom] = useState(1), [x, setX] = useState(50), [y, setY] = useState(50);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    const side = Math.min(bitmap.width, bitmap.height) / zoom;
    ctx.drawImage(bitmap, (bitmap.width - side) * x / 100, (bitmap.height - side) * y / 100, side, side, 0, 0, 640, 640);
  }, [bitmap, zoom, x, y]);
  useEffect(() => () => bitmap.close(), [bitmap]);
  return <div className="coffee-panel"><h3>Foto zuschneiden</h3><canvas ref={canvas} width={640} height={640} className="coffee-edit-image" /><label>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><label>Horizontal<input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))} /></label><label>Vertikal<input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))} /></label><div className="coffee-actions"><button type="button" onClick={() => { const result = canvas.current?.toDataURL("image/jpeg", .85); if (result) onApply(result); }}>Ausschnitt übernehmen</button><button type="button" onClick={onCancel}>Abbrechen</button></div></div>;
}
async function draftStore(mode: "readonly" | "readwrite", value?: unknown): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("nuzzle-coffee", 1); req.onupgradeneeded = () => req.result.createObjectStore("draft"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  try { return await new Promise((resolve, reject) => { const tx = db.transaction("draft", mode); const store = tx.objectStore("draft"); const req = mode === "readonly" ? store.get(draftKey) : value === null ? store.delete(draftKey) : store.put(value, draftKey); let result: unknown; req.onsuccess = () => { result = req.result; }; req.onerror = () => reject(req.error); tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}

export function CoffeeArea({ settingsTarget, onStatus }: { settingsTarget: HTMLElement | null; onStatus: (status: "checking" | "synced" | "saving" | "error") => void }) {
  const [data, setData] = useState<CoffeeBackup>(empty);
  const [revision, setRevision] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("Kaffeedaten werden geladen …");
  const [busy, setBusy] = useState(false);
  const [autoBlocked, setAutoBlocked] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Coffee | null>(null);
  const [preview, setPreview] = useState<CoffeeBackup | null>(null);
  const [choice, setChoice] = useState<"keep" | "replace">("keep");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState("");
  const [crop, setCrop] = useState<ImageBitmap | null>(null);

  async function load() {
    setBusy(true);
    try {
      const response = await fetch("/api/coffee", { cache: "no-store" }); if (!response.ok) throw new Error("Cloud nicht erreichbar. Anmeldung und Verbindung prüfen.");
      const remote = await response.json() as { revision: number; data: CoffeeBackup };
      setConnectionError(false); setAutoBlocked(false);
      const saved = await draftStore("readonly") as { data?: CoffeeBackup; revision?: number } | undefined;
      if (saved?.data && typeof saved.revision === "number") { setData(saved.data); setRevision(saved.revision); setDirty(true); setMessage(saved.revision === remote.revision ? "Ungespeicherte Änderungen wiederhergestellt." : "Lokale Änderungen wurden wiederhergestellt. Die Cloud wurde inzwischen geändert. Bitte lokale Sicherung exportieren und Konflikt prüfen."); }
      else { setData(remote.data); setRevision(remote.revision); setDirty(false); setMessage("Kaffeedaten sind mit der Cloud verbunden."); }
    } catch (error) {
      setConnectionError(true);
      try { const saved = await draftStore("readonly") as { data?: CoffeeBackup; revision?: number } | undefined; if (saved?.data && typeof saved.revision === "number") { setData(saved.data); setRevision(saved.revision); setDirty(true); setMessage("Cloud nicht erreichbar. Lokale Änderungen wurden wiederhergestellt."); } else setMessage(error instanceof Error ? error.message : "Laden fehlgeschlagen."); }
      catch { setMessage("Cloud und lokale Sicherung sind nicht erreichbar."); }
    }
    finally { setBusy(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    if (!dirty || autoBlocked || busy || edit || preview || revision === null) return;
    const timer = window.setTimeout(() => { void save(); }, 2000);
    return () => window.clearTimeout(timer);
  // save intentionally uses exactly this snapshot and runs once per edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dirty, autoBlocked, busy, edit, preview, revision]);
  useEffect(() => {
    if (dirty || busy || edit || preview || revision === null) return;
    let cancelled = false;
    const timer = window.setInterval(() => { void (async () => {
      try { const response = await fetch("/api/coffee", { cache: "no-store" }); if (!response.ok) { if (!cancelled) setConnectionError(true); return; } if (!cancelled) setConnectionError(false); const remote = await response.json() as { revision: number; data: CoffeeBackup }; if (!cancelled && remote.revision !== revision) { setData(remote.data); setRevision(remote.revision); setMessage("Änderungen aus der Cloud geladen."); } } catch { if (!cancelled) setConnectionError(true); }
    })(); }, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [dirty, busy, edit, preview, revision]);
  async function change(next: CoffeeBackup) {
    if (revision === null) return;
    setData(next); setDirty(true); setAutoBlocked(false);
    try { await draftStore("readwrite", { data: next, revision }); setMessage("Änderungen lokal gesichert. Bitte in der Cloud speichern."); }
    catch { setMessage("Lokale Sicherung fehlgeschlagen. Bitte die Seite nicht schließen und Daten exportieren."); }
  }
  async function save() {
    if (revision === null || busy) return;
    setBusy(true);
    try {
      const coffees = [] as Coffee[];
      for (const coffee of data.coffees) {
        let photo = coffee.photo;
        if (photo?.startsWith("data:")) {
          const response = await fetch("/api/household-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: photo }) });
          if (!response.ok) throw new Error("Foto konnte nicht hochgeladen werden. Änderungen bleiben lokal erhalten.");
          photo = (await response.json() as { path: string }).path;
        }
        coffees.push({ ...coffee, photo });
      }
      const next = { ...data, coffees };
      const response = await fetch("/api/coffee", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, data: next }) });
      if (response.status === 409) throw new Error("Konflikt: Die Kaffeedaten wurden auf einem anderen Gerät geändert. Lokale Daten exportieren, dann Cloudstand neu laden.");
      if (!response.ok) throw new Error("Speichern fehlgeschlagen. Änderungen bleiben lokal erhalten.");
      const result = await response.json() as { revision: number };
      setData(next); setRevision(result.revision); setDirty(false); setAutoBlocked(false); setConnectionError(false); await draftStore("readwrite", null); setMessage("Kaffeedaten in der Cloud gespeichert.");
    } catch (error) { setAutoBlocked(true); setConnectionError(true); setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  async function exportData() {
    try {
      const coffees = await Promise.all(data.coffees.map(async coffee => {
        if (!coffee.photo?.startsWith("/api/")) return coffee;
        const response = await fetch(coffee.photo); if (!response.ok) throw new Error("Ein Foto konnte nicht geladen werden.");
        const blob = await response.blob();
        const photo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
        return { ...coffee, photo };
      }));
      const blob = new Blob([JSON.stringify({ app: "kaffee-tracker", schemaVersion: 1, exportedAt: new Date().toISOString(), coffees, profileNames: data.profileNames }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "nuzzle-kaffee-backup.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export fehlgeschlagen."); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try { if (file.size > 50_000_000) throw new Error("Die Datei ist größer als 50 MB."); setPreview(parseCoffeeBackup(JSON.parse(await file.text()))); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Datei konnte nicht gelesen werden."); }
  }
  function acceptImport() {
    if (!preview) return;
    const map = new Map(data.coffees.map(c => [c.id, c]));
    for (const c of preview.coffees) if (!map.has(c.id) || choice === "replace") map.set(c.id, c);
    void change({ coffees: Array.from(map.values()), profileNames: [...new Set([...data.profileNames, ...preview.profileNames])] }); setPreview(null);
  }
  async function photoFile(file?: File) {
    if (!file || !edit) return;
    try {
      const bitmap = await createImageBitmap(file); setPhotoError(""); setCrop(bitmap);
    } catch { setPhotoError("Foto konnte nicht gelesen werden."); }
  }
  const coffeeStatus = autoBlocked || connectionError || (revision === null && !busy) ? "error" : busy || dirty ? "saving" : revision === null ? "checking" : "synced";
  useEffect(() => { onStatus(coffeeStatus); }, [coffeeStatus, onStatus]);
  const detail = data.coffees.find(c => c.id === detailId);
  const collisions = preview?.coffees.filter(c => data.coffees.some(existing => existing.id === c.id)).length ?? 0;
  const settings = <div className="coffee-settings">
    <h3>Kaffee</h3><p role="status">{busy ? "Kaffeedaten werden synchronisiert …" : connectionError && !dirty ? "Kaffee-Synchronisierung unterbrochen. Verbindung und Anmeldung prüfen." : message}</p>
    {dirty && <div className="coffee-actions"><Button variant="outline" disabled={busy} onClick={() => void save()}>Erneut synchronisieren</Button><Button variant="outline" disabled={busy} onClick={() => { if (confirm("Lokale Kaffee-Änderungen verwerfen und den Cloudstand laden? Sichere sie vorher als Datei.")) void (async () => { await draftStore("readwrite", null); await load(); })(); }}>Cloudstand laden</Button></div>}
    {connectionError && !dirty && !busy && <Button variant="outline" onClick={() => void load()}>Verbindung erneut prüfen</Button>}
    <p>Die Kaffee-Sicherung ist unabhängig von der Haushalts-Sicherung und enthält auch Fotos.</p>
    <div className="coffee-actions"><label className="coffee-upload"><span> <ArrowUp aria-hidden="true" /> Kaffee importieren</span><input disabled={revision === null || busy} type="file" accept="application/json,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label><Button variant="outline" disabled={revision === null || busy} onClick={() => void exportData()}><ArrowDown /> Kaffee exportieren</Button></div>
    {preview && <div className="coffee-import-preview"><h4>Import prüfen</h4><p>{preview.coffees.length} Kaffees, {preview.coffees.reduce((n, c) => n + c.profiles.length, 0)} Profile und {preview.coffees.filter(c => c.photo).length} Fotos. {collisions} IDs bereits vorhanden.</p>{collisions > 0 && <label>Bei gleichen IDs <select value={choice} onChange={e => setChoice(e.target.value as "keep" | "replace")}><option value="keep">Vorhandene behalten</option><option value="replace">Durch Import ersetzen</option></select></label>}<div className="coffee-actions"><Button onClick={acceptImport}>Import übernehmen</Button><Button variant="outline" onClick={() => setPreview(null)}>Abbrechen</Button></div></div>}
    <fieldset disabled={busy || revision === null} className="coffee-settings-fields"><details className="coffee-names"><summary>Profilvorschläge verwalten</summary><div className="coffee-actions"><input aria-label="Neuer Profilname" value={newName} onChange={e => setNewName(e.target.value)} /><Button variant="outline" onClick={() => { if (newName.trim()) { void change({ ...data, profileNames: [...new Set([...data.profileNames, newName.trim()])] }); setNewName(""); } }}>Hinzufügen</Button></div>{data.profileNames.map(name => <div className="coffee-name-row" key={name}><span>{name}</span><Button variant="ghost" size="icon" aria-label={`${name} umbenennen`} onClick={() => { const next = prompt("Vorschlag umbenennen", name)?.trim(); if (next) void change({ ...data, profileNames: [...new Set(data.profileNames.map(n => n === name ? next : n))] }); }}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`${name} löschen`} onClick={() => { if (confirm(`Vorschlag „${name}“ löschen?`)) void change({ ...data, profileNames: data.profileNames.filter(n => n !== name) }); }}><Trash2 /></Button></div>)}</details></fieldset>
  </div>;
  return <><section className="coffee-area"><div className="page-heading"><div><p className="eyebrow">Deine Sammlung</p><h1>Kaffee</h1><p>Deine Sorten und ihre Zubereitung auf einen Blick.</p></div><Button className="coffee-add" size="icon-lg" disabled={revision === null || busy} aria-label="Neuen Kaffee hinzufügen" title="Neuen Kaffee hinzufügen" onClick={() => setEdit(makeCoffee())}><Plus /></Button></div>
    {revision === null && <p className="coffee-notice" role="status">{busy ? "Kaffeedaten werden geladen …" : message}</p>}
    {revision !== null && data.coffees.length === 0 && <div className="empty-list"><CoffeeIcon /><strong>Noch kein Kaffee gespeichert</strong><span>Füge deine erste Sorte über das Plus hinzu.</span></div>}
    {[true, false].map(available => { const group = data.coffees.filter(c => c.available === available); if (!group.length) return null; return <section className="coffee-group" key={String(available)}><div className="coffee-group-heading"><h2>{available ? "Aktuell vorhanden" : "Nicht mehr vorhanden"}</h2><span>{group.length}</span></div><div className="coffee-grid">{group.map(c => { const index = Math.min(selected[c.id] ?? 0, c.profiles.length - 1), p = c.profiles[index]; return <article className={`coffee-card ${!available ? "is-unavailable" : ""}`} key={c.id}><button className="coffee-card-main" type="button" onClick={() => setDetailId(c.id)} aria-label={`${c.name} öffnen`}><span className="coffee-photo">{c.photo ? <img src={c.photo} alt="" /> : <CoffeeIcon aria-hidden="true" />}{c.type === "decaf" && <span className="coffee-decaf">Decaf</span>}</span><span className="coffee-card-body"><strong>{c.name}</strong><span className="coffee-values"><span>Mahlgrad <b>{p.grind || "–"}</b></span><span>Menge <b>{p.amount || "–"}</b></span></span><span className="coffee-stars" aria-label={`Bewertung ${p.rating} von 5`}>{[1,2,3,4,5].map(n => <Star key={n} fill={n <= p.rating ? "currentColor" : "none"} />)}</span></span></button><label className="coffee-profile-picker"><span className="sr-only">Profil für {c.name}</span><select value={index} disabled={busy || c.profiles.length < 2} onChange={e => setSelected({ ...selected, [c.id]: Number(e.target.value) })}>{c.profiles.map((profile, i) => <option key={i} value={i}>{profile.extractionProfile || (i === 0 ? "Standard" : `Profil ${i + 1}`)}</option>)}</select></label></article>; })}</div></section>; })}
    {detail && !edit && <div className="coffee-overlay" onClick={() => setDetailId(null)}><section className="coffee-dialog" role="dialog" aria-modal="true" aria-labelledby="coffee-detail-title" onClick={e => e.stopPropagation()}><header className="coffee-dialog-header"><Button variant="ghost" size="icon" onClick={() => setDetailId(null)} aria-label="Zurück zur Übersicht"><ArrowLeft /></Button><span>KAFFEE</span><div className="coffee-header-actions"><Button variant="ghost" size="icon" disabled={busy} onClick={() => setEdit(structuredClone(detail))} aria-label="Kaffee bearbeiten"><Pencil /></Button><Button variant="ghost" size="icon" className="coffee-danger" disabled={busy} aria-label="Kaffee löschen" onClick={() => { if (confirm(`„${detail.name}“ löschen?`)) { void change({ ...data, coffees: data.coffees.filter(x => x.id !== detail.id) }); setDetailId(null); } }}><Trash2 /></Button></div></header><div className="coffee-dialog-content"><div className="coffee-detail-intro"><div className="coffee-detail-photo">{detail.photo ? <img src={detail.photo} alt="" /> : <CoffeeIcon />}</div><div><p className="eyebrow">{detail.available ? "Aktuell vorhanden" : "Nicht mehr vorhanden"}</p><h2 id="coffee-detail-title">{detail.name}</h2><p>{detail.type === "decaf" ? "Decaf" : "Normal"}</p></div></div><div className="coffee-detail-profiles">{detail.profiles.map((profile, i) => <section className="coffee-profile" key={i}><div className="coffee-profile-heading"><div><p className="eyebrow">{i === 0 ? "Standard" : `Profil ${i + 1}`}</p><h3>{profile.extractionProfile || "Extraktionsprofil"}</h3></div><span className="coffee-stars" aria-label={`Bewertung ${profile.rating} von 5`}>{[1,2,3,4,5].map(n => <Star key={n} fill={n <= profile.rating ? "currentColor" : "none"} />)}</span></div><dl className="coffee-detail-values"><div><dt>Mahlgrad</dt><dd>{profile.grind || "–"}</dd></div><div><dt>Menge</dt><dd>{profile.amount || "–"}</dd></div></dl>{profile.taste && <div className="coffee-detail-note"><strong>Geschmack</strong><p>{profile.taste}</p></div>}{profile.comment && <div className="coffee-detail-note"><strong>Kommentar</strong><p>{profile.comment}</p></div>}</section>)}</div></div></section></div>}
    {edit && <div className="coffee-overlay" onClick={() => { setCrop(null); setEdit(null); }}><form className="coffee-dialog coffee-editor" role="dialog" aria-modal="true" aria-labelledby="coffee-edit-title" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (!edit.name.trim() || crop) return; const next = { ...edit, name: edit.name.trim(), updatedAt: Date.now() }; const profileNames = [...new Set([...data.profileNames, ...next.profiles.map(p => p.extractionProfile.trim()).filter(Boolean)])]; void change({ profileNames, coffees: data.coffees.some(c => c.id === next.id) ? data.coffees.map(c => c.id === next.id ? next : c) : [next, ...data.coffees] }); setDetailId(next.id); setEdit(null); }}><header className="coffee-dialog-header"><h2 id="coffee-edit-title">{data.coffees.some(c => c.id === edit.id) ? "Kaffee bearbeiten" : "Neuer Kaffee"}</h2><Button variant="ghost" size="icon" type="button" aria-label="Schließen" onClick={() => { setCrop(null); setEdit(null); }}><X /></Button></header><div className="coffee-dialog-content coffee-form"><div className="coffee-form-grid"><label className="coffee-field coffee-wide">Name<input required value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label><label className="coffee-field">Typ<select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value as Coffee["type"] })}><option value="normal">Normal</option><option value="decaf">Decaf</option></select></label><label className="coffee-check"><input type="checkbox" checked={edit.available} onChange={e => setEdit({ ...edit, available: e.target.checked })} /> Aktuell vorhanden</label></div><div className="coffee-photo-edit">{edit.photo && <img className="coffee-edit-image" src={edit.photo} alt="Kaffeefoto" />}<div><label className="coffee-upload"><span>Foto wählen</span><input type="file" accept="image/*" onChange={e => void photoFile(e.target.files?.[0])} /></label>{edit.photo && <Button variant="ghost" type="button" onClick={() => setEdit({ ...edit, photo: null })}>Foto entfernen</Button>}</div></div>{photoError && <p role="alert" className="coffee-danger">{photoError}</p>}{crop && <CoffeeCrop bitmap={crop} onApply={photo => { setEdit({ ...edit, photo }); setCrop(null); }} onCancel={() => setCrop(null)} />}
    <datalist id="coffee-profile-names">{data.profileNames.map(n => <option key={n} value={n} />)}</datalist>{edit.profiles.map((p, i) => <fieldset className="coffee-profile coffee-form-grid" key={i}><legend>{i === 0 ? "Standardprofil" : `Profil ${i + 1}`}</legend>{([ ["extractionProfile", "Extraktionsprofil"], ["grind", "Mahlgrad"], ["amount", "Menge"], ["taste", "Geschmack"], ["comment", "Kommentar"] ] as const).map(([key, label]) => <label className={`coffee-field ${key === "extractionProfile" || key === "taste" || key === "comment" ? "coffee-wide" : ""}`} key={key}>{label}<input list={key === "extractionProfile" ? "coffee-profile-names" : undefined} value={p[key]} onChange={e => setEdit({ ...edit, profiles: edit.profiles.map((v, j) => j === i ? { ...v, [key]: e.target.value } : v) })} /></label>)}<label className="coffee-field">Bewertung<select value={p.rating} onChange={e => setEdit({ ...edit, profiles: edit.profiles.map((v, j) => j === i ? { ...v, rating: Number(e.target.value) } : v) })}>{[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} von 5</option>)}</select></label><div className="coffee-actions coffee-wide"><Button variant="outline" size="icon" type="button" aria-label="Profil nach oben" disabled={i === 0} onClick={() => { const profiles = [...edit.profiles]; [profiles[i-1], profiles[i]] = [profiles[i], profiles[i-1]]; setEdit({ ...edit, profiles }); }}><ArrowUp /></Button><Button variant="outline" size="icon" type="button" aria-label="Profil nach unten" disabled={i === edit.profiles.length - 1} onClick={() => { const profiles = [...edit.profiles]; [profiles[i+1], profiles[i]] = [profiles[i], profiles[i+1]]; setEdit({ ...edit, profiles }); }}><ArrowDown /></Button><Button variant="ghost" type="button" disabled={edit.profiles.length === 1} onClick={() => setEdit({ ...edit, profiles: edit.profiles.filter((_, j) => j !== i) })}>Profil entfernen</Button></div></fieldset>)}<Button variant="outline" type="button" onClick={() => setEdit({ ...edit, profiles: [...edit.profiles, blankProfile()] })}><Plus /> Profil hinzufügen</Button></div><footer className="coffee-dialog-footer"><Button variant="outline" type="button" onClick={() => { setCrop(null); setEdit(null); }}>Abbrechen</Button><Button type="submit" disabled={!!crop}>Speichern</Button></footer></form></div>}
  </section>{settingsTarget && createPortal(settings, settingsTarget)}</>;
}
