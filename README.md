# Party Padel

Competitive padel tournament platform — built against the official client brand
guidelines (`.design/party-padel/DESIGN_BRIEF.md`). Static, multi-page site,
no build step, no framework, no backend.

## What's here

| Page | Purpose |
|---|---|
| `index.html` | Homepage — hero, next events, format, divisions, experience, results teaser |
| `events.html` | All events, filterable by status and division |
| `event.html?slug=...` | Single event — registration status, divisions, schedule, tickets, FAQ |
| `enter-team.html` | Post-checkout landing page only — Ticket Tailor's redirect target after payment, not a form |
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
assets/js/events.js      Shared event-data helpers (filter, status labels,
                          checkout links, card rendering) used by
                          events.html, event.html and results.html
assets/data/events-data.js Event data — add a city here, not a new page.
                          Loaded as a plain <script> (window.PARTY_PADEL_EVENTS),
                          not fetch, so pages work opened directly as a file
                          too, not just from a real web server
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

## Adding a new city/event

Add an object to the array in `assets/data/events-data.js` — no HTML changes
needed. Events listing, the homepage teaser (top 3, edit `index.html`
directly since that one's intentionally static), and the event detail page
all read from this file. Status must be one of: `coming-soon`,
`entries-open`, `limited`, `sold-out`, `completed`.

## Taking payment (Ticket Tailor)

There's no entry form on this site at all — every "Enter" button (on
event.html, events.html and the homepage) goes straight to Ticket Tailor's
hosted checkout, one click, no page of ours in between. No card data ever
touches this site or your server, and it works on plain static hosting with
**zero backend code**. Ticket Tailor is purpose-built event ticketing (vs. a
generic payment processor), which is why it's the better fit here — it
collects the buyer's name/email as part of any order, and division +
skill level as ticket types/custom questions on its own checkout page, so
nothing needs asking twice.

To switch payments on for an event:

1. In Ticket Tailor: create the event, then two ticket types, **"Beginners
   Entry"** and **"Advanced Entry"**, each priced to match that event's
   `pricePlayer` — the amount there is what's actually charged. Buying one
   of these IS how someone picks their division now.
2. Add a custom checkout question: **"Skill level (1.0–5.0, self-rated)"**
   — required. This is how skill level reaches you, since the site no
   longer asks for it itself.
3. In the event's checkout settings, set the post-checkout redirect URL to:
   `https://YOURDOMAIN/enter-team.html?confirmed=1` — that page is just a
   generic "you're in, check your email" landing screen now.
4. Copy that event's checkout/Box Office URL into its
   `ticketTailorCheckoutUrl` field in `assets/data/events-data.js`.

Until `ticketTailorCheckoutUrl` is filled in, every "Enter" button for that
event falls back to a "Get Notified" mailto instead of sending people to a
broken link — so it's always safe to publish events ahead of opening
entries.

**Keep `pricePlayer` (the on-site display price) and the ticket price you
set in Ticket Tailor in sync manually** — they're two separate places by
necessity (reading Ticket Tailor's live price back into the page would need
a backend call), so if you change one, change the other.

There's no backend, so there's no database of entries on our side either —
the source of truth for "who paid," and for who's in which division at what
skill level, is entirely the Ticket Tailor dashboard now. The confirmation
page a customer lands on after paying (`enter-team.html?confirmed=1`) is
deliberately generic — Ticket Tailor's own confirmation email is what
carries their actual order details.

Note: Ticket Tailor charges its own per-ticket booking fee on top of card
processing — check their current pricing before launch, it isn't reflected
in `pricePlayer`.

- **Spectator tickets** (`event.html`) — routes to a `mailto:` enquiry until
  a ticketing platform is integrated. Wire it up the same way as player
  entry if you want online spectator sales too.
- **Partner enquiry form** (`partners.html`) — validates and shows a success
  state client-side; doesn't send anywhere yet.
- **Results/standings** — `assets/data/results.json` is intentionally empty.
  The Results page and homepage teaser show an honest "no fixtures played
  yet" state rather than fabricated scores.
- **Partners** — `assets/data/partners.json` is intentionally empty per the
  brief ("never fabricate sponsor logos or partner claims"). The Partners
  page shows a "coming soon" state instead of placeholder logos.

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
Cloudflare Pages, or any web host. Upload everything except `.design/`
(reference docs, not needed at runtime).
