import { maxHouseholdBytes, parseHouseholdData } from "./household-data.ts";
import { maxHouseholdInputBytes, normalizeHouseholdImages } from "./household-images.ts";
import { commentAuthorForEmail } from "./household-identity.ts";

const headers = { "Cache-Control": "no-store" };
type Dependencies = { db?: Pick<D1Database, "prepare" | "batch">; identify: (request: Request) => Promise<string | null>; commentAuthors?: string };

export function createHouseholdService({ db, identify, commentAuthors }: Dependencies) {
  async function GET(request: Request) {
    const identity = await identify(request);
    if (!identity) return Response.json({ error: "Nicht angemeldet oder kein Zugriff." }, { status: 401, headers });
    if (!db) return Response.json({ error: "Datenbank ist nicht eingerichtet." }, { status: 503, headers });
    const row = await db.prepare("SELECT revision, data FROM household WHERE id = 1").first<{ revision: number; data: string }>();
    if (!row) return Response.json({ revision: 0, data: null, author: commentAuthorForEmail(identity, commentAuthors) }, { headers });
    try {
      const data = parseHouseholdData(JSON.parse(row.data));
      if (!data) throw new Error("Invalid stored data");
      return Response.json({ revision: row.revision, data, author: commentAuthorForEmail(identity, commentAuthors) }, { headers });
    } catch {
      return Response.json({ error: "Gespeicherte Daten konnten nicht gelesen werden." }, { status: 500, headers });
    }
  }

  async function PUT(request: Request) {
    if (!await identify(request)) return Response.json({ error: "Nicht angemeldet oder kein Zugriff." }, { status: 401, headers });
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403, headers });
    if (!db) return Response.json({ error: "Datenbank ist nicht eingerichtet." }, { status: 503, headers });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Ungültiges Format." }, { status: 415, headers });
    let body: { revision?: unknown; data?: unknown };
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > maxHouseholdInputBytes) return Response.json({ error: "Die Daten sind zu groß." }, { status: 413, headers });
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Ungültige Daten." }, { status: 400, headers });
    }
    const input = parseHouseholdData(body?.data, maxHouseholdInputBytes);
    const revision = body?.revision;
    if (!input || !Number.isSafeInteger(revision) || (revision as number) < 0) return Response.json({ error: "Ungültige Haushaltsdaten." }, { status: 400, headers });
    let normalized: Awaited<ReturnType<typeof normalizeHouseholdImages>>;
    try { normalized = await normalizeHouseholdImages(input); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ungültige Bilder." }, { status: 400, headers }); }
    const data = parseHouseholdData(normalized.data, maxHouseholdBytes);
    if (!data) return Response.json({ error: "Die Haushaltsdaten sind zu groß." }, { status: 413, headers });
    const payload = JSON.stringify(data);
    const now = Date.now();
    const update = revision === 0
      ? db.prepare("INSERT INTO household (id, revision, data, updated_at) VALUES (1, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING revision").bind(payload, now)
      : db.prepare("UPDATE household SET data = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ? RETURNING revision").bind(payload, now, revision);
    let row: { revision: number } | null;
    if (normalized.images.length) {
      const images = normalized.images.map(({ id, content }) => revision === 0
        ? db.prepare("INSERT INTO household_image (id, content, created_at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM household WHERE id = 1) ON CONFLICT(id) DO NOTHING").bind(id, content, now)
        : db.prepare("INSERT INTO household_image (id, content, created_at) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM household WHERE id = 1 AND revision = ?) ON CONFLICT(id) DO NOTHING").bind(id, content, now, revision));
      const results = await db.batch<{ revision: number }>([...images, update]);
      row = results[results.length - 1]?.results?.[0] ?? null;
    } else row = await update.first<{ revision: number }>();
    if (!row) return Response.json({ error: "Die Daten wurden inzwischen auf einem anderen Gerät geändert." }, { status: 409, headers });
    return Response.json({ revision: row.revision, data }, { headers });
  }
  return { GET, PUT };
}
