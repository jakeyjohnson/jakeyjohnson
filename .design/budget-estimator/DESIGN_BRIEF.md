# Design Brief: Jake's Budget Estimator

## Problem

Before a proposal, a project even gets a real number attached to it, whoever
is scoping a luxury pop-up or storefront build — a Carnaby Street activation
for a fashion house, a flagship fit-out, a brand installation — has to
mentally assemble a budget from memory: rough build cost per square metre,
design fees, permits, install crew, contingency. It's easy to forget a
category entirely (insurance, de-rig, storage) and easy to under-quote
because the "hidden" line items (site logistics, PM time, contingency) don't
come to mind as fast as "build the thing" does. There's no fast way to
sanity-check "is this a £60k pop-up or a £600k flagship?" before a proper
quote gets built.

## Solution

A single-page calculator: describe the project (type, size, duration,
location, finish tier, extras), hit calculate, and get an instant itemised
budget estimate — grouped into the four categories that actually matter for
these builds (Design & Concept, Fabrication & Materials, Site & Logistics,
Production & Staffing), plus a contingency line and a total. It's framed as
"AI-generated" but is deterministic, transparent logic running entirely in
the browser — every rate it uses is visible and documented, so it functions
as a fast, honest first-pass estimate to sanity-check against, not a black
box. Print-to-PDF gives a clean one-pager to keep or drop into a proposal
doc.

## Experience Principles

1. **Transparency over magic** — every number on screen should be
   traceable to an input. No line item should feel like it appeared from
   nowhere; hovering/reading should make the "why" obvious. This is a
   sanity-check tool, not a black box, and it loses all value the moment it
   isn't trusted.
2. **Speed over completeness** — this replaces "rough mental maths," not a
   full quantity surveyor. The form should be fillable in under a minute;
   defaults should be sensible enough that even an incomplete form produces
   a usable ballpark.
3. **Precision in presentation, honesty in the number** — the UI should
   look considered enough to sit next to Dior-tier client work, but the
   estimate itself must read as an estimate (range framing, visible
   assumptions, a contingency line), never as false certainty.

## Aesthetic Direction

- **Philosophy**: Studio/editorial minimalism — closest named references
  are Swiss/International Typographic (grid discipline, restrained type
  hierarchy) crossed with an architecture-studio tool aesthetic. Quiet
  confidence, not flashy — the calculator should feel like it belongs on
  the same desk as a materials spec sheet or a scale drawing.
- **Tone**: Calm, precise, quietly premium. Authoritative without being
  cold. No forced personality, no "AI" gimmicks (no chat bubbles, no
  typing-dots, no sparkle iconography) — the "AI" framing is in the copy,
  not the chrome.
- **Reference points**: Architecture/design-studio portfolio sites,
  high-end SaaS estimator tools (the numeric clarity of a good invoice or
  spec sheet), gallery/exhibition wayfinding (confident whitespace,
  hairline rules as structure).
- **Anti-references**: Generic "AI product" visual tropes (gradients,
  glowing orbs, sparkle icons, purple-to-blue gradients), consumer
  fintech playfulness (rounded bubbly cards, mascots), and — explicitly —
  Party Padel's bold sports-brand energy. This is a different product with
  a different audience; no shared visual language is intended.

## Existing Patterns

This is a standalone product, not an extension of the existing Party Padel
site. It gets its own token file and does not reuse Party Padel's palette,
type, or components — the two should be visually unrelated. It follows the
same *technical* convention already established in this repo (static HTML,
no build step, no framework, no backend, `assets/css/tokens.css` +
`assets/css/style.css` + `assets/js/*.js` pattern) so it's consistent to
maintain, just under its own root directory.

- Typography: none yet — new type ramp to be defined in tokens phase.
- Colors: none yet — new palette to be defined in tokens phase.
- Spacing: none yet — new scale to be defined in tokens phase.
- Components: none reused from Party Padel. New component set, documented
  below.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Page header / intro | New | Tool name, one-line framing of what it does |
| Project form | New | Hybrid structured fields + optional notes textarea (see Inputs below) |
| Select / dropdown | New | Project type, location, finish tier |
| Number input (size, duration) | New | sqm and weeks, with sensible min/step |
| Checkbox group (extras) | New | Multi-select add-ons that add line items |
| Notes textarea | New | Optional, free text, does not affect calculation |
| Calculate button | New | Primary action, triggers client-side calculation |
| Results summary | New | Headline total (shown as a range) + short assumption disclaimer |
| Line-item breakdown table | New | Grouped by the 4 categories, subtotals + grand total |
| Assumptions panel | New | Collapsible/expandable — states every rate and multiplier used, in plain language |
| Print button | New | Triggers browser print using a dedicated print stylesheet |
| Edit/recalculate | New | Returning to the form after seeing results, without losing entered values |
| Footer | New | Minimal — disclaimer that this is an estimate, not a quote |

## Inputs (Hybrid Form)

Structured fields drive the calculation; the notes field is context-only.

1. **Project type** (select, required): Pop-up Store / Flagship Storefront
   Fit-Out / Brand Activation & Event Space / Window Display & Installation
2. **Location** (select, required): Central London (Prime — Mayfair, Bond
   St, Carnaby St) / Other UK City / International
3. **Size** (number, sqm, required): sensible default per project type
4. **Duration** (number, weeks, required): total project timeline
   (build + trading period)
5. **Finish tier** (select, required): Standard / Premium / Ultra-Luxury
   (Bespoke)
6. **Extras** (checkboxes, optional, each adds a line item):
   - Bespoke joinery & finishes
   - Structural & glazing work
   - Custom signage & graphics production
   - Furniture, fixtures & styling props
   - AV, lighting & technical production
   - On-site staffing (brand ambassadors / install crew)
7. **Notes** (textarea, optional): free text shown back in the results
   summary/print view for context; does not affect any number.

## Calculation Logic & Assumptions

All figures are **[assumption]** — reasonable London experiential/retail
production benchmarks, not client-supplied rates. Every constant below
must be defined once (e.g. `assets/js/rates.js`) and documented inline so
they're easy to tune later. The estimate is always presented as a
**range (±12%)** around the calculated total, never a single false-precise
number, reinforcing Principle 3.

**Core inputs used throughout:**
- `sqm` = size input
- `weeks` = duration input
- `tier` ∈ {standard, premium, luxury} from Finish tier
- `locationMult` = { central-london: 1.15, other-uk: 1.0, international: 1.3 }
- `typeMult` = per-project-type adjustment (below)

**Project type adjustments (`typeMult`):**
- Pop-up Store: baseline (all multipliers 1.0)
- Flagship Storefront Fit-Out: fabrication ×1.1, site & logistics ×1.2,
  design fee +3 percentage points
- Brand Activation & Event Space: fabrication ×0.85, AV line ×1.4,
  on-site staffing extra pre-selected by default
- Window Display & Installation: fabrication ×0.6, site & logistics ×0.3,
  landlord/permit line item excluded entirely (assumed covered by the
  existing lease, not a separate negotiation)

**1. Design & Concept**
- Base design fee % of fabrication subtotal: standard 8%, premium 12%,
  luxury 15% (+3pts if Flagship, per above)
- Split into two line items: *Concept Design & 3D Visualisation* (70% of
  fee) and *Technical Drawings & Production Spec* (30% of fee)

**2. Fabrication & Materials**
- *Core Build & Fit-Out* = `sqm × ratePerSqm(tier) × locationMult × typeMult.fabrication`
  - `ratePerSqm`: standard £550, premium £1,100, luxury £2,000
- *Bespoke Joinery & Finishes* (if selected) = 25% of Core Build
- *Structural & Glazing Work* (if selected) = 20% of Core Build
- *Custom Signage & Graphics* (if selected) = `max(£3,000, sqm × £150)`
- *Furniture, Fixtures & Styling Props* (if selected) = `sqm × £120 × tierMult`
  (tierMult: standard 1.0, premium 1.3, luxury 1.8)

**3. Site & Logistics**
- *Landlord Fees, Permits & Business Rates* = `weeks × 7 × siteDayRate(location)`
  (siteDayRate: central-london £120/day, other-uk £40/day, international
  £80/day) — excluded for Window Display & Installation
- *Freight, Storage & Site Logistics* = `£1,500 + (sqm × £35)`, × typeMult.site
- *Installation & De-Rig Labour* = `sqm × £45`, × typeMult.site
- *Insurance & Compliance* (public liability, RAMS, fire safety) =
  `max(£800, 2% of Fabrication subtotal)`

**4. Production & Staffing**
- *Project Management* = `10% of (Fabrication subtotal + Site & Logistics subtotal)`
- *AV, Lighting & Technical Production* (if selected) =
  `(sqm × £180 + weeks × £900) × typeMult.av`
- *On-Site Staffing* (if selected, or pre-checked for Brand Activation) =
  `2 staff × £220/day × (weeks × 6 days)`
- *Contingency* (always included, not optional) = `10% of the sum of all
  line items above`

**Total** = sum of all applicable line items including contingency,
displayed as a range (`total × 0.88` to `total × 1.12`).

## Key Interactions

- Filling the form gives real-time sanity feedback (e.g. a size/duration
  combination that's unusually small or large for the selected project
  type shows a small inline note, not a blocking error — nothing here
  should ever hard-block submission).
- **Calculate** replaces the form view with the Results view (or reveals
  it below, TBD in IA phase) — no page reload, no loading spinner theatre
  since this is instant client-side math; a brief (~400ms) calculating
  state is fine for perceived weight but must not feel fake-slow.
  Announce the result via an ARIA live region for screen reader users.
- The **Assumptions panel** is collapsed by default but one click away —
  it lists every rate/multiplier actually used for *this* calculation
  (not the full rate card), so the user can see exactly why the number
  came out where it did.
- **Edit** returns to the form with all previous values still populated,
  so refining an estimate is a quick loop, not a restart.
- **Print** opens the browser print dialog with a dedicated print
  stylesheet: form UI hidden, just the project summary + full itemised
  breakdown + total + notes + a one-line "estimate, not a quote" disclaimer.

## Responsive Behavior

Desktop-first (primary use case is at a desk, refining a quote), but fully
usable down to mobile:
- Desktop/tablet: form fields can sit two-per-row where sensible (e.g.
  size + duration side by side); results table shows as a proper table.
- Mobile (<640px): form fields stack single-column; the results table
  becomes stacked category cards (label/value pairs) rather than a
  horizontally-scrolling table; the Assumptions panel stays collapsible.

## Accessibility Requirements

- All form fields have visible, programmatically associated `<label>`s —
  no placeholder-as-label.
- Full keyboard operability: tab order follows visual order, checkboxes
  and selects are native elements (no custom widgets that break keyboard
  support), visible focus states on every interactive element.
- Colour contrast: body text ≥ 4.5:1, large/heading text ≥ 3:1 against
  its background, in both the calculator UI and the print stylesheet.
- The calculated result is announced via `aria-live="polite"` so screen
  reader users know an estimate was produced without needing to
  re-navigate to it.
- Error/inline-note states (e.g. unusual size/duration) are conveyed by
  text, not colour alone.

## Out of Scope

- No real AI/LLM calls (no API key, no backend) — "AI" is framing/copy
  only, the logic is fully deterministic and documented.
- No saved history, accounts, or multi-project comparison — each visit is
  a fresh calculation (per decision; can revisit later if needed).
- No multi-currency support — GBP (£) only.
- No CMS/backend of any kind — fully static, matching the rest of this
  repo.
- No real client-facing sharing/export beyond browser print-to-PDF (no
  emailed PDFs, no server-generated exports).
- No editing of the underlying rate card from the UI — rates are
  developer-editable constants, not a settings screen.
