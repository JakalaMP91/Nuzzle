// A manual redirect check prevents following an unexpected URL. Workers does
// not support fetch redirect: "error", even though browsers and Node do.
export async function fetchAccessKeys(
  issuer: string,
  fetcher: typeof fetch = fetch,
): Promise<(JsonWebKey & { kid?: string })[]> {
  const response = await fetcher(issuer + "/cdn-cgi/access/certs", {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Access keys unavailable");
  const json = await response.json() as { keys?: (JsonWebKey & { kid?: string })[] };
  if (!Array.isArray(json.keys)) throw new Error("Invalid Access key response");
  return json.keys;
}
