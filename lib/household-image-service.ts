import { imageId, imagePayload, maxImageDataLength } from "./household-images.ts";

type Dependencies = { db?: Pick<D1Database, "prepare">; identify: (request: Request) => Promise<string | null> };
export function createHouseholdImageService({ db, identify }: Dependencies) {
  async function GET(request: Request) {
    if (!await identify(request)) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 400 });
    if (!db) return new Response(null, { status: 503 });
    const row = await db.prepare("SELECT content FROM household_image WHERE id = ?").bind(id).first<{ content: string }>();
    const payload = row && imagePayload(row.content);
    if (!payload) return new Response(null, { status: 404 });
    try {
      const binary = atob(payload.encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return new Response(bytes, { headers: { "Content-Type": payload.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    } catch { return new Response(null, { status: 500 }); }
  }
  async function POST(request: Request) {
    if (!await identify(request)) return Response.json({ error: "Nicht angemeldet oder kein Zugriff." }, { status: 401 });
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403 });
    if (!db) return Response.json({ error: "Datenbank ist nicht eingerichtet." }, { status: 503 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Ungültiges Format." }, { status: 415 });
    try {
      const raw = await request.text();
      if (raw.length > maxImageDataLength + 1024) return Response.json({ error: "Das Bild ist zu groß." }, { status: 413 });
      const body = JSON.parse(raw) as { content?: unknown };
      if (typeof body.content !== "string" || !imagePayload(body.content)) return Response.json({ error: "Ungültiges Bild." }, { status: 400 });
      const id = await imageId(body.content);
      await db.prepare("INSERT INTO household_image (id, content, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(id, body.content, Date.now()).run();
      return Response.json({ path: "/api/household-image?id=" + id }, { headers: { "Cache-Control": "no-store" } });
    } catch { return Response.json({ error: "Das Bild konnte nicht gespeichert werden." }, { status: 500 }); }
  }
  return { GET, POST };
}
