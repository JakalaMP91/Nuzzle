// Prepare a Cloudflare-native configuration without deploying or handling secrets.
import { readFile, writeFile } from "node:fs/promises";

const [worker, databaseName, databaseId] = process.argv.slice(2);
if (!worker || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(worker) ||
    !databaseName || !/^[A-Za-z0-9_-]{1,63}$/.test(databaseName) ||
    !databaseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
  throw new Error("Aufruf: node scripts/prepare-cloudflare-config.mjs <worker-name> <d1-name> <d1-uuid>");
}
const path = new URL("../dist/server/wrangler.json", import.meta.url);
const output = new URL("../dist/server/wrangler.nest.json", import.meta.url);
const config = JSON.parse(await readFile(path, "utf8"));
if (!Array.isArray(config.d1_databases) || config.d1_databases.length !== 1 || config.d1_databases[0].binding !== "DB" || config.main !== "index.js") {
  throw new Error("Unerwartete Build-Konfiguration. Keine Datei wurde geschrieben.");
}
config.name = worker;
config.topLevelName = worker;
config.workers_dev = true;
config.preview_urls = false;
config.d1_databases[0].database_name = databaseName;
config.d1_databases[0].database_id = databaseId;
await writeFile(output, JSON.stringify(config, null, 2) + "\n", { flag: "w" });
console.log("Lokale Worker-Konfiguration erstellt: dist/server/wrangler.nest.json");
console.log("Es wurden weder Zugangsdaten gespeichert noch Cloudflare-Ressourcen geändert.");
