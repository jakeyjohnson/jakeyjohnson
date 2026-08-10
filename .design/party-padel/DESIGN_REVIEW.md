# Design Review: Party Padel — Full Site Audit

Reviewed against: Apple design principles (Response, Motion, Materials & depth, Typography, Reduced motion & accessibility, Spatial consistency, Design foundations) + design-review structured critique (hierarchy, consistency, responsiveness, accessibility, token fidelity).
Scope: index.html, about.html, enter-team.html, event.html, events.html, format.html, partners.html, play.html, privacy.html, results.html, assets/css/style.css, assets/css/tokens.css, assets/js/main.js, assets/js/events.js.
Date: 2026-08-10

## Screenshots Captured

All 10 pages at 3 breakpoints (30 screenshots total, `reducedMotion:'reduce'` context used so scroll-reveal content renders in full for accurate capture) in `.design/party-padel/screenshots/`:

| Breakpoint | Width × Height | Suffix |
|---|---|---|
| Mobile | 375×812 | `-mobile-375` |
| Tablet | 768×1024 | `-tablet-768` |
| Desktop | 1280×900 | `-desktop-1280` |

Gesture/drag/swipe guidance skipped per scope — the site has no such interactions.

## Summary

The site is in strong shape: the token system is disciplined, reduced-motion handling is thorough, touch targets meet 44×44px via a hit-slop technique that doesn't compromise the compact chip aesthetic, and the brief's own bans (no bounce easing, no glassmorphism) are honored consistently rather than fought. The one launch-blocking issue is a test data row ("Demo City (TEST — remove before launch)") still live on the events/results pages. The rest of the findings are real but minor: a handful of non-compositor-friendly animated properties, a spacing scale that doesn't share the font-size scale's rem-based accessibility benefit, and a few responsive/legibility rough edges caught in the tablet and mobile passes.

## Must Fix

1. **Test event data live in production**: `assets/data/events-data.js:174` — `"city": "Demo City (TEST — remove before launch)"` renders as a real, clickable "GET TICKETS" card on `events.html`, `event.html`, and `results.html` at every breakpoint (confirmed in `review-events-mobile-375.png` and `review-results-desktop-1280.png`). _Fix: delete the `demo-event` object from `events-data.js` before launch._

## Should Fix

1. **Scroll-progress bar animates a layout property on every scroll tick**: `assets/css/style.css:62-65` sets `width` and `assets/js/main.js:17` writes `progressBar.style.width` on each scroll event — not compositor-friendly, and it's the highest-frequency animation on the site. _Fix: keep the element at `width:100%` and animate `transform: scaleX(pct/100)` with `transform-origin:left` instead._
2. **Mobile menu animates `max-height`**: `assets/css/style.css:145` transitions `max-height` to open/close the panel — triggers layout on every frame. _Fix: animate `transform: scaleY()`/`opacity` on a fixed-height container, or use a `grid-template-rows: 0fr → 1fr` trick._
3. **Accordion panel animates `max-height`**: `assets/css/style.css:558` transitions `max-height`, and `assets/js/main.js:100-106` also sets `panel.style.maxHeight` inline — same non-compositor-friendly pattern, doubled up between CSS and JS. _Fix: same as above; drop the JS-computed inline height once the CSS handles it via `grid-template-rows`._
4. **Mobile stepper overflow has no visual affordance**: `assets/css/style.css:648` sets `.stepper{ overflow-x:auto; }` under `max-width:640px`. Confirmed in `review-enter-team-mobile-375.png` — step "04 Confirmed" is clipped flush at the 375px viewport edge with no fade or partial-peek to signal it's scrollable, so a user can easily miss that a 4th step exists. _Fix: add a right-edge `mask-image` fade (or ensure the next item always peeks ~20px into view) so the scrollability reads visually._
5. **About page's core brand statement rendered as multi-line ALL-CAPS running text**: `assets/css/style.css:641` `.north-star{ text-transform:uppercase; }`. Confirmed at all three breakpoints (`review-about-desktop-1280.png`, `-tablet-768`, `-mobile-375`) — the "North Star" paragraph wraps to 5-8 lines of uppercase text, measurably hurting legibility of the single most important line on the About page. _Fix: drop `text-transform:uppercase`, keep sentence case with the existing tight tracking._
6. **Event grid orphans a card when count isn't a multiple of 3**: `assets/css/style.css:271` `.event-grid{ grid-template-columns: repeat(3,1fr); }`. With 4 live events the 4th card drops to row 2 next to two empty cells (confirmed in `review-events-desktop-1280.png`) — will recur as more cities are added. _Fix: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`._
7. **Spacing scale doesn't share the type scale's accessibility benefit**: `assets/css/tokens.css:71-83` — every spacing token is a fixed px value, while font-size tokens (`tokens.css:98-107`) are rem-based and scale with the user's browser text-size preference. Layout spacing currently won't grow alongside enlarged type. _Fix: convert the spacing scale to rem (e.g. `--space-4: 1rem` instead of `16px`)._
8. **"Skill rating" row wraps awkwardly at tablet width**: `play.html`'s rules-row label wraps to "Skill"/"rating" on two lines while its long value also wraps to two lines. Confirmed in `review-play-tablet-768.png` — visually unbalanced against the single-line rows immediately above and below it (the column-stack fix in `style.css:646-651` only applies at `max-width:640px`, one breakpoint too late). _Fix: raise that breakpoint to ~860px, or add `white-space:nowrap` + a fixed min-width to the row label._

## Could Improve

1. **No `prefers-contrast` media query**: absent anywhere in `style.css`. Lower priority since base contrast ratios already pass WCAG AA comfortably — add only if a high-contrast variant becomes a goal.
2. **Unused spacing tokens**: `assets/css/tokens.css:82-83` — `--space-11` (192px) and `--space-12` (256px) are defined but never referenced anywhere in the codebase. _Suggestion: remove, or use them somewhere intentional._
3. **Icon-size token defined out of place**: `assets/css/style.css:454` `.icon-lg` sits far from its sibling variants (`.icon-xs`/`.icon-sm` etc. around lines 52-59). _Suggestion: move it next to the rest of the icon-size set._
4. **Dead animated-counter code**: `assets/js/main.js:54-73` implements `.stat-num[data-target]` counting via IntersectionObserver, but no current HTML page uses `data-target` anywhere (confirmed via grep). _Suggestion: delete, or wire it up if a stats section is planned._
5. **Inline `style="display:none"` instead of a class**: `enter-team.html:128,156`. Functionally fine, just inconsistent with the class-based show/hide pattern used everywhere else. _Suggestion: swap for a `.hidden{ display:none; }` utility class for consistency._

## What Works Well

- **Motion/Response**: the duration token system is well-graduated and consistently applied — 150ms for hover/color feedback, 250ms for small transforms (nav underline, burger icon), 400ms for larger reveals (mobile menu, cookie banner). Every interactive element gives instant feedback.
- **Design restraint honored, not fought**: no spring/bounce easing and no `backdrop-filter`/glassmorphism anywhere — both are deliberate, brief-mandated choices documented directly in `tokens.css`'s own comments, and correctly respected sitewide rather than "improved away."
- **Reduced motion is thorough**: a global override freezes animation on all elements *and* pseudo-elements, and the View Transitions API addition is correctly gated behind `prefers-reduced-motion: no-preference`. The only continuous animation site-wide (`.status-limited::before`'s 1.8s pulse) is small, subtle, and correctly frozen too — there are no full-viewport moving backgrounds.
- **Touch targets meet 44×44px without compromising the brand's compact aesthetic**: burger and social icons were sized up directly; filter chips stay visually compact but get an invisible `::before` hit-slop for the tap area — a genuinely elegant solve to a real tension in the brief.
- **Form validation is accessible, not just present**: `enter-team.html` and `partners.html` give specific, field-level error text via `aria-live="polite"` regions rather than a single generic banner — confirmed working for empty, invalid, and corrected states.
- **Placeholder content is honest, not accidental**: the homepage's Experience section tiles are unmistakably explained ("Photography placeholder — real event imagery replaces these tiles after the first event"), and the standings preview uses honest em-dash empty states rather than fake data.
- **Spatial consistency holds up without literal modals**: mobile menu, accordion panels, and the cookie banner all open/close via symmetric class-toggle transitions correctly anchored to their trigger element.
