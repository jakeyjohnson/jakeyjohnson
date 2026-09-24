// crm-sms-inbound: Twilio's "A message comes in" webhook.
//
// Point your Twilio number (or Messaging Service) at
//   https://<project-ref>.supabase.co/functions/v1/crm-sms-inbound
// and deploy with --no-verify-jwt (Twilio can't send a Supabase login).
// Requests are authenticated instead with Twilio's own X-Twilio-Signature,
// checked against TWILIO_AUTH_TOKEN, so nobody else can post fake replies.
//
// STOP / UNSUBSCRIBE / etc. turn SMS consent off for that number; START
// turns it back on. Every inbound text is logged on the lead's timeline.

import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { env, normalisePhone } from "../_shared/messaging.ts";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);
const START_WORDS = new Set(["START", "UNSTOP", "SUBSCRIBE"]);

function twiml(message?: string) {
  const body = message ? `<Message>${message.replace(/[<>&]/g, "")}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

// https://www.twilio.com/docs/usage/webhooks/webhooks-security
async function validSignature(url: string, params: URLSearchParams, signature: string): Promise<boolean> {
  const token = env("TWILIO_AUTH_TOKEN");
  if (!token || !signature) return false;
  const keys = [...new Set(params.keys())].sort();
  const data = url + keys.map((k) => k + params.getAll(k).join("")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  const expected = encodeBase64(mac);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const params = new URLSearchParams(await req.text());
  // Twilio signs the exact public URL it called. Behind Supabase's
  // gateway req.url is an internal address, so rebuild the public one
  // (override with TWILIO_WEBHOOK_URL if you've put a proxy in front).
  const publicUrl = env("TWILIO_WEBHOOK_URL") ||
    `${env("SUPABASE_URL").replace(/\/+$/, "")}/functions/v1/crm-sms-inbound`;
  if (!(await validSignature(publicUrl, params, req.headers.get("X-Twilio-Signature") ?? ""))) {
    return new Response("Invalid signature", { status: 403 });
  }

  const from = normalisePhone(params.get("From"));
  const text = (params.get("Body") ?? "").trim();
  if (!from) return twiml();

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: lead } = await admin.from("crm_leads").select("id").eq("phone", from).maybeSingle();
  if (!lead) return twiml();

  const keyword = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (STOP_WORDS.has(keyword)) {
    await admin.from("crm_leads").update({ sms_opt_in: false }).eq("id", lead.id);
    await admin.from("crm_activities").insert({ lead_id: lead.id, kind: "unsubscribe", body: `Replied "${text}" (SMS opt-out)`, meta: { channel: "sms" } });
    return twiml();
  }
  if (START_WORDS.has(keyword)) {
    await admin.from("crm_leads").update({ sms_opt_in: true }).eq("id", lead.id);
  }

  await admin.from("crm_activities").insert({
    lead_id: lead.id, kind: "sms_in", body: text.slice(0, 1000),
    meta: { from, message_sid: params.get("MessageSid") },
  });
  return twiml();
});
