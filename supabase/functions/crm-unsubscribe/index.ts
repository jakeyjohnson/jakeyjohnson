// crm-unsubscribe: the one-click target of every mailer's
// List-Unsubscribe header (RFC 8058). Gmail/Apple Mail/Outlook show their
// own "Unsubscribe" button and POST here directly, no page involved.
// A plain GET (someone opening the link) is sent to unsubscribe.html,
// which confirms on screen.
//
// Deploy with --no-verify-jwt: mail clients don't carry a Supabase login.
// The only thing it can do is switch consent OFF for the lead whose
// unguessable token is in the URL, via the crm_unsubscribe() function.

import { createClient } from "npm:@supabase/supabase-js@2";
import { env, siteUrl } from "../_shared/messaging.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const channel = ["email", "sms", "all"].includes(url.searchParams.get("c") ?? "") ? url.searchParams.get("c")! : "email";

  if (req.method === "GET") {
    return Response.redirect(`${siteUrl()}/unsubscribe.html?t=${encodeURIComponent(token)}&c=${channel}`, 302);
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!UUID.test(token)) return new Response("Bad token", { status: 400 });

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { error } = await admin.rpc("crm_unsubscribe", { p_token: token, p_channel: channel });
  if (error) return new Response("Error", { status: 500 });
  return new Response("Unsubscribed", { status: 200 });
});
