# Party Padel

Competitive padel tournament platform — built against the official client brand
guidelines (`.design/party-padel/DESIGN_BRIEF.md`). Static, multi-page site,
no build step, no framework — the only backend is Supabase, used purely as a
database + login for the admin panel (`admin.html`); everything else is
still plain HTML/CSS/JS you deploy by uploading files.

## What's here

| Page | Purpose |
|---|---|
| `index.html` | Homepage — hero, next events, format, divisions, experience, results teaser |
| `events.html` | All events, filterable by status |
| `event.html?slug=...` | Single event — registration status, divisions, schedule, tickets, FAQ |
| `enter-team.html` | Post-checkout landing page only — Ticket Tailor's redirect target after payment, not a form |
| `admin.html` | Back office — log in, add/edit/delete events. See "Back office" below. |
| `format.html` | How the competition works, rules and scoring |
| `play.html` | Divisions overview and entry requirements |
| `results.html` | Standings and fixtures |
| `partners.html` | Commercial pitch and enquiry form |
| `about.html` | Brand story and north star |

## Structure

```
assets/css/tokens.css   Design tokens — every colour/type/spacing/radius/
                          line-weight value used anywhere on the site
assets/css/style.css     Component styles, all referencing tokens.css
assets/js/main.js        Nav, mobile menu, scroll-reveal, accordion
assets/js/events.js      Shared event-data helpers (loads events from
                          Supabase, filter/status labels, checkout links,
                          HTML-escaping, card rendering) — used by
                          events.html, event.html, index.html, results.html
                          and admin.html
assets/js/supabase-config.js  Your Supabase project URL + anon key. Ships to
                          every browser — that's expected, see "Back office"
assets/js/supabase-client.js  Turns the config above into window.PartyPadelDB
supabase/schema.sql      Run once in the Supabase SQL Editor — creates the
                          events table, security policies, and seeds the 3
                          events this site originally launched with
assets/data/results.json Standings/fixtures, keyed by event slug (empty
                          until the first event happens — see below)
assets/data/partners.json Confirmed partners only — empty by design
assets/img/              Logo assets (WebP) + brand moodboard reference
.design/party-padel/      DESIGN_BRIEF.md, INFORMATION_ARCHITECTURE.md,
                          TASKS.md — the brief this was built against and
                          what's left to do
```

Run locally with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Event data is a real network call to Supabase now, not a bundled file, so
`assets/js/supabase-config.js` needs real values even for local development
— see "Back office" below. (This does mean the old "works opened directly
as a `file://` URL" property is gone; a static file server like the one
above, or any real host, is required now.)

## Managing events

All event content — cities, dates, status, leagues, running order, the
Ticket Tailor checkout link — is edited through **`admin.html`**, not by
touching HTML or JS files. See "Back office" below to set that up. Once it's
running, every page that lists or shows events (`index.html`, `events.html`,
`event.html`, `results.html`) reflects changes immediately, with no
redeploy needed.

## Taking payment (Ticket Tailor)

There's no entry *form* on this site — every "Enter" button (on event.html,
events.html and the homepage) goes straight to Ticket Tailor's hosted
checkout, one click, no page of ours in between. No card data ever touches
this site or your server. Ticket Tailor is purpose-built event ticketing
(vs. a generic payment processor), which is why it's the better fit here —
it collects the buyer's name/email as part of any order, and league +
whatever else you need as ticket types/custom questions on its own checkout
page, so nothing needs asking twice.

To switch payments on for an event:

1. In Ticket Tailor: create the event, then **one ticket type per league**
   you've defined for it in `admin.html` — name them to match (e.g. a
   "Beginners" league in admin.html gets a "Beginners Entry" ticket type),
   each priced to match that event's price-per-player. Buying one of these
   IS how someone picks their league now.
2. If a league's requirements need verifying at checkout (a skill level to
   self-report, proof of age, whatever that league calls for), add it as a
   custom checkout question — required or not, your call. This is how that
   detail reaches you, since the site itself only ever asked for it as free
   text on the public event page, not collected it.
3. In the event's checkout settings, set the post-checkout redirect URL to:
   `https://YOURDOMAIN/enter-team.html?confirmed=1` — that page is just a
   generic "you're in, check your email" landing screen now.
4. Paste that event's checkout/Box Office URL into its **"Ticket Tailor
   checkout URL"** field in `admin.html`, then save.

Until that field is filled in, every "Enter" button for that event falls
back to a "Get Notified" mailto instead of sending people to a broken link
— so it's always safe to publish events ahead of opening entries.

**Keep the on-site display price (set in `admin.html`) and the ticket price
you set in Ticket Tailor in sync manually** — they're two separate places
by necessity (reading Ticket Tailor's live price back into the page would
need a backend call to Ticket Tailor's API, which this site doesn't make),
so if you change one, change the other.

Supabase only stores what's needed to *display* an event and where to send
someone to pay for it — there's still no database of entries anywhere on
our side. The source of truth for "who paid," and for who's in which
league, is entirely the Ticket Tailor dashboard. The confirmation page a
customer lands on after paying (`enter-team.html?confirmed=1`) is
deliberately generic — Ticket Tailor's
own confirmation email is what carries their actual order details.

Note: Ticket Tailor charges its own per-ticket booking fee on top of card
processing — check their current pricing before launch, it isn't reflected
in the price shown on-site.

- **Spectator tickets** (`event.html`) — routes to a `mailto:` enquiry until
  a ticketing platform is integrated. Wire it up the same way as player
  entry if you want online spectator sales too.
- **Partner enquiry form** (`partners.html`) — validates and shows a success
  state client-side; doesn't send anywhere yet.
- **Results/standings** — real, live data from Supabase's `fixtures` table,
  managed from `admin.html`. See "Fixtures & live scores" under "Back
  office" below. Until any fixtures are entered for an event, `results.html`
  shows an honest "no fixtures played yet" state rather than fabricated
  scores.
- **Partners** — `assets/data/partners.json` is intentionally empty per the
  brief ("never fabricate sponsor logos or partner claims"). The Partners
  page shows a "coming soon" state instead of placeholder logos.

## Back office (Supabase + admin.html)

Events used to live in a static JS file only a developer could edit; now
they live in a small Supabase database, and `admin.html` is a real login +
event editor for anyone without file/FTP access. One-time setup:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) —
   free tier is plenty for this. Note its **Project URL** and **anon public
   key** from Project Settings > API; you'll need both shortly.
2. **Run the schema**: Supabase Dashboard > SQL Editor > New query, paste
   in the entire contents of `supabase/schema.sql`, and run it. This
   creates the `events` table, locks it down with row-level security
   (anyone can read events; only a logged-in user can add/edit/delete
   them), and seeds it with the 3 events this site originally launched
   with, so nothing is lost in the migration off the old static file.
3. **Create your login**: Authentication > Users > Add user — email +
   password, whatever you want to sign in with at `admin.html`. There is
   no sign-up form anywhere on the site; this is the only way an account
   gets created.
4. **Turn off public sign-up**: Authentication > Providers > Email, disable
   "Allow new users to sign up." This matters because the anon key from
   step 1 is meant to be public — it ships in this site's source to every
   visitor's browser, same as any client-side API key — and the write
   policies in `schema.sql` only check "is someone logged in," not "is it
   specifically you." Turning off sign-up is what actually keeps that
   narrow to the account you made in step 3, since nobody else can create
   one to log in with.
5. **Fill in `assets/js/supabase-config.js`** with the Project URL and anon
   key from step 1, then upload it (along with the rest of the site) via
   FileZilla as usual.
6. Visit `https://YOURDOMAIN/admin.html`, sign in, and you're managing live
   events — no redeploy needed for content changes from here on.

`admin.html` is excluded from the sitemap and blocked in `robots.txt`, and
carries a `noindex` tag, so it shouldn't show up in search — but none of
that is real access control, only the Supabase login is. Don't rely on the
URL being obscure.

Each event can have up to 6 **leagues** — a free-text name and free-text
requirements (not tied to any fixed skill scale, so "Self-rated 3.0–5.0",
"Women only" and "Under 18s" are all valid) plus a spaces-left count that
drives the "Full" vs "X spaces left" status shown on-site. An event needs
at least one to be enterable at all.

### Fixtures & live scores (Americano)

Party Padel plays Americano: players rotate partners every round instead of
staying in one fixed pair all night, and the leaderboard is each player's
own points added up across every round they played — not a team win/loss
table. Click **Fixtures** on an event's row in `admin.html` to run this.
Same login as everything else in the back office.

**1. Add players**, one league at a time (tabs at the top — only leagues
that event actually has):
- Paste real names, one per line, into the text box and **+ Add Names
  Above**, and/or
- Set a number (max 50 per click) and **+ Add Placeholder Players** for a
  quick "Player 1, Player 2…" roster — handy before you know exactly
  who's turned up, or for trying the schedule out.
- Rename anyone at any time by editing their name directly in the list —
  it saves on its own and updates everywhere they appear, without touching
  the schedule itself.
- Added the wrong number, or want to start a league's roster over?
  **Remove All Players** (next to the player count, once there's at
  least one) clears the whole list in one click — no need to delete
  rows one at a time. This also removes that league's fixtures, since a
  fixture can't outlive the players in it.

**2. Generate the schedule**: set **Courts available** and **Games per
player** — how many matches you want each person to get, not a round
count — then **Generate Fixtures**. It works out how many rounds that
actually needs from the court count, then builds who plays with/against
whom, round by round, automatically — nobody has to hand-build a fixture
list or do the maths on rounds themselves. It keeps every player within
one game of everyone else's total (so if the numbers don't divide evenly
— say 50 players on 6 courts asked for 4 games each — some will get 4 and
some 5, never a bigger gap than that), and spreads partners/opponents
around rather than repeating the same pairing over and over. Regenerating
replaces whatever schedule (and scores) that league already had — there's
a confirm prompt.

**3. Enter scores as matches happen**: under each Round heading, type a
score into either side of a match, or change its status
(Scheduled/Live/Completed) — it saves the moment you tab or click away, no
separate save button, with a small "Saved" note to confirm. The individual
leaderboard above recalculates itself live as scores come in.

`results.html` shows that same leaderboard and round-by-round match list to
the public, updating within a second or two of you saving a score — it's
subscribed to Supabase's realtime feed for the `fixtures` table, not a
polling refresh. If that feed is ever unreachable (a strict network, or the
table not yet added to the project's realtime publication —
`supabase/schema.sql` handles that automatically) it just falls back to
"reload the page to see the latest," rather than breaking.

Removing a player removes any fixture they're part of too (there's a
confirm prompt) — there's no archive/undo, same as deleting an event.

`supabase/schema.sql` also seeds a working example: Manchester's Beginners
league ships with 50 placeholder players ("Player 1"…"Player 50") and an
already-generated schedule (6 courts, 4 games per player — works out to 9
rounds), so there's something real to look at in `admin.html` and
`results.html` without setting anything up first.

### Shorter admin URL

`partypadel.uk/admin` works as well as `partypadel.uk/admin.html` — no
hosting setup, no DNS. `admin/index.html` is a one-line redirect to the
real `admin.html`, so there's still only one copy of the actual panel to
keep in sync; typing the shorter URL just bounces straight to it. Same
`noindex` treatment as `admin.html` itself, via `robots.txt`.

### Event Manager (fixtures &amp; scores page)

`eventmanager.html` (also reachable at `partypadel.uk/eventmanager`, same
redirect trick as `/admin`) is a cut-down version of the back office for
whoever's running the room on the day: pick an event, pick a league, then
everything needed to fix things on the fly — players, the fixture
schedule, and scores. What it leaves out is the actual **event record**:
city, venue, date/time, price, ticket link and the league list itself
stay admin-only, on `admin.html`. The idea is that a day-of problem
("wrong name", "someone dropped out", "the schedule's wrong") shouldn't
need the person running the room to touch anything that affects ticket
sales or the public event page.

It uses the **same login** as `admin.html` — there's still only one
Supabase Auth account for this site, so anyone signed in to one panel
could just as easily open the other in a new tab. That's a genuinely
lighter-weight setup than a second account with its own restricted
permissions would be, and it's the right call if you trust whoever's
running the room with the login itself — you're just handing them a
focused screen instead of the full admin panel. If a future event manager
needs to be kept out of the admin panel (and out of players/fixtures on
events they're not running) even with the credentials in hand — a hired
contractor, say, not someone you'd hand full access to — that needs an
actual second login with its own database permissions, which is a bigger
change — ask for that specifically if it comes up.

## Editing content

- **Colours/type/spacing**: `assets/css/tokens.css` — nothing else should
  have a hardcoded value.
- **Copy**: written directly in each page's HTML, in the tone defined in
  the brief (§7) — short, direct, British English, no forced slang.
- **Logo**: `assets/img/logo-lockup.webp` (full wordmark) and
  `assets/img/logo-icon-pp.webp` (PP mark, used as favicon and compact nav
  logo) are the client-supplied assets. Swap the files directly if a
  vector/updated version is supplied later — nothing recreates the
  lettering in CSS.

## Deploying

Plain static site — deploys anywhere: GitHub Pages, Netlify, Vercel,
Cloudflare Pages, or any web host. Upload everything except `.design/` and
`supabase/` (reference docs and setup SQL — neither is needed at runtime,
`supabase/schema.sql` only ever gets pasted into the Supabase SQL Editor
once, per "Back office" above).
