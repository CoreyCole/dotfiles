---
name: q-milestone-design
description: Create milestone-level QRSPI design for nested project planning. Use when designing a milestone-plan after research or running /q-milestone-design. Defines milestone ownership, outcomes, current-to-target direction, gap map, architecture inputs, dependencies, and proposed ticket set without creating implementation plans.
---

# Milestone Design — Where Is This Milestone Going?

Use this as the Design stage for milestone-level QRSPI. It mirrors `/q-design`, but it designs milestone ownership and ticket-shaping direction, not code implementation.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-design/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. milestone-plan `AGENTS.md`
1. all milestone-plan `questions/*.md`
1. all milestone-plan `context/brainstorms/*.md`
1. all milestone-plan `research/*.md`
1. relevant `context/research/*.md`
1. milestone `milestone.md`
1. project plan `AGENTS.md` only for canonical pointers/invariants

## Step 2: Run design interview

Ask one question at a time. Use loaded research to avoid asking factual questions.

Resolve:

- vertical milestone shape: named bonus plan/scenario/user path, smallest testable/demoable path, and why it is sequenced now
- milestone ownership and non-goals
- product outcomes and user-visible success criteria
- target users and concise user stories, including engineer-as-user stories only when outcome/architecture-enabling
- current-to-target direction
- gap map and architecture-spec inputs needed by the whole-system architecture ticket
- proposed ticket set, with each ticket mapped to outcomes/user stories/gaps/evidence and ordered to preserve end-to-end verifiability
- cross-milestone dependency handling
- taxonomy change proposals, if any
- what must be deferred to ticket-level QRSPI

## Step 3: Write design artifacts

Use `~/dotfiles/spec_metadata.sh` before writing.

Write `design.md` in the milestone-plan directory. Target ~200-300 lines. Keep concise; tables/fragments preferred. Product outcomes and proposed ticket boundaries belong here as approved direction.

Required sections:

1. Executive summary.
1. Vertical slice / sequencing rationale.
1. Milestone ownership.
1. Non-goals.
1. Product outcomes / user-visible success.
1. Current state summary.
1. Target behavior as user stories.
1. Current to target direction.
1. Gap map.
1. Architecture-spec inputs.
1. Proposed ticket set with ticket → stories/gaps/evidence/dependencies; preserve vertical ordering and mark any unavoidable horizontal/enabling tickets with the vertical path they unlock.
1. Cross-milestone dependencies.
1. Taxonomy proposals.
1. Deferred to ticket-level QRSPI.
1. ADR candidate disposition.
1. Open questions.

Write ADRs only for accepted durable decisions that are hard to reverse or surprising without context.

## Step 4: Update memory

If approved design introduces durable invariants, update `milestone-plan/AGENTS.md` with short pointers to `design.md` or ADRs. Do not duplicate design content.

## Response

Standard result fields required: `<qrspi-result>`, `<stage>`, `<status>`, `<outcome>`, `<workspace>`, `<policy>`, `<summary>`, `<artifact>`, and `<next>`.
End completed stage responses with standard fenced XML `<qrspi-result>` from `qrspi-planning`, using:

- `<stage>design</stage>`
- `<artifact>` = `design.md`
- `<next>` = `/q-milestone-review [design.md]`
