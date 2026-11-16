import { build } from "esbuild";
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const scheduler = new URL("../lib/push-scheduler.ts", import.meta.url);
await readFile(new URL("dist/server/index.js", root));
await build({
  stdin: { contents: `import { runTaskPush } from ${JSON.stringify(fileURLToPath(scheduler))}; import { sendPush } from ${JSON.stringify(fileURLToPath(new URL("../lib/push-send.ts", import.meta.url)))}; export async function scheduled(event, env, ctx) { ctx.waitUntil(runTaskPush({ db: env.DB, config: env, now: event.scheduledTime, send: (subscription, message) => sendPush(subscription, message, env) })); }`, resolveDir: fileURLToPath(root), sourcefile: "nest-push-scheduled.ts", loader: "ts" },
  absWorkingDir: fileURLToPath(root), bundle: true, format: "esm", platform: "browser", target: "es2022", outfile: fileURLToPath(new URL("dist/server/push-scheduled.js", root)), minify: true,
});
await writeFile(new URL("dist/server/push-worker.js", root), `import app from "./index.js";\nimport { scheduled } from "./push-scheduled.js";\nexport default { ...app, fetch: (...args) => app.fetch(...args), scheduled };\n`);
console.log("Push-Worker vorbereitet. Deployment-main: push-worker.js; Cron: * * * * *.");
