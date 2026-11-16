import { buildPushPayload } from "@block65/webcrypto-web-push";
import { allowedPushEndpoint, type StoredPushSubscription } from "./push-subscription.ts";

export type PushConfig = { NEST_VAPID_PUBLIC_KEY?: string; NEST_VAPID_PRIVATE_KEY?: string; NEST_VAPID_SUBJECT?: string };
export type NestPushMessage = { title: string; body: string; tag: string; url: string };
export function pushConfigured(config: PushConfig): boolean {
  return Boolean(config.NEST_VAPID_PUBLIC_KEY && config.NEST_VAPID_PRIVATE_KEY && config.NEST_VAPID_SUBJECT);
}
export async function sendPush(subscription: StoredPushSubscription, message: NestPushMessage, config: PushConfig): Promise<number> {
  if (!pushConfigured(config) || !allowedPushEndpoint(subscription.endpoint)) throw new Error("Push is not configured");
  let stage = "encryption";
  try {
    const payload = await buildPushPayload({ data: JSON.stringify(message), options: { ttl: 3600 } }, subscription, {
      publicKey: config.NEST_VAPID_PUBLIC_KEY!, privateKey: config.NEST_VAPID_PRIVATE_KEY!, subject: config.NEST_VAPID_SUBJECT!,
    });
    stage = "network";
    // workerd supports "manual" and "follow", but rejects "error" before
    // sending the request. Manual returns redirects without following them.
    const response = await fetch(subscription.endpoint, { ...payload, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      const text = (await response.text()).slice(0, 4000);
      const reason = /invalid.{0,30}jwt|jwt.{0,30}invalid/i.test(text) ? "invalid-jwt" : /vapid|applicationserverkey|sender.?id/i.test(text) ? "vapid" : /expired|unregistered|not.?found/i.test(text) ? "subscription" : "rejected";
      console.warn("nest-push-delivery", { stage: "provider", status: response.status, reason });
    } else { try { await response.body?.cancel(); } catch { /* The push service already accepted the message. */ } }
    return response.status;
  } catch (error) {
    console.warn("nest-push-delivery", { stage, name: error instanceof Error ? error.name : "Error" });
    throw error;
  }
}
