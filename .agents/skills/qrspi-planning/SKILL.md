---
name: qrspi-planning
description: High-level overview of the QRSPI planning pipeline — Question, Research, Design, optional Product Design, Outline, Plan, Implement, Review. Read this to understand stage flow, review loops, and artifact ownership before using individual stage skills.
---

# QRSPI Planning Pipeline

A structured approach to non-trivial coding tasks. Each stage produces artifacts in a plan directory that grows over time. Separate context windows keep each stage focused and avoid the dumb zone.

## Stages

| # | Stage | Skill | Produces | Gate |
|---|-------|-------|----------|------|
| 1 | Question | `/q-question` | `questions/*.md` | Human alignment on goals, scope, tradeoffs, and research agenda |
| 2 | Research | `/q-research` | `research/*.md` | Human reviews facts before design |
| 3 | Design | `/q-design` | `design.md` + `adrs/*.md` | Human approves technical direction |
| 4 | Product Design | `/q-design-product` | `design-product.md` | Optional human gate for product-critical/high-stakes work |
| 5 | Outline | `/q-outline` | `outline.md` | LLM review via `/q-review [outline.md]` |
| 6 | Plan | `/q-plan` | `plan.md` | LLM review via `/q-review [plan.md]` |
| 7 | Implement | `/q-implement` | code changes + verified commits + review handoff | LLM code review via `/q-review [handoff.md]` |

`/q-review` is a router:

- Before code exists, it loads `q-review-plan`.
- After implementation is complete, it loads `q-review-implementation`.

## Review Loops

### Planning review before implementation

Run planning review after `outline.md` and again after `plan.md`:

```text
/q-outline [plan_dir]/design.md
/q-review [plan_dir]/outline.md
/q-plan [plan_dir]/outline.md
/q-review [plan_dir]/plan.md
/q-implement [plan_dir]/plan.md
```

For product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, or irreversible user/data behavior changes, insert product design before outline:

```text
/q-design-product [plan_dir]/design.md
/q-outline [plan_dir]/design-product.md
```

Planning review findings are handled in three ways:

1. `obvious_doc_fix` — edit `design.md`, `design-product.md`, `outline.md`, or `plan.md` directly during review.
1. `needs_codebase_research` — create a research questions doc under the timestamped planning review directory, then run `/skill:q-research-for-review` on it. After research, run `/skill:q-address-review-research` to update the parent planning docs from `review.md` plus the research doc.
1. `needs_human_judgment` — ask through `/answer`, then update the planning docs from the decision. This should be rare when `/q-question` did its job.

Planning-review research directories are lightweight research workspaces. They do not get their own `design.md`, `design-product.md`, `outline.md`, or `plan.md`; the researched fixes apply back to the parent planning docs.

### Implementation review after code exists

Implementation review examines actual code and verification evidence.

- `straightforward_fix` findings can be fixed immediately as a final review-fix slice stacked on top of the implementation.
- Deeper findings become a full QRSPI follow-up plan inside the timestamped implementation review directory. That review directory gets its own `questions/`, `research/`, `design.md`, `design-product.md`, `outline.md`, `plan.md`, `handoffs/`, and nested `reviews/`. Later `/q-implement` work from that review-dir plan stacks new branch slices on top of the original implementation.

Never overwrite the parent plan's `design.md`, `design-product.md`, `outline.md`, or `plan.md` for implementation-review follow-up work.

## Key Principles

- **Do not outsource the thinking.** The engineer is a critical part of the human gates. The agent dumps; the human steers.
- **LLM review edits artifacts.** Planning review should improve `design.md`, `design-product.md`, `outline.md`, and `plan.md` directly when fixes are clear. A passive report is not enough.
- **Human-facing planning is compressed.** For `design.md`, `design-product.md`, and `outline.md` artifacts: be extremely concise. Sacrifice grammar for the sake of concision. In `/q-question`, apply that style to the brainstorm/interview turns, not to the final research questions doc.
- **Separate context windows.** Question and Research run in fresh contexts. Research is blind to forward-looking plan artifacts and answers questions with codebase facts.
- **Instruction budget.** Keep each stage skill focused. Do not combine stages into one mega-prompt.
- **Dumb zone.** Context windows degrade when overfilled. Load only the artifacts the stage skill names.
- **Vertical slices, not horizontal layers.** Each slice ships end-to-end with a verification checkpoint.
- **Fresh implementation directories, never worktrees.** Implementation runs in a fresh filesystem copy named for the plan directory or ticket slug. Do not use `git worktree`; use macOS `cp -ac source-dir clean-copy-dir` or Linux `cp -a --reflink=auto source-dir clean-copy-dir`.
- **Design = brain dump + brain surgery.** Capture the approved technical direction in a lean doc; keep detailed decisions in ADRs.
- **Product Design = conditional PRD coverage gate.** Use for product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, or irreversible user/data behavior changes. Skip for internal tools, bugfixes, refactors, and low product-risk work.
- **Plan = tactical machine doc.** The plan is written for the implementing agent, but it still gets an LLM review before code starts.

## The Process Is Not Linear

The stages are the typical forward flow, but loops are expected:

- **Research -> Question**: Research reveals the questions missed something.
- **Design -> Research**: Design needs facts not covered by existing research.
- **Product Design -> Design/Research**: When the optional product gate is used, PRD coverage reveals a product gap or missing fact.
- **Outline -> Product Design/Design**: Structural planning reveals a product or technical design flaw.
- **Plan -> Outline/Product Design/Design**: Implementation steps reveal a slice, requirement, or interface problem.
- **Planning Review -> Research for Review -> Address Review Research**: Review finds a factual gap; `q-research-for-review` answers it with category-aware context; `q-address-review-research` updates parent docs.
- **Implementation Review -> QRSPI follow-up**: Code review finds deeper work; the implementation review directory becomes a new plan dir for stacked follow-up slices.

When looping before implementation, update the parent planning docs. When looping after implementation review, write new planning artifacts under the implementation review directory.

## The Plan Directory

```text
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
  AGENTS.md
  prds/
  context/
    brainstorms/    # q-question interview rationale for q-design
    question/
    research/
    design/
    design-product/
    outline/
    plan/
    implement/
    INDEX.md
  questions/
  research/
  design.md
  adrs/
  design-product.md
  outline.md
  plan.md
  handoffs/
  reviews/
    YYYY-MM-DD_HH-MM-SS_[plan-name]_outline-review/
      review.md
      questions/     # only for planning-review codebase research follow-up
      research/
      context/
        brainstorms/
        research/
    YYYY-MM-DD_HH-MM-SS_[plan-name]_plan-review/
      review.md
      questions/     # only for planning-review codebase research follow-up
      research/
      context/
        brainstorms/
        research/
    YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/
      review.md
      AGENTS.md      # present when this review dir hosts follow-up QRSPI work
      prds/
      context/
        brainstorms/
        question/
        research/
        design/
        design-product/
        outline/
        plan/
        implement/
      questions/
      research/
      design.md
      adrs/
      design-product.md
      outline.md
      plan.md
      handoffs/
      reviews/
```

`context/` artifacts support later stages but do not replace primary stage artifacts. `context/brainstorms/` preserves q-question interview rationale for q-design. Load only the context subdirectories named by the active stage skill.

The copied `AGENTS.md` in each plan directory is curated long-term memory. Preserve only durable decisions, gotchas, invariants, review learnings, and pointers to canonical artifacts.

## Metadata Source

Before creating a new plan directory or writing a new markdown artifact, run:

```bash
~/dotfiles/spec_metadata.sh
```

Use its output for:

- `thoughts/[git_username]/...` path selection
- timestamped directory and filename values
- frontmatter fields such as date, researcher, git commit, branch, and repository

## Handoffs

Use `/q-handoff` to checkpoint progress within or between stages. Use `/q-resume` to pick up where you left off.

- After `design.md`: next is `/q-outline [design.md]`, unless product design is warranted.
- After `design-product.md`: next is `/q-outline [design-product.md]`.
- After `outline.md`: next is `/q-review [outline.md]`.
- After `plan.md`: next is `/q-review [plan.md]`.
- During implementation: intermediate handoffs resume with `/q-resume`.
- Implementation handoffs record the fresh implementation directory or instruct the next agent to create one; they must not point agents at `git worktree`.
- After all implementation slices are complete: the completion handoff advances to `/q-review [handoff.md]` in implementation mode.

## Standard Context Loading

Every stage skill starts by:

1. Reading this pipeline overview.
1. Reading exactly the artifacts listed in that stage skill.

Do not bulk-load the whole plan directory.

## Stage Skills

Each stage skill contains the full process, templates, and rules for that step:

- `~/.agents/skills/q-question/SKILL.md`
- `~/.agents/skills/q-research/SKILL.md`
- `~/.agents/skills/q-design/SKILL.md`
- `~/.agents/skills/q-design-product/SKILL.md`
- `~/.agents/skills/q-outline/SKILL.md`
- `~/.agents/skills/q-plan/SKILL.md`
- `~/.agents/skills/q-implement/SKILL.md`
- `~/.agents/skills/q-review/SKILL.md`
- `~/.agents/skills/q-review-plan/SKILL.md`
- `~/.agents/skills/q-review-implementation/SKILL.md`
- `~/.agents/skills/q-research-for-review/SKILL.md`
- `~/.agents/skills/q-address-review-research/SKILL.md`

## Rules

- When a stage needs fresh discovery, use that stage's preferred read-only discovery/analyzer flow and write artifacts under `context/[stage]/`.
- Each stage reads artifacts from prior stages as directed by its skill. Do not skip stages for non-trivial work.
- Question, Research, and Design are human gates. Product Design is a conditional human gate. Outline and plan are LLM-reviewed gates before implementation.
- `/q-review [outline.md]` and `/q-review [plan.md]` should revise planning docs toward readiness, including `design-product.md` when present, not merely report issues.
- `/q-implement` uses `/q-resume` checkpoint handoffs for intermediate slices and only hands off to `/q-review` after all slices are complete and verification passes.
- `/q-implement` and implementation-stage `/q-resume` work must happen in a fresh filesystem copy named for the plan directory or ticket slug. Never use `git worktree`.
- Keep `plan.md` status checkboxes updated during implementation.
- When looping back before implementation, update parent planning artifacts. When addressing implementation review follow-up, use the implementation review directory as the new plan dir.
- When a stage creates or updates an artifact, use `~/dotfiles/spec_metadata.sh` for timestamps and frontmatter.
- Stage completion responses should include the full path to the created artifact and the exact next `/q-*` command.
- Preserve the stage completion response shape after follow-ups: answer the follow-up, then re-emit the artifact path and next command.
