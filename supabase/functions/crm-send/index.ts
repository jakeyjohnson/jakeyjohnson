// crm-send: every outgoing CRM email and SMS goes through here.
//
// Called from crm.html with the admin's own login token. Three modes:
//   { campaign_id }                                     send a campaign to its audience
//   { test: true, channel, subject, body, to }          send one test copy (sample merge data)
//   { lead_id, channel, subject?, body }                one-off message to a single lead
//
// A campaign send returns straight away and carries on in the
// background; crm.html polls the campaign row for progress. Re-sending a
// campaign that failed part-way only goes to people who haven't already
// been sent it, so nobody gets a duplicate.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  assertEmailConfigured,
  assertSmsConfigured,
  corsHeaders,
  emailHtml,
  emailText,
  env,
  type EventRow,
  json,
  type Lead,
  mapLimit,
  mergeVars,
  normalisePhone,
  oneClickUnsubscribeUrl,
  type OutgoingEmail,
  renderTemplate,
  sendEmailBatch,
  sendSms,
  type SendResult,
  smsBody,
} from "../_shared/messaging.ts";

type Channel = "email" | "sms";

const LEAD_COLUMNS = "id, first_name, last_name, email, phone, city, company, unsubscribe_token, event_id";
// A campaign stuck in "sending" this long (the function was stopped
// mid-run) can be sent again to finish it off.
const STALE_SENDING_MS = 15 * 60 * 1000;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Only the logged-in back-office user may send anything.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Not signed in" }, 401);
  const actor = userData.user.email ?? "";

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (input.test) return json(await sendTest(input));
    if (input.lead_id) return json(await sendOneOff(admin, input, actor));
    if (input.campaign_id) return json(await startCampaign(admin, String(input.campaign_id), actor));
    return json({ error: "Nothing to send" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

function assertChannel(channel: unknown): Channel {
  if (channel !== "email" && channel !== "sms") throw new Error("Channel must be email or sms");
  channel === "email" ? assertEmailConfigured() : assertSmsConfigured();
  return channel;
}

async function loadEvents(admin: SupabaseClient, ids: (string | null)[]): Promise<Map<string, EventRow>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, EventRow>();
  if (!unique.length) return map;
  const { data, error } = await admin.from("events").select("id, slug, city, event_date, event_time, venue").in("id", unique);
  if (error) throw error;
  for (const ev of data ?? []) map.set(ev.id, ev as EventRow);
  return map;
}

function buildEmail(lead: Lead, event: EventRow | null, subject: string, body: string): OutgoingEmail {
  const vars = mergeVars(lead, event, "email");
  const text = renderTemplate(body, vars);
  return {
    to: lead.email!,
    subject: renderTemplate(subject, vars),
    html: emailHtml(text, vars.unsubscribe_link),
    text: emailText(text, vars.unsubscribe_link),
    oneClickUrl: oneClickUnsubscribeUrl(lead.unsubscribe_token),
  };
}

function buildSms(lead: Lead, event: EventRow | null, body: string): string {
  return smsBody(renderTemplate(body, mergeVars(lead, event, "sms")));
}

// ---------- test send ----------

async function sendTest(input: Record<string, unknown>) {
  const channel = assertChannel(input.channel);
  const to = String(input.to ?? "").trim();
  if (!to) throw new Error("Enter an address to send the test to");
  const sample: Lead = {
    id: "test", first_name: "Alex", last_name: "Sample", email: to, phone: normalisePhone(to),
    city: "London", company: "", unsubscribe_token: "00000000-0000-0000-0000-000000000000", event_id: null,
  };
  const sampleEvent: EventRow = {
    id: "test", slug: "", city: "London", event_date: new Date().toISOString().slice(0, 10), event_time: "18:00", venue: "Sample Venue",
  };
  const body = String(input.body ?? "");
  if (!body.trim()) throw new Error("Message is empty");

  let result: SendResult;
  if (channel === "email") {
    const subject = "[TEST] " + String(input.subject ?? "");
    [result] = await sendEmailBatch([buildEmail(sample, sampleEvent, subject, body)]);
  } else {
    if (!sample.phone) throw new Error("That doesn't look like a phone number");
    result = await sendSms(sample.phone, "[TEST] " + buildSms(sample, sampleEvent, body));
  }
  if (!result.ok) throw new Error(result.error);
  return { ok: true };
}

// ---------- one-off message to a single lead ----------

async function sendOneOff(admin: SupabaseClient, input: Record<string, unknown>, actor: string) {
  const channel = assertChannel(input.channel);
  const body = String(input.body ?? "");
  const subject = String(input.subject ?? "");
  if (!body.trim()) throw new Error("Message is empty");
  if (channel === "email" && !subject.trim()) throw new Error("Add a subject");

  const { data: lead, error } = await admin.from("crm_leads").select(LEAD_COLUMNS).eq("id", input.lead_id).single();
  if (error || !lead) throw new Error("Lead not found");
  const to = channel === "email" ? lead.email : lead.phone;
  if (!to) throw new Error(channel === "email" ? "This lead has no email address" : "This lead has no phone number");

  const events = await loadEvents(admin, [lead.event_id]);
  const event = lead.event_id ? events.get(lead.event_id) ?? null : null;

  const result = channel === "email"
    ? (await sendEmailBatch([buildEmail(lead as Lead, event, subject, body)]))[0]
    : await sendSms(to, buildSms(lead as Lead, event, body));

  await admin.from("crm_messages").insert({
    lead_id: lead.id, channel, to_address: to,
    status: result.ok ? "sent" : "failed",
    provider_id: result.ok ? result.id : null,
    error: result.ok ? null : result.error,
  });
  if (!result.ok) throw new Error(result.error);

  await admin.from("crm_leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", lead.id);
  await admin.from("crm_activities").insert({
    lead_id: lead.id, kind: channel, created_by: actor,
    body: channel === "email" ? `Email: ${subject}` : `SMS: ${body.slice(0, 140)}`,
  });
  return { ok: true };
}

// ---------- campaign ----------

async function startCampaign(admin: SupabaseClient, campaignId: string, actor: string) {
  const { data: campaign, error } = await admin.from("crm_campaigns").select("*").eq("id", campaignId).single();
  if (error || !campaign) throw new Error("Campaign not found");
  const channel = assertChannel(campaign.channel);
  if (!String(campaign.body).trim()) throw new Error("Message is empty");
  if (channel === "email" && !String(campaign.subject).trim()) throw new Error("Add a subject line");

  // Claim the campaign atomically so a double-click (or two tabs) can't
  // send it twice: only one request can move it into "sending".
  const staleBefore = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("crm_campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId)
    .or(`status.in.(draft,failed),and(status.eq.sending,updated_at.lt."${staleBefore}")`)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed?.length) {
    throw new Error(campaign.status === "sent" ? "This campaign has already been sent. Duplicate it to send again." : "This campaign is already sending.");
  }

  const work = runCampaign(admin, campaign, channel, actor).catch(async (e) => {
    console.error("crm-send campaign failed", campaignId, e);
    await admin.from("crm_campaigns").update({ status: "failed" }).eq("id", campaignId);
  });
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return { ok: true, started: true };
}

// deno-lint-ignore no-explicit-any
async function runCampaign(admin: SupabaseClient, campaign: any, channel: Channel, actor: string) {
  // Audience comes from the same crm_audience() SQL function crm.html
  // uses for its recipient count, so what was previewed is what's sent.
  const leads: Lead[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .rpc("crm_audience", { p_audience: campaign.audience ?? {}, p_channel: channel })
      .select(LEAD_COLUMNS)
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Lead[];
    leads.push(...rows);
    if (rows.length < 1000) break;
  }

  // Resuming a failed send: clear the old failures (they're retried
  // below) and skip anyone this campaign already reached.
  await admin.from("crm_messages").delete().eq("campaign_id", campaign.id).eq("status", "failed");
  const alreadySent = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("crm_messages").select("lead_id")
      .eq("campaign_id", campaign.id).eq("status", "sent")
      .range(from, from + 999);
    if (error) throw error;
    for (const m of data ?? []) if (m.lead_id) alreadySent.add(m.lead_id);
    if (!data || data.length < 1000) break;
  }
  const todo = leads.filter((l) => !alreadySent.has(l.id));

  await admin.from("crm_campaigns").update({ recipients_count: leads.length }).eq("id", campaign.id);
  const events = await loadEvents(admin, [...todo.map((l) => l.event_id), campaign.audience?.event_id ?? null]);
  const campaignEvent = campaign.audience?.event_id ? events.get(campaign.audience.event_id) ?? null : null;
  const eventFor = (l: Lead) => (l.event_id ? events.get(l.event_id) ?? campaignEvent : campaignEvent);

  const chunkSize = channel === "email" ? 100 : 50;
  for (let i = 0; i < todo.length; i += chunkSize) {
    const chunk = todo.slice(i, i + chunkSize);
    let results: SendResult[];
    if (channel === "email") {
      results = await sendEmailBatch(chunk.map((l) => buildEmail(l, eventFor(l), campaign.subject, campaign.body)));
    } else {
      results = await mapLimit(chunk, 8, (l) => sendSms(l.phone!, buildSms(l, eventFor(l), campaign.body)));
    }
    await recordChunk(admin, campaign, channel, chunk, results, actor);
    await refreshCounts(admin, campaign.id);
  }

  const counts = await refreshCounts(admin, campaign.id);
  await admin.from("crm_campaigns").update({
    status: counts.sent === 0 && counts.failed > 0 ? "failed" : "sent",
    sent_at: new Date().toISOString(),
  }).eq("id", campaign.id);
}

async function recordChunk(
  admin: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  campaign: any,
  channel: Channel,
  chunk: Lead[],
  results: SendResult[],
  actor: string,
) {
  await admin.from("crm_messages").insert(chunk.map((l, i) => {
    const r = results[i];
    return {
      campaign_id: campaign.id, lead_id: l.id, channel,
      to_address: channel === "email" ? l.email : l.phone,
      status: r.ok ? "sent" : "failed",
      provider_id: r.ok ? r.id : null,
      error: r.ok ? null : r.error,
    };
  }));

  const sentIds = chunk.filter((_, i) => results[i].ok).map((l) => l.id);
  if (!sentIds.length) return;
  await admin.from("crm_leads").update({ last_contacted_at: new Date().toISOString() }).in("id", sentIds);
  await admin.from("crm_activities").insert(sentIds.map((id) => ({
    lead_id: id, kind: channel, created_by: actor,
    body: `${channel === "email" ? "Mailer" : "SMS"}: ${campaign.name}`,
    meta: { campaign_id: campaign.id },
  })));
}

async function refreshCounts(admin: SupabaseClient, campaignId: string) {
  const count = async (status: string) => {
    const { count } = await admin.from("crm_messages").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId).eq("status", status);
    return count ?? 0;
  };
  const [sent, failed] = await Promise.all([count("sent"), count("failed")]);
  await admin.from("crm_campaigns").update({ sent_count: sent, failed_count: failed }).eq("id", campaignId);
  return { sent, failed };
}
