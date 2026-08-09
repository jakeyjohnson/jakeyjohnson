---
name: skill-library
description: Router into this repo's archived ECC skills, agents, commands, and rules — the parts of the full ECC install (affaan-m/ecc) that aren't loaded by default because they're off-stack for a static HTML/CSS/JS site (no framework, no backend, no build step). Use when a task needs a language/framework-specific reviewer, build-resolver, or workflow that isn't in the default set — e.g. "review this Python", "fix this React build", "set up TDD", "check this Rust code" — or when the user asks what else ECC has, wants something un-archived, or asks about a skill/agent/command they remember installing that no longer auto-triggers.
---

# ECC Skill Library (archived, not auto-loaded)

This repo runs the full ECC install (`affaan-m/ecc`), but only a curated
subset stays in the auto-scanned paths (`.claude/skills`, `.claude/agents`,
`.claude/commands`, `.claude/rules/ecc`). Everything else was moved here by
`agent-sort` on 2026-08-09 to keep session context lean — Party Padel is a
static site with no framework, no backend, and no build step, so ~90% of
ECC's 284 skills / 67 agents / 94 commands never apply.

**Nothing was deleted.** If a task needs one of these, read the relevant
file directly (or copy it back into the live path if it'll be needed
repeatedly) and use it normally.

## Where things live

| Kind | Live (auto-loaded) | Archived (this library) |
|---|---|---|
| Skills | `.claude/skills/<name>/SKILL.md` | `.claude/library/skills/<name>/SKILL.md` |
| Agents | `.claude/agents/<name>.md` | `.claude/library/agents/<name>.md` |
| Commands | `.claude/commands/<name>.md` | `.claude/library/commands/<name>.md` |
| Rules | `.claude/rules/ecc/{common,web}/` | `.claude/library/rules/ecc/<language>/` |
| Other-harness adapters (OpenAI-format shims, not used by Claude Code) | — | `.claude/library/other-harness-adapters/` |

## What stayed live, and why

- **Site quality**: `accessibility`, `seo`, `design-system`, `click-path-audit`, `browser-qa`, `canary-watch`, `production-audit`, `make-interfaces-feel-better`, `frontend-design-direction`
- **Content/marketing**: `content-engine`, `marketing-campaign`, `brand-voice`
- **Workflow**: `git-workflow`, `github-ops`, `ecc-guide`, `continuous-learning-v2`
- **Agents**: `code-reviewer`, `security-reviewer`, `performance-optimizer`, `a11y-architect`, `seo-specialist`, `marketing-agent`, `planner`
- **Commands**: `code-review`, `review-pr`, `pr`, `plan`, `feature-dev`, `ecc-guide`
- **Rules**: `common` (baseline conventions), `web` (framework-agnostic web patterns)

Full rationale and evidence table: see the `agent-sort` run in this
session's history, or re-run the `agent-sort` skill for a fresh pass.

## Grouped trigger keywords in the archive

- **Frameworks/languages** (reviewers + build-resolvers + rules, one bundle per stack): `react`, `vue`, `angular`, `nuxt`, `next.js` → `.claude/library/skills/frontend-patterns`, `.claude/library/agents/react-reviewer.md`, etc. Same pattern for `python`/`django`/`fastapi`, `go`, `rust`, `java`/`spring`/`quarkus`, `kotlin`, `swift`/`swiftui`, `dart`/`flutter`, `php`/`laravel`, `c#`/`.net`, `c++`, `f#`, `ruby`/`rails`, `arkts`/`harmonyos`
- **Testing/TDD**: `tdd-workflow`, `e2e-testing`, `test-coverage` command, `pr-test-analyzer` agent — none active because this repo has no test framework yet
- **Backend/data**: `database-migrations`, `postgres-patterns`, `mysql-patterns`, `redis-patterns`, `kubernetes-patterns`, `docker-patterns`, `deployment-patterns`
- **ML/AI engineering**: `pytorch-patterns`, `mle-workflow`, `agent-*` (agent-harness-construction, agent-eval, etc.)
- **Domain verticals** (not this business): `healthcare-*`, `customs-trade-compliance`, `energy-procurement`, `logistics-exception-management`, `carrier-relationship-management`, `prediction-market-*`
- **Video/motion for React**: `motion-foundations`, `motion-patterns`, `motion-ui`, `motion-advanced` — all require `motion/react`, not applicable to vanilla JS
- **iOS-specific design**: `liquid-glass-design` — SwiftUI/UIKit only
- **ECC meta-tooling**: `config-gc`, `context-budget`, `agent-sort`, `skill-stocktake`, `strategic-compact`, `prompt-optimizer`, `configure-ecc`, `repo-scan` — useful for managing the ECC install itself, not for building the site
- **Social distribution**: `crosspost`, `social-publisher` — kept archived since `content-engine` covers creation; un-archive when actually running a distribution campaign

## Un-archiving something

```bash
# one-off use: just read it in place, no move needed
cat .claude/library/skills/react-patterns/SKILL.md

# needed repeatedly: move it back to the live path
mv .claude/library/skills/react-patterns .claude/skills/
```
