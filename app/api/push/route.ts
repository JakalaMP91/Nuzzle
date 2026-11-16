import { env } from "cloudflare:workers";
import { householdIdentity } from "@/lib/household-auth";
import { createPushService } from "@/lib/push-service";
import { sendPush } from "@/lib/push-send";

export const dynamic = "force-dynamic";
function service() { return createPushService({ db: env.DB, identify: householdIdentity, config: env, send: (subscription, message) => sendPush(subscription, message, env) }); }
export function GET(request: Request) { return service().GET(request); }
export function POST(request: Request) { return service().POST(request); }
export function DELETE(request: Request) { return service().DELETE(request); }
