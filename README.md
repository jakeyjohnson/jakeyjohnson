# Party Padel

Competitive padel league platform — built against the official client brand
guidelines (`.design/party-padel/DESIGN_BRIEF.md`). Static, multi-page site,
no build step, no framework, no backend.

## What's here

| Page | Purpose |
|---|---|
| `index.html` | Homepage — hero, next events, format, divisions, experience, results teaser |
| `events.html` | All events, filterable by status and division |
| `event.html?slug=...` | Single event — registration status, divisions, schedule, tickets, FAQ |
| `enter-team.html` | 4-step team registration (event+division → team+players → payment → confirmation) |
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
assets/js/events.js      Shared event-data helpers (fetch, filter, status
                          labels, card rendering) used by events.html,
                          event.html and enter-team.html
assets/data/events.json  Event data — add a city here, not a new page
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

Add an entry to `assets/data/events.json` — no HTML changes needed. Events
listing, the homepage teaser (top 3, edit `index.html` directly since that
one's intentionally static), the event detail page, and the registration
flow's event picker all read from this file. Status must be one of:
`coming-soon`, `entries-open`, `limited`, `sold-out`, `completed`.

## What's stubbed, not wired

Nothing here fabricates data or fakes a working backend — every stubbed
piece is commented in the code and safe to ship as-is until it's wired up:

- **Team registration payment** (`enter-team.html`) — the full 4-step flow,
  validation, and order summary are real; the payment step doesn't call a
  real processor. Look for the `NOTE:` comment in the inline script.
- **Spectator tickets** (`event.html`) — routes to a `mailto:` enquiry until
  a ticketing platform is integrated.
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
