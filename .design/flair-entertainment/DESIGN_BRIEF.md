# Flair Entertainment — Design Brief

## 0. Status of this brief

No client-supplied brand guideline document was available to build against.
This brief is assembled from public facts about the real business (search
results — the live flairentertainment.je site itself is not reachable from
this environment) plus deliberate creative decisions to fill the gap. Every
fact below is sourced; every creative decision is marked **[assumption]** and
is a starting point for the client to confirm or redirect, not a claim about
what the business already looks like.

## 1. The business (sourced facts)

- **Name**: Flair Entertainment Jersey
- **Location**: Hill Street, St. Helier, Jersey, Channel Islands
- **Contact**: +44 7829 953337 · Info@flairentertainment.je
- **Instagram**: @flairentertainment
- **What they do**: Book and produce entertainment for private, corporate
  and public events — weddings, galas, product launches, parties — working
  with both Jersey-based and UK/EU performers.
- **Roster**: interactive dancers, neon dancers, mirror dancers, burlesque
  dancers, wing dancers, LED ballerinas; circus performers, fire breathers,
  aerialists; roller skaters; magicians; drag performers; stilt walkers;
  musicians and DJs.
- **Signature offer**: bespoke "Production Shows" — multi-skilled shows
  combining fire, aerial, dance, roller-skating and live music into one
  choreographed piece, built to the client's brief rather than booked
  off-the-shelf.
- **Also offer**: themed event styling and "Pop-Up Picnics."
- **Stated mission** (from search summary): offer the finest entertainment
  experiences in Jersey, raise the standard, and empower local performers.

## 2. Who this site is for

Two audiences, one site:
1. **Event organisers / private clients** (wedding planners, corporate
   events leads, private hosts) — need to quickly grasp "what kind of thing
   can I book," see the range and quality, and enquire with minimal friction.
2. **Performers** — may look for how to be booked/represented (secondary,
   handled via the contact route, not a dedicated portal for v1).

Primary conversion goal: **enquiry** (contact form / call / email / WhatsApp),
not e-commerce. No prices are published (bespoke, quote-based business —
never fabricate a price list).

## 3. Aesthetic direction

**Named philosophy: Art Deco / Geometric**, deliberately bent toward stage
and nightlife energy — closest match for a company whose literal name is
"Flair" and whose product is staged glamour (production shows, galas,
cabaret-adjacent acts). Pure Art Deco (gold/navy/burgundy, hushed) reads too
static for a company selling fire, LED, and live performance energy, so:

- **[assumption]** Base the deco discipline (symmetry, geometric ornament,
  metallic accent, display type at hero scale) but swap the second accent
  from navy/burgundy to a hot **spotlight magenta**, justified by the neon/
  LED/fire acts in the actual roster — one motif ("spotlight") ties the
  static gold-on-black elegance to the live-performance energy without
  turning the whole site into a nightclub flyer (that failure mode is
  called out below).
- The site should feel like walking into a **dark venue right before a
  show starts**: black ground, a single warm gold structural accent
  (frames, rules, borders — the "production value" signal), and magenta
  used sparingly as the "the show is about to start" spotlight/glow —
  never as a background colour.
- **Reject**: generic party-flyer clichés (rainbow gradients, comic sans-
  adjacent script fonts, confetti PNGs, stock photos of anonymous crowds).
  Flair sells production quality — the site's own craft is the proof.

### Typography
- Display: a tall geometric/deco display face for headlines — **Bodoni
  Moda** (or **Fraunces** at a high-contrast axis) for the editorial-glam
  serif moments, paired with **Big Shoulders Display** (condensed
  geometric, genuinely deco-flavoured, free on Google Fonts) for all-caps
  eyebrow labels and stat/number treatments. **[assumption]**
- Body: **Manrope** — geometric-leaning grotesk, quiet enough not to
  compete with the display pairing, comfortable at small sizes.
- All-caps labels get wide letter-spacing (deco convention). Headlines are
  set BIG — this is a show business site, restraint is not the brief.

### Colour
- Event-night black ground (`#0A0908`, warm-black not cool-black — avoids
  the "tech SaaS dark mode" read).
- Gold structural accent (`#C9A45C`, muted "old brass" gold, not
  Comic-Sans-yellow-gold) for rules, borders, icon strokes, key CTAs.
- Spotlight magenta (`#E23B8B`) used only for: hover glows, the "live/on
  now" motif, and small high-energy accents (max ~5% of any viewport).
- Off-white text (`#F5F1E8`, warm ivory not pure white — ties to the gold).
- No photography assumed available (none could be sourced) — the visual
  system leans on typography, geometric ornament (sunburst/chevron motifs,
  used sparingly), gradients-as-spotlights, and motion instead of images.
  This is a deliberate choice, not a placeholder: [assumption] flagged so
  the client can supply real performance photography/video later, at which
  point hero sections should upgrade to full-bleed imagery.

### Motion (this is a stated requirement — "make animations")
- Hero: a slow sweeping spotlight/gradient across the dark ground,
  staggered headline reveal (deco-style: elements arrive from
  the edges toward centre, echoing symmetrical ornament).
  `prefers-reduced-motion` disables all of it to a static state.
- Scroll-reveal on section entry (fade + rise, 500–700ms, deco-appropriate
  restraint — not bouncy).
- Hover states on act/service cards: gold border sweeps in, a soft magenta
  glow lifts the card — the "spotlight hits you" moment, used as the
  primary interactive delight across the site.
- A marquee/ticker strip of act names (dancers · fire · aerial · DJs ·
  magicians · live music …) scrolling continuously — cheap to build,
  reads immediately as "we do a lot of things," reinforces the roster
  breadth on every page it appears.

### Layout
- Symmetrical, centred hero compositions (deco convention).
- Card grids for acts/services broken by an occasional full-width
  "statement" band (quote, stat, CTA) — keeps a long roster from reading
  as a flat directory.
- Max content width ~1200px, generous horizontal padding on mobile.

## 4. Information architecture

- `index.html` — Home
- `acts.html` — Speciality Acts & Performers (the roster, categorised)
- `production-shows.html` — Production Shows (the signature bespoke offer)
- `themes.html` — Themes & Pop-Up Picnics
- `team.html` — Meet the Team
- `events.html` — Upcoming Events (public-facing events, if any — honest
  empty state when none scheduled, same principle as "never fabricate")
- `contact.html` — Contact / enquiry

## 5. Content honesty rules (non-negotiable, matches this repo's existing
   convention on other projects)

- No fabricated named team members with invented bios/headshots as if
  real. `team.html` ships with a clearly-structured template and
  **[Client to confirm]** placeholders instead — never a fictional "Sarah,
  Founder" presented as fact.
- No fabricated testimonials/quotes attributed to named clients.
- No invented pricing.
- No stock photography presented as if it were Flair's own performers.
- `events.html` shows an honest "no public events currently listed" state
  by default, backed by a small data file the client can extend.

## 6. SEO requirements

- Unique, keyword-considered `<title>`/meta description per page (Jersey
  entertainment agency, wedding entertainment Jersey, corporate event
  entertainment Jersey, fire performers/aerialists/dancers Jersey, etc. —
  grounded in the real roster, not stuffed).
- Open Graph + Twitter Card tags per page.
- `LocalBusiness`/`EntertainmentBusiness` + `Organization` JSON-LD on the
  homepage with real address/phone/email/sameAs (Instagram); relevant
  structured data (breadcrumbs) on inner pages.
- Semantic heading hierarchy, descriptive link text, alt text on all
  meaningful imagery/icons.
- `sitemap.xml` + `robots.txt`.
- Fast, dependency-free static HTML/CSS/JS — no framework tax, good Core
  Web Vitals by construction.

## 7. Tone of voice

Confident, warm, a little theatrical — this is a company selling wonder.
British English. Short, punchy headline copy; slightly more expansive body
copy that still moves quickly. Avoid corporate-agency blandness ("we
provide a range of solutions") — say the specific, vivid thing ("fire
breathers, aerialists, LED ballerinas, and a DJ who won't let the room sit
down").
