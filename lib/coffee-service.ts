import { parseCoffeeBackup } from "./coffee-import.ts";

type Dependencies = { db?: Pick<D1Database, "prepare">; identify: (request: Request) => Promise<string | null> };
const headers = { "Cache-Control": "no-store" };
export function createCoffeeService({ db, identify }: Dependencies) {
  async function GET(request: Request) {
    if (!await identify(request)) return Response.json({ error: "Nicht angemeldet." }, { status: 401, headers });
    if (!db) return Response.json({ error: "Datenbank nicht verfügbar." }, { status: 503, headers });
    const row = await db.prepare("SELECT revision, data FROM coffee_collection WHERE id = 1").first<{ revision: number; data: string }>();
    return Response.json(row ? { revision: row.revision, data: JSON.parse(row.data) } : { revision: 0, data: { coffees: [], profileNames: [] } }, { headers });
  }
  async function PUT(request: Request) {
    if (!await identify(request)) return Response.json({ error: "Nicht angemeldet." }, { status: 401, headers });
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403, headers });
    if (!db) return Response.json({ error: "Datenbank nicht verfügbar." }, { status: 503, headers });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Ungültiges Format." }, { status: 415, headers });
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 1_500_000) return Response.json({ error: "Kaffeedaten sind zu groß." }, { status: 413, headers });
      const body = JSON.parse(raw);
      if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error("Ungültige Revision.");
      const data = parseCoffeeBackup({ app: "kaffee-tracker", schemaVersion: 1, ...body.data }, true);
      const payload = JSON.stringify(data), now = Date.now();
      const query = body.revision === 0
        ? db.prepare("INSERT INTO coffee_collection (id, revision, data, updated_at) VALUES (1, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING revision").bind(payload, now)
        : db.prepare("UPDATE coffee_collection SET revision = revision + 1, data = ?, updated_at = ? WHERE id = 1 AND revision = ? RETURNING revision").bind(payload, now, body.revision);
      const result = await query.first<{ revision: number }>();
      return result ? Response.json({ revision: result.revision }, { headers }) : Response.json({ error: "Die Kaffeedaten wurden auf einem anderen Gerät geändert." }, { status: 409, headers });
    } catch { return Response.json({ error: "Kaffeedaten konnten nicht gespeichert werden." }, { status: 400, headers }); }
  }
  return { GET, PUT };
}
