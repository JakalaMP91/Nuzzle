// The original backup remains authoritative until the user confirms an import.
export type CoffeeProfile = { grind: string; amount: string; extractionProfile: string; taste: string; rating: number; comment: string };
export type Coffee = { id: string; name: string; type: "normal" | "decaf"; available: boolean; photo: string | null; profiles: CoffeeProfile[]; createdAt: number; updatedAt: number };
export type CoffeeBackup = { coffees: Coffee[]; profileNames: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown) => typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";

export function parseCoffeeBackup(value: unknown, cloud = false): CoffeeBackup {
  if (!isRecord(value) || value.app !== "kaffee-tracker" || value.schemaVersion !== 1 || !Array.isArray(value.coffees) || !Array.isArray(value.profileNames) || !value.profileNames.every(n => typeof n === "string")) throw new Error("Ungültiges oder nicht unterstütztes Coffee-Tracker-Backup.");
  const ids = new Set<string>();
  const coffees = value.coffees.map(raw => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id || ids.has(raw.id) || typeof raw.name !== "string" || !raw.name.trim()) throw new Error("Ein Kaffee hat eine fehlende oder doppelte ID oder keinen Namen.");
    ids.add(raw.id);
    if (raw.type !== "normal" && raw.type !== "decaf") throw new Error("Ein Kaffee hat einen unbekannten Typ.");
    if (raw.photo != null && (typeof raw.photo !== "string" || !(cloud ? /^\/api\/household-image\?id=[a-f0-9]{64}$/ : /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).test(raw.photo))) throw new Error("Ein Foto hat ein nicht unterstütztes Format.");
    if (raw.profiles !== undefined && !Array.isArray(raw.profiles)) throw new Error("Ungültige Profilangaben.");
    const entries = Array.isArray(raw.profiles) && raw.profiles.length ? raw.profiles : [{}];
    const profiles = entries.map((profile, i) => {
      if (!isRecord(profile)) throw new Error("Ungültiges Profil.");
      const rating = profile.rating || (i === 0 ? raw.rating : 0) || 0;
      if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0 || rating > 5) throw new Error("Ungültige Bewertung.");
      return { grind: string(profile.grind), amount: string(profile.amount), extractionProfile: string(profile.extractionProfile), taste: string(profile.taste || (i === 0 ? raw.taste : "")), rating, comment: string(profile.comment || (i === 0 ? raw.comment : "")) };
    });
    if (raw.available !== undefined && typeof raw.available !== "boolean") throw new Error("Ungültiger Verfügbarkeitsstatus.");
    if (typeof raw.createdAt !== "number" || !Number.isFinite(raw.createdAt) || typeof raw.updatedAt !== "number" || !Number.isFinite(raw.updatedAt)) throw new Error("Ungültiger Zeitstempel.");
    return { id: raw.id, name: raw.name, type: raw.type, available: raw.available !== false, photo: (raw.photo ?? null) as string | null, profiles, createdAt: raw.createdAt, updatedAt: raw.updatedAt } as Coffee;
  });
  return { coffees, profileNames: [...new Set(value.profileNames.map(n => n.trim()).filter(Boolean))] };
}
