// Cloudflare Access JWT verification. Never trust the unsigned email header.
type Jwk = JsonWebKey & { kid?: string };
type Claims = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string };
export type AccessConfig = { issuer: string; audience: string; allowedEmails: string[] };

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Url(value)));
}

export function parseAccessConfig(teamDomain?: string, audience?: string, emails?: string): AccessConfig | null {
  const host = (teamDomain ?? "").trim().toLowerCase().replace(/^https:\/\//, "").replace(/\/$/, "");
  const allowedEmails = (emails ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(host) || !audience?.trim() || !allowedEmails.length) return null;
  return { issuer: `https://${host}`, audience: audience.trim(), allowedEmails };
}

export async function verifyAccessToken(
  token: string,
  config: AccessConfig,
  getKeys: () => Promise<Jwk[]>,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  try {
    if (token.length > 16384) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = decodeJson(parts[0]) as { alg?: string; kid?: string };
    const claims = decodeJson(parts[1]) as Claims;
    if (!header || header.alg !== "RS256" || !header.kid || !claims || typeof claims !== "object") return null;
    if (claims.iss !== config.issuer || typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
    if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > nowSeconds)) return null;
    if (!(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(config.audience)) return null;
    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
    if (!config.allowedEmails.includes(email)) return null;
    const key = (await getKeys()).find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA" && (!candidate.alg || candidate.alg === "RS256"));
    if (!key) return null;
    const publicKey = await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signature = decodeBase64Url(parts[2]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature.buffer as ArrayBuffer, new TextEncoder().encode(parts[0] + "." + parts[1]));
    return verified ? email : null;
  } catch {
    return null;
  }
}
