import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";

test("Push funktioniert in workerd und folgt keinen Weiterleitungen", async () => {
  const sender = fileURLToPath(new URL("./push-send.ts", import.meta.url));
  const code = `import {sendPush} from ${JSON.stringify(sender)};
  const encode=(value)=>btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  export default {async fetch(){
    const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const browser=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',expirationTime:null,keys:{p256dh:encode(await crypto.subtle.exportKey('raw',browser.publicKey)),auth:encode(crypto.getRandomValues(new Uint8Array(16)))}};
    const config={NEST_VAPID_PUBLIC_KEY:encode(await crypto.subtle.exportKey('raw',vapid.publicKey)),NEST_VAPID_PRIVATE_KEY:(await crypto.subtle.exportKey('jwk',vapid.privateKey)).d,NEST_VAPID_SUBJECT:'https://nest.example'};
    return Response.json({status:await sendPush(subscription,{title:'Nest',body:'Test',tag:'test',url:'/'},config)});
  }};`;
  const bundle = await build({ stdin: { contents: code, resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" });
  let requests = 0, status = 201;
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], cf: false,
    outboundService: async (request) => {
      requests++;
      assert.equal(request.url, "https://fcm.googleapis.com/fcm/send/test");
      assert.equal(request.method, "POST");
      return new Response(null, { status, ...(status === 302 ? { headers: { location: "https://untrusted.example/" } } : {}) });
    },
  });
  try {
    assert.equal((await (await runtime.dispatchFetch("http://localhost/")).json()).status, 201);
    assert.equal(requests, 1);
    status = 302;
    assert.equal((await (await runtime.dispatchFetch("http://localhost/")).json()).status, 302);
    assert.equal(requests, 2);
  } finally { await runtime.dispose(); }
});
