export type CommentAuthor = "Markus" | "Bettina";
export function commentAuthorForEmail(email: string | null, rawConfig: string | undefined): CommentAuthor | null {
  if (!email || !rawConfig) return null;
  try {
    const data: unknown = JSON.parse(rawConfig);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const normalized = email.trim().toLowerCase();
    const matches = Object.entries(data).filter(([key]) => key.trim().toLowerCase() === normalized);
    if (matches.length !== 1) return null;
    const author = matches[0][1];
    return author === "Markus" || author === "Bettina" ? author : null;
  } catch { return null; }
}
export function createIdentityService(identify: (request: Request) => Promise<string | null>, readConfig: () => string | undefined) {
  return async (request: Request) => {
    const email = await identify(request);
    if (!email) return Response.json({ error: "Nicht angemeldet oder kein Zugriff." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ author: commentAuthorForEmail(email, readConfig()) }, { headers: { "Cache-Control": "no-store" } });
  };
}
