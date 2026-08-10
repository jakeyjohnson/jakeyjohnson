# Design Review: Party Padel Website (full site)

Reviewed against: `DESIGN_BRIEF.md` + the `apple-design` skill (motion, materials, typography, reduced-motion)
Philosophy: Brutalist/Raw crossed with Swiss/International Typographic (per `tokens.css` header)
Date: 2026-08-10

## Screenshots Captured

All 9 pages × 3 breakpoints (mobile 375, tablet 768, desktop 1280), scrolled through before capture so `.reveal` scroll-triggered content renders. Stored in `.design/party-padel/screenshots/`.

> **Methodology note:** the site uses `IntersectionObserver` to fade in below-the-fold content (`.reveal` → `.in`). Headless full-page screenshot capture does not scroll the way a real user does, so an initial capture pass showed large false-blank gaps. A second pass explicitly scrolled the page in 200px steps before each capture; this resolved all but the last (`.final-cta`) section on some pages — see Should Fix #4 below, which is a real (if low-risk) finding, not just a screenshot artifact.

## Summary

The build is disciplined and largely brief-accurate — tokens, motion, materials and typography all follow §3/§4/§10/§12 of the brief closely, and the individual-entry ("adapted Americano") product pivot is executed consistently everywhere rather than half-migrated. The two things that actually need fixing before launch are a leftover test fixture that's publicly live and clickable, and a site-wide text-contrast failure on secondary/meta copy that the team's own task list had already flagged as an outstanding accessibility pass.

## Must Fix — all fixed 2026-08-10

1. ~~**A "TEST — REMOVE BEFORE LAUNCH" event is live on the public site.**~~ **Fixed.** `assets/data/events-data.js` shipped a fixture literally titled "Demo City (TEST — remove before launch)" / "Test Venue" inside `window.PARTY_PADEL_EVENTS`, rendering as a real, clickable "GET TICKETS" card on `events.html` and a fixture row on `results.html`, one click from the real registration flow. The `demo-event` object has been removed; verified `events.html`/`results.html` now list only London, Manchester, Bristol.

2. ~~**Secondary/meta text fails WCAG AA contrast, site-wide.**~~ **Fixed.** `--color-text-tertiary` was `rgba(255,255,255,0.38)` (`assets/css/tokens.css`), which over Event Black `#090909` computed to ~3.46:1 — below the 4.5:1 required for normal-size text. It was used in 12 places across every page: footer `<h4>` column headings, footer copyright line, `.form-note`, `.loading-note`/`.empty-note`, `.filter-label`, `.ticket-note`, inactive `.stepper-item`, `.payment-redirect-note`, fixture date labels, and the standings empty-state row. Raised to `rgba(255,255,255,0.5)` (~5.32:1, clears AA with margin) — verified visually on `events.html`/`results.html`, footer and metadata text now reads more clearly.

3. ~~**`DESIGN_BRIEF.md` no longer describes the shipped product.**~~ **Fixed.** Brief §8/§9 specified teams-of-two entry, three divisions (Men's/Women's/Mixed), and "ENTER A TEAM" as the persistent primary CTA, while the live site consistently implements a solo-entry Americano format (Beginners/Advanced) with "GET TICKETS" as the CTA. Added a dated addendum at the top of `DESIGN_BRIEF.md` documenting the individual-entry model as current, rather than editing the client-supplied verbatim brief text in place.

## Should Fix

1. **FAQ accordion has no ARIA state.** `.accordion-trigger` buttons (`event.html` and anywhere else the pattern is reused) toggle visibility via class/inline `max-height` only — no `aria-expanded`, no `aria-controls`, panels lack `role="region"`. Screen reader users get no signal an item is open or closed. (`assets/js/main.js:87-108`)
2. **Mobile menu button isn't wired to its target.** `#burger` has `aria-label`/`aria-expanded` but no `aria-controls="mobileMenu"` pointing at the menu it opens.
3. **Standings table isn't a `<table>`.** `results.html`'s player/P/W/L/Pts grid is built from `<div>` rows (`.standings-header`, `.standings-row`), so a screen reader can't navigate it as tabular data or announce column headers per cell. Fine to keep the "broadcast graphic" visual treatment, just mark it up as a real `<table>` underneath.
4. **The primary CTA on every page is the reveal element most at risk of staying invisible.** `.final-cta` is the last `.reveal` block before the footer. In headless scroll testing it was the one section that intermittently never received `.in` (opacity stays 0) when the page's total scroll distance leaves it just short of the `IntersectionObserver`'s `threshold:0.15`/`rootMargin:-40px` requirement. Real users self-heal this via normal scrolling/overscroll (confirmed — a finer scroll pass resolved it every time), so the real-world risk is low, but it's still gating the single highest-value element on every page behind a non-guaranteed async trigger with no fallback. _Fix: either exempt `.final-cta` from scroll-gating entirely, or add a "force-reveal anything still hidden N seconds after load" safety net._

## Could Improve

1. Homepage covers 6 of the brief's 9 suggested content blocks (§9) — hero, next events, format, divisions, experience, results teaser, final CTA — but doesn't have a distinct "social proof/content wall" section. The experience gallery partially covers this ground; not a gap that needs urgent filling given there's no real photography yet.
2. The nav logo link's alt text is just "Party Padel" (same as every other logo instance) — for the specific case of the linked nav logo, "Party Padel — Home" would read slightly better in a screen reader's link list.

## What Works Well

- **Tokens are disciplined and brief-accurate.** Exact brand hex values, zero gradients/glow/glassmorphism anywhere in `style.css` (checked: no `backdrop-filter`, no colour-tinted `box-shadow`, `radius-full` reserved for chips only per the brief's explicit ban).
- **Contrast is excellent everywhere except the tertiary token above** — acid-on-black and white/grey-on-black combinations measure 17:1 and 10:1+ respectively, well past AAA.
- **Reduced motion is handled properly and consistently**: one blanket CSS override plus matching `prefers-reduced-motion` checks in JS for the scroll counters, reveal system, and cookie banner — nothing animates that shouldn't.
- **Semantic structure is solid**: correct landmark elements on every page, logical heading order, form labels properly associated via `for`/`id`, `aria-current="page"` correctly applied on all 9 pages' nav.
- **The individual-entry pivot is unusually well-executed**: consistent terminology and story ("solo sign-up," "rotating partners," Beginners/Advanced) across every page and the registration flow — nothing half-migrated, which is what makes the brief mismatch (Must Fix #3) worth flagging rather than something to "fix" in the code.
- **Event detail and registration flow are the strongest pages**: broadcast-graphic schedule/availability styling, honest empty states (no fabricated results or partner data), sticky mobile CTA, clean FAQ.
- **Privacy/cookie page is unusually thorough** for a project this size — plain language, accurate, genuinely GDPR-aware rather than boilerplate.
