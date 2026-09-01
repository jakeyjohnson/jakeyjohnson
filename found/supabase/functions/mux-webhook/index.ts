// Receives Mux webhook events and advances a film's status as its asset is
// transcoded. Register this URL (https://<project>.supabase.co/functions/v1/mux-webhook)
// in the Mux dashboard under Settings > Webhooks, subscribed to
// video.asset.ready, video.asset.errored, and video.upload.asset_created.
//
// Deploy: supabase functions deploy mux-webhook --no-verify-jwt
//   (--no-verify-jwt because Mux, not a signed-in user, calls this endpoint;
//   the Mux signature check below is what authenticates the request instead)
// Secrets: supabase secrets set MUX_WEBHOOK_SIGNING_SECRET=...
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_WEBHOOK_SIGNING_SECRET = Deno.env.get("MUX_WEBHOOK_SIGNING_SECRET")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyMuxSignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get("mux-signature");
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MUX_WEBHOOK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();

  if (!(await verifyMuxSignature(req, rawBody))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const asset = event.data;

  switch (event.type) {
    case "video.upload.asset_created": {
      // `asset` here is Mux's Upload object: `id` is the upload id we stored
      // as mux_upload_id when creating it, `asset_id` is the newly created asset.
      await supabaseAdmin
        .from("films")
        .update({ status: "processing", mux_asset_id: asset.asset_id })
        .eq("mux_upload_id", asset.id);
      break;
    }
    case "video.asset.ready": {
      const playbackId = asset.playback_ids?.[0]?.id;
      const filmId = asset.passthrough;
      await supabaseAdmin
        .from("films")
        .update({
          status: "pending_review",
          mux_asset_id: asset.id,
          mux_playback_id: playbackId,
          duration_seconds: asset.duration ? Math.round(asset.duration) : null,
          thumbnail_url: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null,
        })
        .eq("id", filmId);
      break;
    }
    case "video.asset.errored": {
      const filmId = asset.passthrough;
      await supabaseAdmin
        .from("films")
        .update({ status: "rejected", rejection_reason: "Video processing failed" })
        .eq("id", filmId);
      break;
    }
    default:
      break;
  }

  return new Response("ok");
});
