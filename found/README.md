# Found

A subscription app for short films: browse and stream short films, filmmakers
upload their own, subscribers pay $2.99/month through Apple, and non-premium
playback carries ads served by Google Ad Manager.

This lives at `/found` inside the `jakeyjohnson/jakeyjohnson` repo alongside
the unrelated Party Padel site — it's a separate app with its own dependency
tree and its own Supabase project; nothing here touches Party Padel's code or
database.

## Architecture

| Concern | Choice | Why |
|---|---|---|
| App | React Native (Expo) | One codebase for iOS and Android. |
| Subscriptions | RevenueCat + StoreKit/Play Billing | Apple requires purchases to go through StoreKit, not a card form; RevenueCat handles receipt validation, renewals, and cross-platform entitlement state so the app doesn't have to. |
| Video hosting/streaming | Mux | Handles upload, transcoding to adaptive HLS, thumbnails, and playback URLs. This is the "large database to host the films" from the brief — you don't want to store multi-GB video files in Postgres or your own storage bucket; a video-specific service does the encoding work a database can't. |
| App database | Supabase (Postgres) | Stores everything *about* films (title, owner, status, tags) and users, not the video bytes themselves. |
| Ads | Google Ad Manager, via react-native-video's built-in IMA integration | Real, sellable ad inventory in front of/inside films, via Google's ad server — no hand-written native module needed. |

Video never passes through Supabase or any server you run — the app uploads
directly to Mux, and plays back directly from Mux's CDN. Supabase's job is
metadata and auth only.

## Repo layout

```
found/
  App.tsx, index.ts            Entry point
  app.config.ts                 Expo config (reads .env via process.env; enables
                                  react-native-video's IMA ads extension — see "Ads" below)
  src/
    navigation/                 Auth stack vs. app stack, swapped on session state
    screens/                    SignIn, SignUp, Home, FilmDetail, Player, Upload, Profile, Subscription
    components/                 FilmCard, FoundVideoPlayer, SubscriptionGate
    hooks/                      useAuth, useSubscription, useFilms
    lib/                        supabase.ts, mux.ts, revenuecat.ts, ads.ts (ad tag URL builder)
    types/database.ts           Hand-written types matching supabase/schema.sql
  supabase/
    schema.sql                  Run once against a new Supabase project
    functions/
      create-mux-upload/        Creates a films row + Mux direct-upload URL
      mux-webhook/               Advances film status as Mux transcodes it
      revenuecat-webhook/        Mirrors subscription state for backend visibility
```

## Setup

You'll need accounts with: Supabase, Mux, RevenueCat, an Apple Developer
Program membership ($99/yr, required for App Store subscriptions), and a
Google Ad Manager account (or Ad Manager + AdSense for a smaller inventory).

### 1. Supabase

1. Create a new Supabase project — **do not reuse an existing project**, this
   schema is independent of anything else.
2. In the SQL Editor, run `supabase/schema.sql`.
3. Settings → API: copy the Project URL and `anon` public key into `.env`
   (copy `.env.example` first) as `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
4. Deploy the edge functions and set their secrets:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase functions deploy create-mux-upload
   supabase functions deploy mux-webhook --no-verify-jwt
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   supabase secrets set MUX_TOKEN_ID=... MUX_TOKEN_SECRET=... \
     MUX_WEBHOOK_SIGNING_SECRET=... REVENUECAT_WEBHOOK_AUTH_HEADER=...
   ```
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to
   edge functions automatically — no need to set those as secrets yourself.)

### 2. Mux

1. Create a Mux account, then an API Access Token (Standard permission is
   enough) — this becomes `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` above.
2. Settings → Webhooks → add `https://<project-ref>.supabase.co/functions/v1/mux-webhook`,
   copy its signing secret into `MUX_WEBHOOK_SIGNING_SECRET`.

### 3. RevenueCat + Apple subscription

1. In **App Store Connect**, create the app, then under
   Monetization → Subscriptions create a subscription group with one
   auto-renewable subscription product (e.g. `found_monthly`), priced at the
   $2.99/mo tier, with localized display name/description.
2. In **RevenueCat**, create a project, connect the App Store Connect app
   (App-Specific Shared Secret from App Store Connect → your app → App
   Information), and import the `found_monthly` product.
3. Create an **entitlement** called `subscriber` (matches
   `REVENUECAT_ENTITLEMENT_ID` in `.env.example`) and attach the product to
   it.
4. Create an **offering** with a package identifier `$rc_monthly` pointing at
   `found_monthly` — `purchaseMonthlyPackage()` in `src/lib/revenuecat.ts`
   looks up `offerings.current.monthly` specifically.
5. Project settings → API keys: copy the public iOS/Android SDK keys into
   `.env` as `REVENUECAT_API_KEY_IOS` / `_ANDROID`.
6. Project settings → Integrations → Webhooks: point it at
   `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook` with
   an Authorization header value of your choosing — set that same value as
   `REVENUECAT_WEBHOOK_AUTH_HEADER`.
7. Submit the subscription for review as part of your app's first App Store
   submission — Apple reviews the subscription alongside the binary.

### 4. Google Ad Manager

1. Set up an Ad Manager network and an ad unit for in-app video (e.g.
   `/<network-code>/found-preroll`), and a line item / video ad that targets
   it — or use Ad Manager's Open Bidding / AdSense backfill if you don't
   have direct-sold ads yet, so the ad unit always has fill.
2. Put your network code + ad unit path together as `AD_TAG_URL_BASE` /
   `AD_UNIT_PATH` (see `src/screens/PlayerScreen.tsx` — `AD_UNIT_PATH` is a
   placeholder, replace it with your real path).
3. A specific film can override the default tag entirely by setting its
   `ad_tag_url` column (e.g. to run a different campaign against one title).

### 5. Run it

```bash
cd found
npm install
cp .env.example .env   # fill in every value from steps 1-4
npx expo prebuild        # generates ios/ and android/ from app.config.ts + plugins
npx expo run:ios         # or run:android
```

`expo start` alone (Expo Go) will **not** show real ads — see below.

## Ads

Ad insertion uses [react-native-video](https://docs.thewidlarzgroup.com/react-native-video/component/ads)'s
built-in Google IMA integration rather than a hand-rolled native module —
it wraps the real IMA SDK on both iOS and Android, handles requesting the
VAST/VMAP ad break and pausing/resuming content natively, and is maintained
upstream. Wiring it up is two small pieces, both already in place:

- `app.config.ts` passes `["react-native-video", { enableADSExtension: true }]`
  as a plugin, which adds the native IMA SDK dependency during `expo prebuild`.
- `src/components/FoundVideoPlayer.tsx` passes the ad tag as
  `source.ad = { type: "csai", adTagUrl }` and listens for `onReceiveAdEvent`.

This needs a real native build to test (`expo prebuild` + `expo run:ios` /
`run:android`, or an EAS dev client) — Expo Go doesn't include the IMA SDK,
so `adTagUrl` is simply ignored there and content plays without ads rather
than crashing.

`AD_UNIT_PATH` in `src/screens/PlayerScreen.tsx` is a placeholder — replace
it with your real Ad Manager ad unit path from step 4 below. A specific
film can override the ad tag entirely via its `ad_tag_url` column (e.g. to
run a different campaign against one title), and mid-roll breaks are
scheduled the same way via a VMAP response from your ad tag — no extra app
code needed, react-native-video/IMA handles inserting them at the cue
points the VMAP specifies.

If you'd rather not deal with client-side ad requests at all, Google Ad
Manager's **Dynamic Ad Insertion (DAI)** stitches ads server-side into the
HLS stream itself — the client just plays a stitched manifest URL like any
other video. react-native-video's `ad` config supports DAI too
(`type: "dai-vod"` / `"dai-live"`) as a drop-in alternative to the CSAI
config used here.

## What's not built yet

- **Moderation UI.** Uploaded films land in `pending_review` and stay
  invisible to everyone but their owner until something sets `status =
  'approved'`. There's no admin screen for that yet — do it from the
  Supabase dashboard's table editor for now. Worth a dedicated admin app or
  screen once upload volume makes that painful.
- **Search/filtering beyond genre grouping**, **push notifications** for new
  premieres, and **Android Play Billing** testing (the code path is
  identical via RevenueCat, but only iOS/StoreKit has been reasoned through
  here in detail since the ask was Apple subscriptions specifically).
- Real app icon/splash artwork. `assets/icon.png`, `adaptive-icon.png`, and
  `splash.png` exist only as solid dark placeholders so `expo prebuild`
  doesn't fail on a missing file — swap them for real designs before
  building for the App Store.
