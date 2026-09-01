// Mirrors RevenueCat entitlement events into public.subscriptions, purely
// for backend visibility (moderation dashboards, analytics, support). The
// app itself never reads this table to gate playback — it asks the
// RevenueCat SDK directly (see src/hooks/useSubscription.ts) since that's
// authoritative and works offline; this table can lag by the length of the
// webhook delivery.
//
// Register this URL in RevenueCat: Project settings > Integrations >
// Webhooks, with the Authorization header value set below as the secret.
//
// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets: supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER=...
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REVENUECAT_WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STATUS_BY_EVENT: Record<string, string> = {
  INITIAL_PURCHASE: "active",
  RENEWAL: "active",
  UNCANCELLATION: "active",
  PRODUCT_CHANGE: "active",
  CANCELLATION: "cancelled",
  EXPIRATION: "expired",
  BILLING_ISSUE: "billing_issue",
};

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== REVENUECAT_WEBHOOK_AUTH_HEADER) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { event } = await req.json();
  // app_user_id is set to the Supabase auth user id — see
  // configurePurchases() in src/lib/revenuecat.ts, which passes it as
  // RevenueCat's appUserID at SDK init time.
  const userId = event.app_user_id;
  const status = STATUS_BY_EVENT[event.type];

  if (!userId || !status) {
    // Events we don't track a status for (TRANSFER, TEST, etc.) — ack and skip.
    return new Response("ok");
  }

  await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    revenuecat_app_user_id: userId,
    entitlement_id: event.entitlement_ids?.[0] ?? "subscriber",
    status,
    product_id: event.product_id,
    store: event.store?.toLowerCase().includes("play") ? "play_store" : "app_store",
    current_period_expires_at: event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null,
  });

  return new Response("ok");
});
