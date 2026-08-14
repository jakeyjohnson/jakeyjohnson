# Build Tasks: Jake's Budget Estimator

Generated from: .design/budget-estimator/DESIGN_BRIEF.md
Date: 2026-08-14

## Foundation

- [ ] **Page shell & base styles**: Build `budget-estimator/index.html` skeleton (header with tool name + one-line framing, two-column `<main>` container for form/results, footer disclaimer) and `budget-estimator/assets/css/style.css` with base resets, typography, and the two-column grid layout. Link `tokens.css` and the Inter + IBM Plex Mono Google Fonts. Establishes the Swiss/studio visual direction immediately so it can be validated before anything else is built. _Reuses: `tokens.css` (already built). New: `index.html`, `style.css`._
- [ ] **Rate engine**: Build `budget-estimator/assets/js/rates.js` — a pure calculation module implementing every formula and constant from the brief's Calculation Logic section (`ratePerSqm`, `locationMult`, `typeMult`, all 12 line-item formulas, the contingency line, and the ±12% range). Exposes a single `calculateEstimate(inputs)` function returning `{ categories: [...], total, rangeLow, rangeHigh, assumptionsUsed: [...] }`. This is the riskiest, most uncertain piece (most likely to have a formula bug or an unrealistic number) — build and verify it standalone with a few test inputs in the console before wiring it to any UI. _New module, no dependencies._

## Core UI

- [ ] **Form panel**: Build the left-column form — all 7 inputs (project type, location, size, duration, finish tier, extras checkboxes, notes) per the brief's Inputs section, each with a proper associated `<label>`, sensible per-project-type default values, and a Calculate button. Captures values into a plain JS state object on submit; does not calculate anything yet. _Depends on: Page shell. New component: form panel._
- [ ] **Results panel + empty state**: Build the right-column results panel shell, showing the empty state ("Fill in the project details to generate an estimate") before first calculation, per the IA's First Estimate flow. _Depends on: Page shell. New component: results panel._
- [ ] **Wire Calculate → results**: Connect the form's Calculate button to `rates.js`, render the headline total as a range, and render the itemised breakdown grouped into the 4 categories (Design & Concept, Fabrication & Materials, Site & Logistics, Production & Staffing) with subtotals and grand total, using `--font-family-mono` for every £ figure. Include the brief ~400ms calculating state. _Depends on: Rate engine, Form panel, Results panel._

## Interactions & States

- [ ] **Validation & inline notes**: Add required-field validation (missing field → focus moves there, inline error text, Calculate blocked) and the "unusual size/duration for this project type" inline note (non-blocking, text-based per accessibility requirement — never colour alone). _Depends on: Wire Calculate → results._
- [ ] **Assumptions panel**: Build the collapsible panel nested in Results, collapsed by default, listing only the specific rates/multipliers used for the current calculation (from `assumptionsUsed` returned by `rates.js`) in plain language. _Depends on: Wire Calculate → results._
- [ ] **Edit/recalculate loop + ARIA live announcement**: Confirm editing form values after a calculation retains all previous entries, results do not auto-recalculate on keystroke (per IA — Calculate must be clicked again), and the result is announced via `aria-live="polite"` on update. _Depends on: Wire Calculate → results._

## Responsive & Polish

- [ ] **Responsive layout**: Implement the mobile breakpoint (<768px per IA) — form and results stack single-column, results table becomes stacked category cards, auto-scroll to results on Calculate at this width. Verify at 375px, 768px, 1280px. _Depends on: all Core UI tasks._
- [ ] **Print stylesheet**: Add a dedicated `@media print` stylesheet (or separate `print.css`) that hides the form and any UI chrome, and prints a clean one-pager: project summary, full itemised breakdown, total, notes field content, and the "estimate, not a quote" disclaimer. Wire the Print button to `window.print()`. _Depends on: Wire Calculate → results._
- [ ] **Accessibility pass**: Verify all labels are programmatically associated, full keyboard operability (tab order, visible focus using `--shadow-focus`), colour contrast ≥4.5:1 body / ≥3:1 large text in both the UI and print stylesheet, and that error/note states read correctly without colour. _Depends on: all prior tasks._

## Review

- [ ] **Design review**: Run `/design-review` against `.design/budget-estimator/DESIGN_BRIEF.md`.
