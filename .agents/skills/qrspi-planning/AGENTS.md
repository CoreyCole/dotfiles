---
source: ~/.agents/skills/qrspi-planning/AGENTS.md
copied_by: /q-question
note: This is a template. The copy in each plan dir is living, curated memory. Keep it short and prune stale items.
---

# Plan Directory

This directory follows the QRSPI planning pipeline. It grows as stages complete and review loops add artifacts.

## Role of this AGENTS.md

The copy of this file inside a specific plan dir is long-term memory for that plan.

Use it to preserve only durable context that future agents should load before reading stage artifacts and code:

- approved decisions that must not be undone accidentally
- important tradeoffs and rejected paths
- non-obvious invariants, gotchas, or review learnings
- scope boundaries, naming choices, or sequencing changes that define the work
- pointers to canonical artifacts or code locations for details

This file complements primary artifacts. It does not replace `context/brainstorms/`, `questions/`, `research/`, `design.md`, `design-product.md`, `outline.md`, `plan.md`, `handoffs/`, or `reviews/`.

## Keep It Curated

Do not turn this file into a diary or dump.

Good candidates:

- stable decisions with downstream impact
- nuance that took real effort to learn
- review feedback that changed the accepted approach
- watch-out details easy to miss from happy-path artifacts

Bad candidates:

- raw command output or stack traces
- temporary debugging notes
- status updates already covered by `plan.md` checkboxes or handoffs
- long summaries of artifacts that already exist
- facts likely to go stale

When adding content:

- prefer short bullets
- include exact artifact paths or `file:line` references when useful
- update or delete stale items instead of appending contradictions
- keep the highest-signal items near the top
- if in doubt, leave it out

## How to Orient Yourself

1. Read this file's plan-specific memory first if it has been filled in.
1. Read the pipeline overview: `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Determine the current stage by checking which artifacts exist.
1. Read the skill for that stage.

## Suggested Sections for Plan-Specific Memory

Keep only sections that earn their place:

- **Current focus** — what loop or checkpoint we are in
- **Decisions to preserve** — approved choices, scope boundaries, naming, sequencing
- **Important tradeoffs / rejected paths** — only when future agents might reopen them
- **Invariants / gotchas** — non-obvious rules, edge cases, traps
- **Canonical artifacts** — the few docs future agents should open first

## Stages and Skills

| Artifact | Stage | Skill | Gate |
|----------|-------|-------|------|
| `questions/*.md` | Question | `~/.agents/skills/q-question/SKILL.md` | Human |
| `research/*.md` | Research | `~/.agents/skills/q-research/SKILL.md` | Human |
| `design.md` | Design | `~/.agents/skills/q-design/SKILL.md` | Human |
| `design-product.md` | Product Design | `~/.agents/skills/q-design-product/SKILL.md` | Optional human gate for product-critical/high-stakes work |
| `outline.md` | Outline | `~/.agents/skills/q-outline/SKILL.md` | LLM review via `/q-review [outline.md]` |
| `plan.md` | Plan | `~/.agents/skills/q-plan/SKILL.md` | LLM review via `/q-review [plan.md]` |
| code changes | Implement | `~/.agents/skills/q-implement/SKILL.md` | LLM code review via `/q-review [handoff.md]` |
| `reviews/*/review.md` | Review | `~/.agents/skills/q-review/SKILL.md` | Routes to planning or implementation review |

## Review Behavior

Planning review happens before implementation:

- `/q-review [outline.md]` reviews `design.md`, optional `design-product.md`, and `outline.md`.
- `/q-review [plan.md]` reviews `design.md`, optional `design-product.md`, `outline.md`, and `plan.md`.
- Clear planning findings are fixed directly in the parent docs.
- Findings needing codebase facts create research questions under the timestamped planning review directory.
- Run `/skill:q-research-for-review` on those questions so research preserves the review category context.
- After that research, `/skill:q-address-review-research` applies fixes back to the parent `design.md`, `design-product.md`, `outline.md`, and `plan.md`.
- Human judgment questions should be rare and go through `/answer`.

Implementation review happens after code exists:

- Straightforward code findings can be fixed immediately as a final review-fix slice stacked on top of the implementation.
- Deeper findings create a full QRSPI follow-up plan inside the timestamped implementation review directory.
- That implementation review directory owns its own `design.md`, `design-product.md`, `outline.md`, and `plan.md` for follow-up slices.
- Never overwrite the parent plan's planning docs for implementation-review follow-up work.

## Path Convention

Top-level plan directories start with `thoughts/`:

```text
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
```

Review follow-up plan directories live under the parent plan:

```text
thoughts/[git_username]/plans/[timestamp]_[plan-name]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/
```

Before creating a new plan directory or markdown artifact, run `~/dotfiles/spec_metadata.sh` and use its `Git Username`, `Timestamp For Filename`, and frontmatter fields.

Recommended top-level subdirectories:

- `prds/`
- `context/{brainstorms,question,research,design,design-product,outline,plan,implement}/`
- `questions/`
- `research/`
- `adrs/`
- `handoffs/`
- `reviews/`

## Key Constraints

- Use stage-specific read-only discovery and write outputs under `context/[stage]/`; q-question also writes interview rationale under `context/brainstorms/` for q-design.
- Keep Question and Research in separate, focused contexts.
- Research is blind to forward-looking plan docs unless a review follow-up question explicitly references a review artifact.
- Product design is optional. Use it for product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, or irreversible user/data behavior changes; skip it for internal tools, bugfixes, refactors, and low product-risk work.
- The plan is a tactical machine document, but it still gets an LLM review before implementation.
- Planning review edits docs directly; implementation review fixes code only for straightforward findings and uses a review-dir QRSPI plan for deeper work.
- Implementation runs in a fresh filesystem copy named for the plan directory or ticket slug. Never use `git worktree`; use macOS `cp -ac source-dir clean-copy-dir` or Linux `cp -a --reflink=auto source-dir clean-copy-dir`.
- For `cn-agents` QRSPI implementation, the fresh workspace starts from latest `main`, then each tracked edit slice gets a Graphite branch (`gt create ..._slice-N`) and Graphite commit. Do not commit slices directly to `main`; merge the completed implementation stack back with `/cn-agents-merge` after implementation/review.

## Handoffs

Use handoffs for checkpoint status. Promote only durable, high-signal learnings into this AGENTS.md.

- Resume stage work with `~/.agents/skills/q-resume/SKILL.md`.
- Create handoffs with `~/.agents/skills/q-handoff/SKILL.md`.
- During implementation, continue with `/q-resume [handoff]` until the final completion handoff points to `/q-review [handoff]`.
- Implementation handoffs should record the fresh implementation directory path when known, or explicitly tell the next agent to create the fresh copy before editing.
