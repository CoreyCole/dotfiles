---
name: qrspi-planning
description: High-level overview of the QRSPI planning pipeline — Question, Research, Design, Outline, Plan, Implement. Read this to understand the workflow before using individual stage skills.
---

# QRSPI Planning Pipeline

A structured approach to non-trivial coding tasks. Each stage produces artifacts in a plan directory that grows over time. The pipeline splits work across separate, focused context windows to stay under the instruction budget and out of the dumb zone.

## Stages

| # | Stage | Skill | Produces | Human gate? |
|---|-------|-------|----------|-------------|
| 1 | Question | `/q-question` | `questions/*.md` | **Yes** — human reviews questions before research |
| 2 | Research | `/q-research` | `research/*.md` | **Yes** — human reviews findings before design |
| 3 | Design | `/q-design` | `design.md` + `adrs/*.md` | **Yes** — human approves approach |
| 4 | Outline | `/q-outline` | `outline.md` | **Yes** — reviewed via `/q-review [outline.md]` before `/q-plan` |
| 5 | Plan | `/q-plan` | `plan.md` | No — machine doc for the coding agent |
| 6 | Implement | `/q-implement` | code changes + verified commits + review handoff | No — human reviews the code via `/q-review` |

`/q-review` has two review modes:

- **Outline review** after `outline.md` is written and before `/q-plan`; it should improve `design.md`/`outline.md`, not just report on them
- **Implementation review** after `/q-implement` completes; if non-trivial follow-up work is needed, the timestamped review directory itself becomes a QRSPI plan and writes follow-up questions directly under `questions/`

Its canonical review artifact lives in `[plan_dir]/reviews/`.

## Key Principles

- **Do not outsource the thinking.** The engineer is a critical part of the loop at every human gate. The agent dumps, the human steers.
- **Separate context windows.** Question and Research run in fresh contexts. Research is blind to the ticket — it answers questions with pure codebase facts, no opinions.
- **Instruction budget.** Frontier LLMs reliably follow ~150-200 instructions. Each stage skill stays under ~40. Don't combine stages into one mega-prompt.
- **Dumb zone.** Context windows degrade past ~40% full. Keep contexts lean, especially for complex tasks.
- **Read the code, not the plan.** The plan is a tactical machine doc. Plans and code diverge — reading both is double work with no leverage. The human reviews code.
- **Vertical slices, not horizontal layers.** Each slice ships end-to-end (DB -> service -> API -> frontend) with a test checkpoint. Not "all models, then all routes, then all tests."
- **Design = brain dump + brain surgery.** Force the agent to dump the approved direction into a lean ~200-line doc. Keep detailed decision records in timestamped `adrs/*.md` files so later stages load the chosen path first while the reasoning stays available in the plan directory. The human does "brain surgery" on assumptions before proceeding. Cheapest place to change direction.
- **Lightweight team alignment.** Design docs and structured outlines replace architecture reviews and sprint planning meetings. Share with teammates before code is written.

## The Process Is Not Linear

The stages above are the *typical* forward flow, but the process loops. When research reveals the questions were wrong, go back to questions. When design surfaces unknowns, do more research. When outlining exposes a flaw in the design, revisit it.

Common loops:

- **Research -> Question**: Research answers reveal the questions missed something. Write new questions and research them.
- **Design -> Research**: Design needs facts not covered by existing research. Run `/q-research` again with new questions.
- **Outline -> Design**: Structural planning reveals a design flaw. Revise the design before continuing.
- **Plan -> Outline**: Implementation details show a slice won't work as outlined. Adjust the outline.

The plan directory accumulates artifacts from these loops. Multiple question docs and research docs are expected. Design and outline may be revised during pre-implementation planning. After implementation review, non-trivial follow-up work should live in a review-directory follow-up plan so the original parent `design.md` and `outline.md` remain preserved.

## The Plan Directory

```
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
  AGENTS.md          # Curated long-term memory for this plan directory (copy from ~/.agents/skills/qrspi-planning/AGENTS.md)
  prds/              # Source PRDs, ticket exports, screenshots, and related product docs
  context/           # Supporting codebase context artifacts
    question/        # Stage 1 supporting context
    research/        # Stage 2 supporting context
    design/          # Stage 3 supporting context
    outline/         # Stage 4 supporting context
    plan/            # Stage 5 supporting context
    implement/       # Stage 6 supporting context
    INDEX.md         # Optional index of notable context artifacts
  questions/         # Stage 1: Research questions (multiple files expected)
  research/          # Stage 2: Research findings (multiple files expected)
  design.md          # Stage 3: Design document (approved direction)
  adrs/              # Stage 3 supporting ADRs (one timestamped file per design decision)
  outline.md         # Stage 4: Structured outline
  plan.md            # Stage 5: Implementation plan with status checkboxes
  handoffs/          # Context preservation between sessions
  reviews/           # Timestamped outline and implementation review directories from /q-review
    YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/
      review.md      # Canonical review artifact
      AGENTS.md      # Present when this review dir also hosts non-trivial follow-up QRSPI work
      prds/
      questions/
      research/
      design.md
      adrs/
      outline.md
      plan.md
      handoffs/
      reviews/
```

`context/` artifacts are durable supporting artifacts that aid later stages. They do **not** replace the primary stage artifacts (`questions/*.md`, `research/*.md`, `design.md`, `outline.md`, `plan.md`). `adrs/*.md` are supporting decision records, not default stage artifacts for later steps. Load only the stage-relevant `context/` subdirectories and explicit supporting files listed by each skill; do not bulk-load unrelated context artifacts.

The copied `AGENTS.md` in the plan directory is the curated long-term memory for extended plan / implement / review loops. Use it to preserve durable context that future agents should remember first: approved decisions, important tradeoffs, non-obvious invariants, review learnings, and pointers to the canonical artifacts. Keep it short and aggressively curated. Do **not** use it as a running log or duplicate the full stage artifacts.

## Metadata Source

Before creating a new plan directory or writing a new markdown artifact in this pipeline, run `~/dotfiles/spec_metadata.sh`.

Use its output as the single source of truth for:

- `thoughts/[git_username]/...` path selection
- `[timestamp]` values in plan directory names and timestamped filenames
- Frontmatter fields such as `date`, `researcher`, `git_commit`, `branch`, and `repository`

If you are reusing an existing plan directory, keep that exact path and use the script for new artifact metadata.

## Handoffs

Use `/q-handoff` to checkpoint progress within or between stages. Use `/q-resume` to pick up where you left off. After `outline.md` is written, the usual next step is `/q-review [outline.md]`. When `/q-implement` completes, its completion handoff should advance to `/q-review` in implementation mode. Handoffs live in `[plan_dir]/handoffs/`. `/q-review` writes its canonical artifact to `[plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_[review-kind]/review.md`.

## Standard Context Loading

Every stage skill MUST follow this sequence at the start of execution:

1. **Load the pipeline overview** — read `~/.agents/skills/qrspi-planning/SKILL.md` (this file) to orient yourself.
1. **Load the artifacts listed in the stage skill** — each skill explicitly lists which files to load, including `[plan_dir]/AGENTS.md` when that stage should use the curated long-term memory, plus any stage-relevant `context/` subdirectories. Load exactly those files, no more, no less.

## Stage Skills

Each stage skill (`~/.agents/skills/q-question/SKILL.md` through `~/.agents/skills/q-implement/SKILL.md`) plus the shared review skill (`~/.agents/skills/q-review/SKILL.md`) contains the full process, templates, and rules for that step. Read the relevant skill before starting.

## Rules

- When a stage needs fresh discovery, use that stage's preferred read-only discovery/analyzer flow and write the resulting artifacts under `context/[stage]/`.
- Each stage reads the artifacts from prior stages. Don't skip stages — the artifacts are the context.
- Every stage through outline is a human gate. The human reviews questions, research findings, design, and the design+outline pair before proceeding. Use `/q-review [outline.md]` as the formal outline review checkpoint; that review should revise the docs toward a ready-for-`/q-plan` state, not just write a report. Do not outsource the thinking.
- The plan is a machine document. The human aligned on direction via design, outline, and outline review. Save the deep implementation review for the actual code; if it finds non-trivial follow-up work, create or use `[plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/` as a review-directory QRSPI plan. Seed the follow-up by writing questions directly under `questions/`; do not copy the review into `context/question/`, and do not overwrite the parent plan's `design.md` or `outline.md`.
- `/q-implement` uses `/q-resume` checkpoint handoffs for intermediate slices and only hands off to `/q-review` after all slices are complete, final verification passes, and the implementation is finished. It does not push or open pull requests unless the user explicitly asks.
- The plan's status checkboxes are the context recovery mechanism. Keep them updated during implementation.
- When looping back, add new artifacts rather than overwriting. The history matters.
- When a stage creates or updates an artifact, use `~/dotfiles/spec_metadata.sh` for filename timestamps and frontmatter metadata.
- Stage handoffs should prefer the **full path to the newly created artifact** (for example a specific `questions/*.md`, `research/*.md`, `design.md`, `outline.md`, or `plan.md`) in both the success response and the suggested next `/q-*` command. Do not abbreviate to only the parent plan directory when an artifact path exists.
- **Preserve the stage completion response after follow-ups.** Once a stage artifact exists, every later reply in that stage must still end with the stage's required completion format (for example `Artifact: ...`, `Summary: ...`, `Next: ...`), even if the follow-up was only to fix lint, tweak wording, answer a clarification, or correct a previous response. Address the follow-up first, then re-emit the exact artifact path and next `/q-*` command so the pipeline can continue.
