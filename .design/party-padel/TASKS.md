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
- [x] **Homepage** (`index.html`): hero, next-events teaser (3 EventCards demonstrating Entries Open / Limited / Coming Soon states), format teaser, divisions, experience gallery (honestly-labelled placeholders), results teaser (empty state, no fabricated data), follow strip, final CTA, footer. Partner strip omitted per brief §13 — no real partners yet.
- [x] **Events data layer**: `assets/data/events.json` (3 events covering all non-terminal statuses), `assets/js/events.js` shared helpers (load, filter, status metadata, card renderer, query-param parsing). `assets/data/results.json` and `assets/data/partners.json` also created, intentionally empty per brief §13.
- [x] **Events listing page** (`events.html`): grid rendered from `events.json`, live status + division filter chips, empty state when a filter combination matches nothing.
- [x] **Event detail page** (`event.html?slug=`): hero, division availability, running-order schedule, spectator ticket box, FAQ accordion, sticky mobile CTA — all rendered from the `slug` query param against `events.json`. Handles unknown slug gracefully.
- [x] **DivisionCard component**: built and reused on Homepage, Play, and Event detail (availability-aware there, generic on Home/Play).
- [x] **Team registration flow** (`enter-team.html`): 4-step stepper (event+division → team+players → payment → confirmation), full validation per step, pre-fills event from `?event=` query param, order summary, stubbed payment clearly commented for Stripe/etc., shareable team-card confirmation screen with copy-link. Tested end-to-end.
- [x] **Play page** (`play.html`): division grid + entry requirements + CTA into registration.

## Core UI — supporting pages
- [x] **Format page** (`format.html`): full 4-step FormatSteps + rules/scoring table.
- [x] **Results page** (`results.html`): standings preview (honest empty state) + fixtures list rendered live from `events.json`.
- [x] **Experience gallery**: built on Homepage as honestly-labelled placeholder tiles with court-frame corners.
- [x] **Partners page** (`partners.html`): pitch (audience/categories/approach), explicit "no partners yet" section, working enquiry form (stubbed submit, validated, success state).
- [x] **About page** (`about.html`): brand foundation copy, positioning, north star statement, contact.

## Interactions & States
- [x] **Event status states**: Entries Open / Limited / Coming Soon / Sold Out / Completed all styled and wired through `events.js` — used consistently on Homepage, Events listing, Event detail, Results.
- [x] **Registration flow validation**: inline field + email-format errors per step, back/forward navigation preserves entered data, stubbed-payment loading state before confirmation.
- [x] **Hover-state audit**: confirmed no glow/box-shadow-bloom anywhere in `style.css` — hovers are border-colour change, background-colour change, or underline-width animation only.

## Responsive & Polish
- [x] **Mobile pass**: every page checked at 375–390px — nav drawer, filter chips, stepper, ticket box, form grids all reflow correctly. Sticky Enter-a-Team bar confirmed on Event detail (hides once the in-page CTA scrolls into view, shows once it scrolls past).
- [ ] **Accessibility pass**: focus-visible states and reduced-motion are in from the token system, but a dedicated WCAG contrast check (acid-on-black and black-on-acid at small text sizes) and full keyboard-nav sweep of the registration stepper haven't been run yet.

## Review
- [ ] **Design review**: run `/design-review` against the brief now that the core pages exist.

---

**Status**: every page in the brief's primary nav (Events, Play, Format, Results, Partners, About) plus Home, Event detail and the full team-registration flow are built and tested — no 404s left in the nav. Remaining: formal accessibility/contrast pass, and `/design-review`. Results/standings and the finals bracket stay in their honest empty state until a real event has been played, by design.
