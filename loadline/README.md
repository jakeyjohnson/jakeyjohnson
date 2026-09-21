# Loadline

Production documentation that issues itself.

Loadline turns a project into its paperwork: RAMS, procurement, timelines,
suppliers and licences. It is built for companies who produce live events and
fabricated work, where the documentation is a legal obligation rather than an
afterthought, and where getting it wrong is a person's back or a cancelled
show.

## Why it exists

The pack this is modelled on is a real one, and it fails in real ways:

- **Codes drift.** A file named `PROD2026-002a` opens with the header
  `RISK ASSESSMENT NUMBER PROD2017-002a` — a 2017 code copied forward through
  nine years of revisions, because a human retypes it every time. Loadline
  issues codes from a register and writes them into the document itself.
- **Templates carry the last job's facts.** The base method statement has a
  production name and a named production manager baked into the boilerplate,
  so every reuse begins with a find-and-replace that someone eventually
  forgets. Here the boilerplate and the project facts are separate things.
- **Controls get skimmed.** Four distinct control measures sit in one table
  cell as a wall of text. Loadline stores them individually, so they are
  reusable, auditable, and readable on site.

## Architecture

**There is no database.** A workspace is a folder tree, and that tree is the
source of truth, so the production team keeps working where they already
look — and the app can never drift from the files people actually send to
clients.

```
<workspace>/
  workspace.json            Company branding, job code register, circulation list
  hazard-library.json       Reusable activities, hazards and control measures
  Projects/
    PROD2026-001a Winter Gala/
      project.json          The project manifest
      01 RAMS/              Generated risk assessments and method statements
      02 Procurement/
      03 Schedule/
      04 Licences/
      05 Suppliers/
      06 Drawings/
```

Two stores implement the same `DocumentStore` interface:

| Store | Used for | Notes |
|---|---|---|
| `LocalStore` | Development, demos, single-machine use | The default. No cloud account involved. |
| `DriveStore` | Production, per tenant | Writes into whichever Google Drive a company authorises. |

They produce an identical folder tree, so a workspace moves between them by
copying a directory. **Neither is ever pointed at a Drive by configuration** —
`DriveStore` is only constructed with credentials a tenant has just authorised.

Multi-tenancy falls out of this: each company's documents live in their own
storage, under their own branding, with their own job-code series.

## The base pack

Generating a project's documentation produces thirteen documents in one pass,
each filed into the folder it belongs in and stamped with the project's job
code:

| Document | Folder | What it is for |
|---|---|---|
| Risk Assessment | 01 RAMS | Hazards, controls and residual risk per activity |
| Method Statement | 01 RAMS | The safe system of work, arrival through get-out |
| COSHH Assessment | 01 RAMS | Required by the method statement's haze commitments |
| Lifting Plan | 01 RAMS | LOLER plan with an appointed person and capacity check |
| Site Induction Record | 01 RAMS | Briefing content and the sheet crew sign on arrival |
| Accident & Near Miss Report | 01 RAMS | Blank form; assessments are reviewed on incidents |
| Procurement Schedule | 02 Procurement | What to order and the date it must be ordered by |
| Purchase Order | 02 Procurement | Order template with computed totals |
| Production Schedule | 03 Schedule | Phases, owners and milestones |
| Call Sheet | 03 Schedule | Daily calls, contacts and emergency details |
| Licence & Permissions Register | 04 Licences | Licences to work through, with owner and status |
| Approved Supplier Register | 05 Suppliers | Suppliers and insurance expiry, flagged when lapsing |
| Subcontractor Questionnaire | 05 Suppliers | Sent out before work is placed |

Two of these exist because the source pack promised them and did not contain
them. The method statement commits to "COSHH assessment implemented" for haze
fluid, but no COSHH assessment exists. Every risk assessment is reviewed "In
event of Accident or Near Miss", but there is no form to record one on.

### These are starting points, not finished paperwork

Documents needing human input are marked **Needs completion** in the app, and
carry a visible `[COMPLETE BEFORE ISSUE]` marker in the text. Where content is
genuinely job-specific — a substance's hazard statements, a load's weight — the
default is a marked placeholder rather than an invented value, because a
plausible wrong number in a safety document is more dangerous than an obvious
blank.

### Arithmetic the documents do for you

- **Lifting plan** flags any equipment whose safe working load is under the
  total load, shaded on the page. Specifying gear too light for the load is a
  multiplication, so the document does it.
- **Procurement schedule** counts lead times back over *working* days from the
  on-site date, because suppliers quote in working days and a weekend silently
  eats two. Items past their order-by date are shaded.
- **Purchase orders** total their own lines and round VAT once on the net, which
  is what the supplier's invoice will show, so the two reconcile.
- **Supplier register and licence register** flag insurance and licences that
  have expired or expire within 30 days.

## Branding

Every company sets a logo, colours, heading font, document footer and
registered details under **Branding**. These apply to both the app shell (via
CSS custom properties injected at request time) and the header and footer of
every generated document. A RAMS pack goes to venues and clients under the
production company's name, so it should look like it came from them.

## Risk scoring

A 5×5 likelihood × severity matrix, taken from the source pack:

| Likelihood | | Severity | |
|---|---|---|---|
| 1 | Very Unlikely to Occur | 1 | Very Minor Injury |
| 2 | Unlikely to Occur | 2 | Minor Injury |
| 3 | May Occur | 3 | Time Off due to Injury |
| 4 | Likely to Occur | 4 | Serious Injury |
| 5 | Certain to Occur | 5 | Death |

Rating is likelihood × severity. Bands are `LOW` (≤8), `MEDIUM` (≤14),
`HIGH` (≤19) and `CRITICAL` (≤25).

The band thresholds are **inferred, not documented** — they are the only cuts
consistent with every banded rating in the source assessments (4 and 6 LOW, 10
and 12 MEDIUM, 15 and 16 HIGH). `CRITICAL` is an addition: the original pack
topped out at HIGH, which leaves a production manager nowhere to escalate.
Tests pin all six observed cases, because documents already issued to clients
carry those words.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

### Testing

```bash
npm test             # 72 tests: domain, rendering, store, end-to-end
npm run typecheck
npm run lint
```

`npm test` covers the parts that matter without a browser: risk scoring
against every band printed in the source documents, job code issuing and
stale-code detection, store round-trips, and an end-to-end pass that unzips
generated `.docx` files and reads their text back — because asserting on a
file's size proves nothing about a zip.

For the full product in a real browser:

```bash
npm install
npx playwright install chromium   # once
npm run build
npm start &                        # http://localhost:3000
BASE=http://localhost:3000 npm run smoke
```

The smoke test sets branding, uploads a logo, creates a project, generates its
RAMS pack, checks the job code register increments across independent series,
and confirms the layout does not scroll sideways on a phone. It writes
screenshots to `smoke-screenshots/` and exits non-zero on any failure.

Point it at a throwaway workspace so it never touches real work:

```bash
LOADLINE_WORKSPACE_DIR=/tmp/loadline-demo npm start &
```

### Testing it by hand

1. **Branding** — set a logo and colours first, so documents carry them.
2. **New project** — the job code is issued for you; you never type one.
3. **Generate RAMS pack** — documents appear under
   `<workspace>/Projects/<code> <name>/01 RAMS/`. Open them in Word.

Configuration, all optional:

| Variable | Default | Purpose |
|---|---|---|
| `LOADLINE_WORKSPACE_DIR` | `.loadline-workspace` | Where the local workspace lives |
| `LOADLINE_COMPANY_NAME` | `Your Company` | Name used when first creating a workspace |

## Layout

```
src/domain/       Risk scoring, job codes, branding, hazard library, templates
src/store/        DocumentStore interface, LocalStore, DriveStore
src/documents/    .docx generators for risk assessments and method statements
src/app/          Next.js App Router pages and server actions
```

The domain layer has no dependency on storage or on Next.js, which is why it
is the part with real test coverage.

## Status

Built so far:

- Job code register with per-series, per-year sequences and revisions
- Hazard library seeded from a real assessment, with scored controls
- Risk assessment and method statement generation to branded `.docx`
- Project creation, folder scaffolding and document listing
- Per-tenant branding: logo, theme, document footer, registered details
- Local store complete; Drive store written and typechecked, not yet wired to
  a sign-in flow

Not built yet: procurement, timelines, suppliers, licences, Google sign-in,
and per-project editing of the hazard library. The folder structure and the
store interface already account for them.

## Known limitations

- **Job code issuing is a read-modify-write** on a single file, so two people
  creating a project in the same series at the same instant can be handed the
  same number. Drive offers no compare-and-swap. A duplicate surfaces as two
  projects sharing a code rather than as silent data loss, and
  `DriveStore.auditCodes` reports it.
- **Only PNG dimensions are read** when a logo is uploaded. JPEG and SVG logos
  fall back to the header band size instead of being scaled to their aspect
  ratio.
- **SVG logos are not embedded in documents** — Word's SVG support is
  inconsistent, so documents fall back to the company name set in the brand
  colour. The app shell displays SVG normally.
