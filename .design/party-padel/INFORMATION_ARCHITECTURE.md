# Information Architecture: Party Padel

Built from `DESIGN_BRIEF.md` §9 (Website Strategy), which already answers most structural questions the IA interview would normally ask. Gaps it doesn't cover — technical routing approach, naming, growth plan — are filled below with a recommended answer, flagged `[assumption]` so they're easy to challenge.

**Technical context:** the existing codebase is a static site — one `index.html` plus `assets/css/style.css` and `assets/js/main.js`, no framework, no build step, no backend. `[assumption]` This IA keeps that approach: separate static HTML pages sharing one stylesheet/token file, with event, fixture and standings *data* externalised into JSON so new cities/results don't require new page code — the brief explicitly requires this ("additional UK cities can be added without redesigning pages"). A framework rewrite (Next.js etc.) would satisfy the brief too, but it's a bigger technical leap than the brief asks for and slower to iterate on in this environment. Registration payment is stubbed client-side (§ Registration Flow below) since there's no backend — flagged clearly as a placeholder, same treatment the current signup form already got.

## Site Map

- Home `/` — `index.html`
- Events `/events` — `events.html` (list, data-driven from `events.json`)
  - Event detail `/events/[city-slug]` — `event.html?slug=london-2026-09-14` (single template, reads `events.json`)
- Play `/play` — `play.html` (divisions, "how to get in", links into registration)
  - Enter a team `/play/enter` — `enter-team.html` (4-step registration flow)
- Format `/format` — `format.html` (how short-format competition works, rules, scoring)
- Results `/results` — `results.html` (standings, fixtures, finals bracket — across all live/recent events)
- Partners `/partners` — `partners.html` (commercial pitch + enquiry; no fabricated logos per brief §13)
- About `/about` — `about.html` (brand story, north star, contact)

Two levels deep, maximum: top-level nav item → one detail page. No third level. This matches the brief's implied simplicity for a sport property (not a sprawling content site).

## Navigation Model

- **Primary navigation:** EVENTS · PLAY · FORMAT · RESULTS · PARTNERS · ABOUT (brief §9, verbatim — six items, at the upper edge of what a primary nav should hold, but fixed by the brief, not negotiable here).
- **Persistent utility CTA:** "ENTER A TEAM" — always visible in the nav, every page, per brief. `[assumption]` Styled as the acid-filled button per §10, sits at the right end of the nav where "Join The Party" used to be.
- **Secondary CTA:** "GET TICKETS" — appears only when at least one event's status is Entries Open/Limited (brief §9). `[assumption]` Renders next to Enter a Team when that condition is true, hidden otherwise — avoids a dead CTA when nothing's on sale.
- **Mobile navigation:** hamburger → full-screen drawer (existing pattern, kept). `[assumption]` Enter a Team stays visible in the collapsed bar even with the hamburger open, since it's the single highest-priority action on the whole site.
- **No secondary/sidebar nav** — each page is a single scroll, consistent with brief's "feel like entering the event, not reading a brochure."

## Content Hierarchy

### Home
1. Hero — logo, next city/date, ENTER A TEAM — the entire reason the page exists.
2. Next events — proof there's something to join *now*.
3. Format — removes "how does this work" hesitation before asking for commitment.
4. Divisions — lets a visitor place themselves (Men's/Women's/Mixed) before registering.
5. The experience — sells the *event*, not just the sport (brief's core differentiator).
6. Results teaser — competitive legitimacy signal.
7. Partner strip — trust signal, but only once real partners exist (§13 — omit entirely until then, don't placeholder it).
8. Content wall — social proof at the point interest has peaked.
9. Final CTA — second, un-missable chance to register.
10. Footer — everything else.

### Event detail
1. City/date/venue hero + status — is this even open to enter.
2. Enter a Team CTA + spaces remaining — urgency, front and center.
3. Division availability — can I actually enter my team.
4. Price.
5. Schedule / rules / venue info — logistics, once intent is confirmed.
6. Spectator tickets — secondary conversion.
7. FAQ — objection handling, last.

### Results
1. Live/most recent standings — the header stat people actually check.
2. Fixture board — what's playing next.
3. Finals bracket — only populated once an event reaches that stage; collapsed/hidden otherwise.

## User Flows

### Enter a Team (primary flow — brief §9)
1. User lands on Home, Events, or an Event detail page.
2. User clicks "Enter a Team" (persistent nav CTA, or in-context on an event card / event detail hero).
   - If a specific event was already in context → flow opens pre-selected to that event.
   - If clicked from nav with no context → flow opens on Step 1 with the event picker active.
3. **Step 1:** choose event (city/date) + division (Men's/Women's/Mixed). Division options filtered to what's actually available for that event.
4. **Step 2:** team name + two player details (name, email — minimum viable, no account creation per brief).
5. **Step 3:** payment. `[assumption]` No real processor wired yet — UI is fully built (card fields, order summary, entry price) but submission is stubbed, same pattern as the current signup form's placeholder submit. Clearly commented in code for whoever wires Stripe/etc. later.
6. **Step 4:** confirmation + shareable team card (image/text summary of team name, division, city, date — sharable to socials). Satisfies brief's "shareable team card."
7. Exit: back to Home or the event's Results/Fixtures once live.

### Spectator ticket (secondary flow)
1. User lands on Home or Events, sees "Entries Open"/"Limited" status.
2. Clicks "Get Tickets" (secondary CTA) or the ticket link on an Event card.
3. Lands on Event detail page, spectator ticket section.
4. `[assumption]` Same stub-payment treatment as team registration — ticket purchase UI is real, processing is placeholder.

### Partner enquiry (tertiary flow)
1. User lands on Partners page (via nav or footer).
2. Reads pitch (audience, experience pillars, integration philosophy — no fake logos).
3. Submits enquiry form (name, company, email, message) — same placeholder-submission pattern as the other forms.

## Naming Conventions

| Concept | Label in UI | Notes |
|---|---|---|
| A city's competition day | "Event" | Not "tournament" (brief explicitly rejects "traditional tournament" positioning) or "party" alone. |
| Signing up to compete | "Enter a Team" | Not "Register," "Sign Up," or "Join" — brief's own CTA language, keep it exact everywhere. |
| Watching, not playing | "Spectator ticket" / "Get Tickets" | Distinguish clearly from team entry pricing. |
| Men's / Women's / Mixed | "Division" | Not "category" or "bracket" (bracket is reserved for the finals bracket component). |
| Live scores/positions | "Standings" | Not "leaderboard" (leaderboard reads gaming, off brand per §7). |
| Upcoming matches | "Fixtures" | British sport terminology, matches brief's British-English requirement. |
| Knockout stage | "Finals" / "Finals bracket" | Not "playoffs" (American). |

## Component Reuse Map

| Component | Used on | Behaviour differences |
|---|---|---|
| Nav + mobile drawer | All pages | "Get Tickets" secondary CTA conditionally shown. |
| EventCard | Home (next events), Events listing | Home shows top 3 only; Events page shows all, filterable by status. |
| DivisionCard | Home, Play, Event detail | Event detail shows live availability count; Home/Play show generic description. |
| FormatSteps | Home, Format page | Home shows condensed 3-step version; Format page shows full 4-step + rules. |
| FixtureBoard | Results, Event detail | Event detail scoped to that event only; Results shows across all live events. |
| StandingsTable | Results, Event detail | Same scoping difference as FixtureBoard. |
| FinalsBracket | Results, Event detail | Hidden/collapsed until an event reaches finals stage. |
| CTASection (Enter a Team banner) | Home, Format, Play, Results | Copy varies slightly by page context; component and styling identical. |
| FAQAccordion | Event detail, Play | Different question sets per context. |
| Footer | All pages | Identical everywhere. |

## Content Growth Plan

- **Events:** stored in `assets/data/events.json`. Adding a city = adding a JSON entry with a unique slug; `events.html` and `event.html` render from it, no new page code. Statuses (`coming-soon` / `entries-open` / `limited` / `sold-out` / `completed`) drive card styling and CTA state automatically.
- **Results:** `assets/data/results.json`, keyed by event slug — standings/fixtures/bracket data per event. Populated progressively as an event runs; empty/placeholder states defined for pre-event.
- **Partners:** `assets/data/partners.json`, starts empty. Partner strip component queries it and renders nothing until entries exist — never fabricated (brief §13).
- **Past events:** once an event's date passes and results are final, it moves from "next events" to an implicit archive (filtered view of `events.json` by status/date) rather than a separate archive page — keeps the IA flat.

## URL Strategy

- Pattern: flat, one level under each top-level section — `/section` or `/section/detail-slug`. No deeper nesting.
- Dynamic segment: event detail uses a `slug` query parameter (`event.html?slug=london-2026-09-14`) rather than a path segment, since this is a static host with no server-side routing. `[assumption]` If this later moves to a platform with real routing (Vercel/Netlify rewrites, or a framework), this becomes a clean path segment (`/events/london-2026-09-14`) with no change to the IA itself.
- Slug format: `{city-slug}-{yyyy-mm-dd}`, lowercase-hyphenated — human-readable, sortable, unique without a database.
- Query params reserved for filtering only: `events.html?status=entries-open`, `events.html?division=mixed` — never used for content that should be indexable/shareable as its own page.
