# Build Tasks: Party Padel Platform

Generated from: `.design/party-padel/DESIGN_BRIEF.md`, `INFORMATION_ARCHITECTURE.md`, `tokens.css`
Date: 2026-08-08

Aesthetic direction (established in `tokens.css`, applies to every task below): flat Event Black ground, Party Acid as the only accent, square/near-square corners, hairline court-line geometry as the structural device, no glow/gradient/glassmorphism anywhere, Archivo (display) + Inter (body).

This is a full platform build, not a single session. Tasks are ordered so foundation lands first, then the highest-conversion-priority pages (per brief §9: registration → tickets → partner enquiry), then supporting pages, then cross-cutting states/polish.

## Foundation
- [x] **Design tokens**: colour/type/spacing/radius/line-weight/motion tokens matching brief §3–4, §10, §12 exactly. `assets/css/tokens.css`. _New file._
- [x] **Court-line graphic system**: `.court-frame` corner brackets, `.court-rule` dividers, `.court-grid` background, `#ci-cross` marker. Used on hero, event cards, experience tiles. _New component._
- [x] **Logo integration**: real image assets in place (`assets/img/logo-lockup.webp`, `assets/img/logo-icon-pp.webp` as favicon + compact nav mark). Old skewed/grain-textured CSS wordmark removed entirely. _Modifies: hero, nav, footer._
- [x] **Global shell — nav + footer**: new IA (Events · Play · Format · Results · Partners · About), persistent Enter a Team + conditional Get Tickets, mobile drawer. Solid fill, no blur. _Note: the six nav links and footer's League/Business links point to pages not yet built — see below, currently 404._
- [x] **CTASection**: built as `.final-cta`, reused copy pattern ready for other pages.

## Core UI — registration path first (brief §9 priority order)
- [x] **Homepage** (`index.html`): hero, next-events teaser (3 EventCards demonstrating Entries Open / Limited / Coming Soon states), format teaser, divisions, experience gallery (honestly-labelled placeholders), results teaser (empty state, no fabricated data), follow strip, final CTA, footer. Partner strip omitted per brief §13 — no real partners yet. Tested desktop + mobile, no console errors.
- [ ] **EventCard → shared component + events data layer**: the card markup/CSS exists inline on the homepage; next step is extracting it against `assets/data/events.json` (slug, city, date, venue, status, divisions, price) so Events listing and Event detail both read from one source instead of duplicating markup.
- [ ] **Events listing page** (`events.html`): grid of EventCards, filterable by status/division. _Depends on: events data layer._
- [ ] **Event detail page** (`event.html?slug=`): hero, registration status + spaces remaining, division availability, price, schedule, rules, spectator tickets, FAQ, sticky mobile CTA. _Depends on: EventCard data layer, FAQAccordion._
- [ ] **DivisionCard component**: Men's/Women's/Mixed, availability-aware. Used on Home, Play, Event detail.
- [ ] **Team registration flow** (`enter-team.html`): 4-step stepper — event+division, team+players, payment (stubbed, clearly commented for later Stripe/etc. integration), confirmation with shareable team card. Highest-conversion page on the whole site per brief §9 — build with real interaction states, not a static mock. _New page, multi-step client-side form._
- [ ] **Play page** (`play.html`): divisions overview + entry point into registration. _Depends on: DivisionCard._

## Core UI — supporting pages
- [ ] **FormatSteps component + Format page**: 3–4 visual steps explaining short-format competition, rules, scoring. Condensed version reused on Home.
- [ ] **FixtureBoard + StandingsTable + FinalsBracket components**: broadcast-graphic styling per brief §10, not spreadsheet tables. `assets/data/results.json` schema, keyed by event slug.
- [ ] **Results page** (`results.html`): standings/fixtures/bracket across live events, empty states for pre-event.
- [ ] **ExperienceGallery component**: photography/video grid — sport, DJ, lighting, crowd, feature court. Placeholder assets, clearly labelled for replacement.
- [ ] **Partners page** (`partners.html`): pitch + enquiry form. No fabricated logos or partner claims (brief §13) — `assets/data/partners.json` starts empty, PartnerBand renders nothing until real entries exist.
- [ ] **About page** (`about.html`): brand story, north star ("Serious sport. Social energy."), contact.

## Interactions & States
- [ ] **Event status states**: all 5 statuses styled consistently across EventCard, Event detail, Play. Covers: default, hover, disabled (Sold Out shouldn't invite a click it can't honour).
- [ ] **Registration flow validation**: inline field errors, step-back navigation, stubbed-payment success/failure simulation so the UI is demonstrably complete even without a real processor.
- [ ] **Hover-state audit**: confirm nothing on the site uses glow/box-shadow-bloom — every interactive hover should be line movement, colour inversion, or a flat acid highlight per brief §10.

## Responsive & Polish
- [ ] **Mobile pass**: every new page at 375/768/1024px. Sticky Enter-a-Team CTA on Event detail confirmed reachable one-handed.
- [ ] **Accessibility pass**: WCAG contrast against the exact brand hex values (acid-on-black and black-on-acid both need checking, acid is borderline on contrast at small text sizes), keyboard nav through the registration stepper, visible focus states, `prefers-reduced-motion`, descriptive alt text on all placeholder imagery.

## Review
- [ ] **Design review**: run `/design-review` against the brief once the core pages exist, before considering the platform "done."

---

**Recommended execution order for this session**: Foundation block (tokens ✅, court-line system, logo, nav/footer, CTASection) → Homepage hero, since everything downstream reuses those five pieces and the homepage is the fastest way to validate the whole direction is right before it's replicated across ten more pages.
