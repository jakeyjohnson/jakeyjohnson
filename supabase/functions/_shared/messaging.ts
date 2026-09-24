// Shared by the CRM Edge Functions: merge-tag rendering, email/SMS
// formatting, and the two provider calls (Resend for email, Twilio for
// SMS). Keys come from Edge Function secrets, never from the browser:
//
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set MAIL_FROM="Party Padel <hello@partypadel.uk>"
//   supabase secrets set MAIL_REPLY_TO=hello@partypadel.uk          (optional)
//   supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=...
//   supabase secrets set TWILIO_FROM=+447...   (or a Messaging Service SID, MG...)
//   supabase secrets set SITE_URL=https://partypadel.uk
//   supabase secrets set MAIL_POSTAL_ADDRESS="Party Padel, ..."      (optional footer line)

export type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string;
  company: string;
  unsubscribe_token: string;
  event_id: string | null;
};

export type EventRow = {
  id: string;
  slug: string;
  city: string;
  event_date: string;
  event_time: string;
  venue: string;
};

export const env = (key: string, fallback = "") => Deno.env.get(key) ?? fallback;

export function siteUrl(): string {
  return env("SITE_URL", "https://partypadel.uk").replace(/\/+$/, "");
}

export function unsubscribePageUrl(token: string, channel: "email" | "sms" | "all") {
  return `${siteUrl()}/unsubscribe.html?t=${encodeURIComponent(token)}&c=${channel}`;
}

// One-click endpoint for the List-Unsubscribe header (RFC 8058) —
// mail clients POST here directly, so it has to be a real server
// endpoint rather than the static unsubscribe.html page.
export function oneClickUnsubscribeUrl(token: string) {
  return `${env("SUPABASE_URL").replace(/\/+$/, "")}/functions/v1/crm-unsubscribe?t=${encodeURIComponent(token)}&c=email`;
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
}

export function mergeVars(lead: Lead, event: EventRow | null, channel: "email" | "sms"): Record<string, string> {
  return {
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
    city: lead.city ?? "",
    company: lead.company ?? "",
    event_city: event?.city ?? "",
    event_venue: event?.venue ?? "",
    event_date: event ? formatEventDate(event.event_date) : "",
    event_time: event?.event_time ?? "",
    event_link: event ? `${siteUrl()}/event.html?slug=${encodeURIComponent(event.slug)}` : `${siteUrl()}/events.html`,
    unsubscribe_link: unsubscribePageUrl(lead.unsubscribe_token, channel),
  };
}

// {{first_name}} or {{first_name|there}} (fallback used when blank).
// Unknown tags render as empty rather than leaking "{{...}}" to a lead.
// Keep in step with renderTemplate() in assets/js/crm.js, which is the
// same logic for the in-browser preview.
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi, (_m, key: string, fallback?: string) => {
    const v = vars[key.toLowerCase()];
    return v && v.trim() !== "" ? v : (fallback ?? "").trim();
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function linkify(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, (url) =>
    `<a href="${url}" style="color:#090909;font-weight:700;">${url}</a>`
  );
}

// Plain-text body → a simple, robust HTML email. Blank lines become
// paragraphs, URLs become links. Deliberately table-based and inline-
// styled, since that's what renders reliably across mail clients.
export function emailHtml(bodyText: string, unsubscribeUrl: string): string {
  const paragraphs = bodyText
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.55;">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const postal = env("MAIL_POSTAL_ADDRESS");
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">
<tr><td style="background:#090909;padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:900;letter-spacing:.08em;color:#DFFF00;text-transform:uppercase;">Party Padel</td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#171717;">${paragraphs}</td></tr>
<tr><td style="padding:16px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b6b6b;border-top:1px solid #eeeeee;">
You're getting this because you asked Party Padel to keep you posted.${postal ? `<br>${escapeHtml(postal)}` : ""}<br>
<a href="${unsubscribeUrl}" style="color:#6b6b6b;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
}

export function emailText(bodyText: string, unsubscribeUrl: string): string {
  const postal = env("MAIL_POSTAL_ADDRESS");
  return `${bodyText.trim()}\n\n--\nParty Padel${postal ? `\n${postal}` : ""}\nUnsubscribe: ${unsubscribeUrl}\n`;
}

// Every marketing SMS carries an opt-out. Added automatically unless
// the message already mentions STOP, so it's never forgotten.
export function smsBody(text: string): string {
  const t = text.trim();
  return /\bstop\b/i.test(t) ? t : `${t}\nReply STOP to opt out`;
}

// Same rules as crm_normalise_phone() in supabase/crm.sql.
export function normalisePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  let v = p.replace(/[^0-9+]/g, "");
  if (!v) return null;
  if (v.startsWith("00")) v = "+" + v.slice(2);
  if (v.startsWith("+440")) v = "+44" + v.slice(4); // "+44 (0)7700..."
  if (v.startsWith("+")) return v;
  if (v.startsWith("44")) return "+" + v;
  if (v.startsWith("0")) return "+44" + v.slice(1);
  return "+" + v;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  oneClickUrl?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

function emailPayload(m: OutgoingEmail) {
  const payload: Record<string, unknown> = {
    from: env("MAIL_FROM"),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
  };
  const replyTo = env("MAIL_REPLY_TO");
  if (replyTo) payload.reply_to = replyTo;
  if (m.oneClickUrl) {
    payload.headers = {
      "List-Unsubscribe": `<${m.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  return payload;
}

export function assertEmailConfigured() {
  if (!env("RESEND_API_KEY") || !env("MAIL_FROM")) {
    throw new Error("Email isn't set up yet: add the RESEND_API_KEY and MAIL_FROM secrets (see README, CRM section).");
  }
}

export function assertSmsConfigured() {
  if (!env("TWILIO_ACCOUNT_SID") || !env("TWILIO_AUTH_TOKEN") || !env("TWILIO_FROM")) {
    throw new Error("SMS isn't set up yet: add the TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM secrets (see README, CRM section).");
  }
}

// Resend's batch endpoint takes up to 100 emails per call. Returns one
// result per input, in order.
export async function sendEmailBatch(messages: OutgoingEmail[]): Promise<SendResult[]> {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(messages.map(emailPayload)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = json?.message || json?.error || `Resend HTTP ${res.status}`;
    return messages.map(() => ({ ok: false, error: String(error) }));
  }
  const ids: { id: string }[] = json?.data ?? [];
  return messages.map((_, i) => (ids[i]?.id ? { ok: true, id: ids[i].id } : { ok: false, error: "No id returned by Resend" }));
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const from = env("TWILIO_FROM");
  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service SID (MG...) lets Twilio pick the sender and
  // handle STOP/HELP itself; otherwise it's a plain From number or an
  // alphanumeric sender ID.
  if (from.startsWith("MG")) form.set("MessagingServiceSid", from);
  else form.set("From", from);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: String(json?.message || `Twilio HTTP ${res.status}`) };
  return { ok: true, id: String(json.sid) };
}

// Runs fn over items with at most `limit` in flight at once.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
