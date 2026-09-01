// Creates a `films` row + a Mux direct upload URL for the signed-in user.
// Deploy: supabase functions deploy create-mux-upload
// Secrets: supabase secrets set MUX_TOKEN_ID=... MUX_TOKEN_SECRET=...
import { createClient } from "jsr:@supabase/supabase-js@2";

const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID")!;
const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const muxAuth = "Basic " + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Missing Authorization header", { status: 401 });

  // Verify the caller's JWT and get their user id, using the anon-scoped
  // client so RLS still applies to the identity check itself.
  const supabaseAsUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabaseAsUser.auth.getUser();
  if (userError || !user) return new Response("Unauthorized", { status: 401 });

  const { title, synopsis, genre } = await req.json();
  if (!title || typeof title !== "string") {
    return new Response(JSON.stringify({ error: "title is required" }), { status: 400 });
  }

  // Service-role client so we can insert the films row regardless of RLS
  // nuances, and because the Mux webhook (unauthenticated as a Supabase
  // user) will need the same privileges to update it later.
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: film, error: insertError } = await supabaseAdmin
    .from("films")
    .insert({ owner_id: user.id, title, synopsis, genre, status: "uploading" })
    .select()
    .single();
  if (insertError || !film) {
    return new Response(JSON.stringify({ error: insertError?.message ?? "insert failed" }), { status: 500 });
  }

  const muxResponse = await fetch("https://api.mux.com/video/v1/uploads", {
    method: "POST",
    headers: { Authorization: muxAuth, "Content-Type": "application/json" },
    body: JSON.stringify({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: film.id, // read back in mux-webhook to find this row
      },
    }),
  });

  if (!muxResponse.ok) {
    await supabaseAdmin.from("films").delete().eq("id", film.id);
    const body = await muxResponse.text();
    return new Response(JSON.stringify({ error: `Mux error: ${body}` }), { status: 502 });
  }

  const { data: upload } = await muxResponse.json();

  await supabaseAdmin.from("films").update({ mux_upload_id: upload.id }).eq("id", film.id);

  return new Response(
    JSON.stringify({ uploadUrl: upload.url, uploadId: upload.id, filmId: film.id }),
    { headers: { "Content-Type": "application/json" } }
  );
});
