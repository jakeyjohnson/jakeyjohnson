# Information Architecture: Jake's Budget Estimator

## Site Map

Single page, no routing, no navigation chrome beyond the page itself.

- Budget Estimator `/budget-estimator/index.html`
  - Form panel (left column, in-page, not a separate view)
  - Results panel (right column, in-page, populates on Calculate)
  - Assumptions panel (nested within Results, collapsible, not a separate view)

## Navigation Model

- **Primary navigation**: None. There is nothing else to navigate to — this
  is a standalone single-purpose tool, not a multi-page site.
- **Secondary navigation**: None.
- **Utility navigation**: A single footer line — the "estimate, not a
  quote" disclaimer. No settings, no account, no help link.
- **Mobile navigation**: N/A — no nav to adapt. Layout reflow is a content
  concern (see Responsive below), not a navigation one.

## Content Hierarchy

### Budget Estimator (the only page)

1. **Page header** — tool name ("Jake's Budget Estimator") + one-line
   framing of what it does. Establishes trust/context before the form.
2. **Form panel** — the seven inputs (project type, location, size,
   duration, finish tier, extras, notes) + Calculate button. This is
   where the user spends their first ~40 seconds.
3. **Results panel** — appears in the right column once calculated:
   headline total range, then the itemised breakdown grouped by the 4
   categories, then Print button.
4. **Assumptions panel** — nested inside Results, collapsed by default.
   Below the breakdown in priority since most visits don't need it open,
   but always one click away for the visits that do.
5. **Footer disclaimer** — lowest priority, always present, single line.

## User Flows

### First estimate

1. User lands on `/budget-estimator/`. Right column shows an empty state
   ("Fill in the project details to generate an estimate" — not a blank
   void) rather than a zero-value breakdown, so it never looks broken
   before first use.
2. User fills the form (structured fields required; notes optional).
3. User clicks **Calculate**.
   - If required fields are incomplete → inline validation on the
     specific empty field, focus moves there, nothing scrolls away from
     the form. No results view is shown.
   - If valid → brief calculating state (~400ms) then the Results column
     populates; on mobile, the page auto-scrolls down to the results
     since form and results are stacked, not side by side, at that width.
4. User reads the total, expands Assumptions if curious, optionally
   clicks **Print**.
5. User arrives at: a complete estimate they can screenshot, print, or
   act on immediately — no save step required, since this session output
   is disposable/single-use by design (per brief, no history/accounts).

### Refine an estimate

1. From a populated Results view, user changes a value in the still-visible
   form panel (e.g. bumps size from 40sqm to 60sqm).
2. Results panel does **not** auto-recalculate on every keystroke (would
   undercut the "Calculate" moment and risk a stale/live number reading as
   more precise than it is) — user clicks **Calculate** again to refresh.
3. Same validation/populate behavior as First Estimate, flow 3–4.

## Naming Conventions

| Concept | Label in UI | Notes |
|---|---|---|
| The overall tool | "Jake's Budget Estimator" | Per naming decision; used in page `<title>` and header |
| The generated number | "Estimate" / "estimated budget" | Never "quote" or "price" — legal/expectation distinction, reinforced in footer disclaimer |
| Individual cost rows | "Line items" | Matches brief's own vocabulary |
| The four groupings | "Design & Concept", "Fabrication & Materials", "Site & Logistics", "Production & Staffing" | Exact category names from the brief — used verbatim as section headings in the results table |
| The optional add-ons | "Extras" | Checkbox group label |
| The rate-transparency panel | "Assumptions" | Not "Methodology" (too formal) or "How this works" (too vague) |

## Component Reuse Map

Single-page tool, so "reuse across pages" doesn't apply in the usual
multi-page sense. Instead, this maps components reused *within* the page:

| Component | Used in | Behavior differences |
|---|---|---|
| Form field wrapper (label + input) | Every form field | Select vs. number vs. checkbox vs. textarea share the same label/spacing/error treatment |
| Category block | Each of the 4 line-item categories in Results | Identical structure (heading, rows, subtotal); only content differs |
| Collapsible panel | Assumptions panel only | Single use for now, but built generically enough to reuse if a second collapsible section is ever needed |

## Content Growth Plan

This tool is intentionally static in scope — the brief rules out saved
history, accounts, and a rate-editing UI. The only content that "grows" is
the rate card itself over time (as real costs drift), and that lives in
`assets/js/rates.js` as developer-edited constants, not through any UI
surface. No pagination, filtering, or search is needed anywhere on this
single page.

## URL Strategy

- Pattern: `/budget-estimator/index.html` (or `/budget-estimator/` if the
  host serves directory indexes) — one URL, no dynamic segments.
- Dynamic segments: None.
- Query parameters: None. Form state lives in memory only for this
  session; nothing is round-tripped through the URL (no shareable
  pre-filled links — out of scope per the brief).
