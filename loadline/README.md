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

```bash
npm test             # domain, rendering, store and end-to-end tests
npm run typecheck
npm run lint
```

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
