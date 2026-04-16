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
| 3 | Design | `/q-design` | `design.md` | **Yes** — human approves approach |
| 4 | Outline | `/q-outline` | `outline.md` | **Yes** — last gate before code |
| 5 | Plan | `/q-plan` | `plan.md` | No — machine doc for the coding agent |
| 6 | Implement | `/q-implement` | code changes + PR | No — human reviews the code, not the plan |

## Key Principles

- **Do not outsource the thinking.** The engineer is a critical part of the loop at every human gate. The agent dumps, the human steers.
- **Separate context windows.** Question and Research run in fresh contexts. Research is blind to the ticket — it answers questions with pure codebase facts, no opinions.
- **Instruction budget.** Frontier LLMs reliably follow ~150-200 instructions. Each stage skill stays under ~40. Don't combine stages into one mega-prompt.
- **Dumb zone.** Context windows degrade past ~40% full. Keep contexts lean, especially for complex tasks.
- **Read the code, not the plan.** The plan is a tactical machine doc. Plans and code diverge — reading both is double work with no leverage. The human reviews code.
- **Vertical slices, not horizontal layers.** Each slice ships end-to-end (DB -> service -> API -> frontend) with a test checkpoint. Not "all models, then all routes, then all tests."
- **Design = brain dump + brain surgery.** Force the agent to dump everything it found and thinks into a ~200-line doc. The human does "brain surgery" on assumptions before proceeding. Cheapest place to change direction.
- **Lightweight team alignment.** Design docs and structured outlines replace architecture reviews and sprint planning meetings. Share with teammates before code is written.

## The Process Is Not Linear

The stages above are the *typical* forward flow, but the process loops. When research reveals the questions were wrong, go back to questions. When design surfaces unknowns, do more research. When outlining exposes a flaw in the design, revisit it.

Common loops:
- **Research -> Question**: Research answers reveal the questions missed something. Write new questions and research them.
- **Design -> Research**: Design needs facts not covered by existing research. Run `/q-research` again with new questions.
- **Outline -> Design**: Structural planning reveals a design flaw. Revise the design before continuing.
- **Plan -> Outline**: Implementation details show a slice won't work as outlined. Adjust the outline.

The plan directory accumulates artifacts from these loops. Multiple question docs and research docs are expected. Design and outline may be revised. The directory is the living record of the work.

## The Plan Directory

```
thoughts/[username]/plans/[timestamp]_[plan-name]/
  AGENTS.md          # How to work in this directory (copy from ~/.agents/skills/qrspi-planning/AGENTS.md)
  prds/              # Source PRDs, ticket exports, screenshots, and related product docs
  questions/         # Stage 1: Research questions (multiple files expected)
  research/          # Stage 2: Research findings (multiple files expected)
  design.md          # Stage 3: Design document
  outline.md         # Stage 4: Structured outline
  plan.md            # Stage 5: Implementation plan with status checkboxes
  handoffs/          # Context preservation between sessions
```

## Handoffs

Use `/q-handoff` to checkpoint progress within or between stages. Use `/q-resume` to pick up where you left off. Handoffs live in `[plan_dir]/handoffs/`.

## Standard Context Loading

Every stage skill MUST follow this sequence at the start of execution:

1. **Load the pipeline overview** — read `~/.agents/skills/qrspi-planning/SKILL.md` (this file) to orient yourself.
2. **Load the artifacts listed in the stage skill** — each skill explicitly lists which files to load. Load exactly those files, no more, no less.

## Stage Skills

Each stage skill (`~/.agents/skills/q-question/SKILL.md` through `~/.agents/skills/q-implement/SKILL.md`) contains the full process, templates, and rules for that stage. Read the relevant skill before starting a stage.

## Rules

- Each stage reads the artifacts from prior stages. Don't skip stages — the artifacts are the context.
- Every stage through outline is a human gate. The human reviews questions, research findings, design, and outline before proceeding. Do not outsource the thinking.
- The plan is a machine document. The human aligned on direction via design and outline. Save the deep review for the actual code.
- The plan's status checkboxes are the context recovery mechanism. Keep them updated during implementation.
- When looping back, add new artifacts rather than overwriting. The history matters.
- Stage handoffs should prefer the **full path to the newly created artifact** (for example a specific `questions/*.md`, `research/*.md`, `design.md`, `outline.md`, or `plan.md`) in both the success response and the suggested next `/q-*` command. Do not abbreviate to only the parent plan directory when an artifact path exists.
