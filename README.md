# Flair Entertainment Jersey

Marketing site for Flair Entertainment Jersey — built against
`.design/flair-entertainment/DESIGN_BRIEF.md`. Static, multi-page site, no
build step, no framework, no backend.

## What's here

| Page | Purpose |
|---|---|
| `index.html` | Homepage — hero, mission, service pillars, CTA |
| `acts.html` | Speciality Acts & Performers — the full roster, categorised |
| `production-shows.html` | The bespoke Production Show offer, process, use cases |
| `themes.html` | Event theming and the Pop-Up Picnic offering |
| `team.html` | Meet the Team (placeholder structure — see below) |
| `events.html` | Public events listing, honest empty state |
| `contact.html` | Enquiry form, contact details, map |

## Structure

```
assets/css/tokens.css     Design tokens — every colour/type/spacing/radius/
                            motion value used anywhere on the site
assets/css/style.css      Component styles, all referencing tokens.css
assets/js/main.js         Nav drawer, scroll-reveal, hero word-stagger,
                            marquee loop, contact form validation
assets/data/events-data.js  Public events data (empty by design — see
                            "Adding an event" below)
.design/flair-entertainment/DESIGN_BRIEF.md  The brief this was built
                            against, including sourcing and assumptions
```

Run locally with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Important: this was built without access to the live site or brand assets

The current flairentertainment.je site was not reachable from the build
environment, and no logo, brand guideline, photography or team bios were
supplied. Everything here was built from:

- Public facts about the business (roster, location, contact details,
  the Production Shows concept, Themes & Pop-Up Picnics) sourced via web
  search — see `.design/flair-entertainment/DESIGN_BRIEF.md` §1 for the
  full list with sources.
- A deliberately chosen visual direction (Art Deco / Geometric bent
  toward stage & nightlife — gold, black, magenta spotlight accent) since
  no brand guideline existed to build against. See brief §3.
- **No fabricated content**: no invented team member names/bios, no fake
  testimonials, no invented pricing, no stock photography presented as
  real performers. Where real content doesn't exist yet, the site says so
  honestly (see `team.html`'s placeholder cards, `events.html`'s empty
  state) rather than making something up.

**Before launch, replace:**
1. **Real logo** — currently a text wordmark (`.nav__logo`) styled with
   the Fraunces/Big Shoulders type pairing. Drop a real logo file in
   `assets/img/` and swap the `<a class="nav__logo">` markup for an
   `<img>` if the client has one.
2. **Team page** (`team.html`) — swap the four placeholder role cards for
   real names, photos and bios. The `placeholder-note` badges make it
   obvious in-browser that this is pending, so it should not go live
   as-is for long.
3. **Photography/video** — the whole site is currently typography- and
   motion-led with no photography (none could be sourced). Once the
   client supplies real performance photos/video, the hero and act cards
   are the highest-impact places to add full-bleed imagery.
4. **Contact form submit target** — the form in `contact.html` validates
   client-side and shows a success state, but doesn't send anywhere yet
   (no backend on static hosting). Wire it to Formspree, Netlify Forms,
   or similar before launch — see the comment in `assets/js/main.js`.
5. **Canonical URLs** — every page's `<link rel="canonical">` and Open
   Graph `og:url` assume `https://www.flairentertainment.je/`. Update if
   the final domain/subdomain differs.

## Adding a public event

Add an object to the array in `assets/data/events-data.js` — no HTML
changes needed. `events.html` reads this file and renders cards, or an
honest "no events currently listed" state when the array is empty.

## Content honesty rules

Per the design brief: no fabricated named team members, no fabricated
testimonials, no invented pricing (this is a bespoke, quote-based
business), no stock photography presented as the client's own performers.
Where a section would otherwise need placeholder content, it's marked as
such in-browser (`.placeholder-note`) or shown as an honest empty state.

## Editing content

- **Colours/type/spacing/motion**: `assets/css/tokens.css` — nothing else
  should have a hardcoded value.
- **Copy**: written directly in each page's HTML, in the tone defined in
  the brief (§7) — confident, warm, a little theatrical, British English.
- **Roster**: the act categories on `acts.html` map directly to the
  sourced roster in the brief (§1) — extend the `card__tags` list in each
  category as new acts join, rather than adding new categories casually.

## Deploying

Plain static site — deploys anywhere: GitHub Pages, Netlify, Vercel,
Cloudflare Pages, or any web host. Upload everything except `.design/`
(reference docs, not needed at runtime).
