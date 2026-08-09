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
| `enter-team.html` | 4-step individual registration (event+division → your details+skill level → payment → confirmation) |
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
assets/js/main.js        Nav, mobile menu, scroll-reveal, accordion, counters
assets/js/events.js      Shared event-data helpers (filter, status labels,
                          card rendering) used by events.html, event.html,
                          enter-team.html and results.html
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
directly since that one's intentionally static), the event detail page, and
the registration flow's event picker all read from this file. Status must be
one of: `coming-soon`, `entries-open`, `limited`, `sold-out`, `completed`.

## Taking payment (Ticket Tailor)

The registration flow (`enter-team.html`) collects a player's own details
(name, email, self-rated skill level) on your own branded form, then sends
them to Ticket Tailor's hosted checkout to actually pay, so no card data
ever touches this site or your server. This works on plain static hosting
with **zero backend code**. Ticket Tailor is purpose-built event ticketing
(vs. a generic payment processor), which is why it's the better fit here —
it gives you real per-division capacity limits, box office/reporting, and
check-in tooling on their side if you want to use it, on top of just taking
payment.

To switch payments on for an event:

1. In Ticket Tailor: create the event, then a **"Player Entry"** ticket type
   priced to match that event's `pricePlayer` — the amount there is what's
   actually charged.
2. **Don't** add name/skill-level questions as Ticket Tailor "custom
   questions" — our form already collects those, and asking twice adds
   clicks instead of removing them. Ticket Tailor still needs a buyer name
   + email for the order regardless.
3. In the event's checkout settings, set the post-checkout redirect URL to:
   `https://YOURDOMAIN/enter-team.html?confirmed=1`
4. Copy that event's checkout/Box Office URL into its
   `ticketTailorCheckoutUrl` field in `assets/data/events-data.js`.

Until `ticketTailorCheckoutUrl` is filled in, the form shows a friendly
"payments aren't switched on yet" message instead of sending people to a
broken link — so it's always safe to publish events ahead of opening
entries.

**Keep `pricePlayer` (the on-site display price) and the ticket price you
set in Ticket Tailor in sync manually** — they're two separate places by
necessity (reading Ticket Tailor's live price back into the page would need
a backend call), so if you change one, change the other. Note this price
carried over unchanged from when entry was priced per team rather than per
player — worth deciding whether the number itself should change now that
it's charged per person.

There's no backend, so there's no database of entries on our side either —
the source of truth for "who paid" is the Ticket Tailor dashboard. The
confirmation screen a customer sees after paying is read from their own
browser's local storage (saved right before they left for checkout) —
reliable for the normal case, but if they pay on one device/browser and
land back on another, or clear their browser storage mid-flow, they'll see
a graceful fallback message pointing them to email you instead of a
fabricated confirmation.

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
