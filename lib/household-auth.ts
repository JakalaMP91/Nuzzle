import { env } from "cloudflare:workers";
import { parseAccessConfig, verifyAccessToken } from "@/lib/access-token";
import { fetchAccessKeys } from "@/lib/access-keys";

// Fail closed unless the genuine, signed Access assertion and both allowlisted
// account addresses are configured. No development authentication bypass.
export async function householdIdentity(request: Request): Promise<string | null> {
  const config = parseAccessConfig(env.NEST_ACCESS_TEAM_DOMAIN, env.NEST_ACCESS_AUDIENCE, env.NEST_ALLOWED_EMAILS);
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!config || !token) return null;
  return verifyAccessToken(token, config, () => fetchAccessKeys(config.issuer));
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
