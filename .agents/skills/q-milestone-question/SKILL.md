---
name: q-milestone-question
description: Create milestone-level QRSPI research questions for nested project planning. Use when starting a milestone-plan directory, planning what tickets should exist for a milestone, or running /q-milestone-question. Focuses on milestone ownership, current-state discovery, user stories, architecture inputs, and ticket-shaping questions.
---

# Milestone Question — What Must This Milestone Learn?

Use this as the Question stage for milestone-level QRSPI. It mirrors `/q-question` mechanics, but its goal is milestone planning: decide what research is needed before shaping implementation/spec tickets.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-question/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. project plan `AGENTS.md`
1. milestone `milestone.md`, if present
1. existing milestone-plan `AGENTS.md`, if present
1. relevant parent status/routing artifacts named by project `AGENTS.md`

Do not bulk-load unrelated project docs.

## Step 2: Establish artifact ownership

Confirm the active directory is a `milestone-plan/` directory or create/use one under a milestone directory.

Use the common reference ownership model:

- project plan directory owns cross-milestone truth
- milestone directory owns local milestone truth
- milestone-plan directory owns milestone-level QRSPI
- ticket directories own ticket-level QRSPI

## Step 3: Interview for milestone alignment

Ask one question at a time unless the user asks for a batch. Explore docs/code first when the answer is factual.

Resolve:

- milestone owns / does not own
- why this milestone exists
- who the users are, including engineer-as-user cases
- what current-code accuracy is required
- which source docs are canonical
- expected architecture-spec inputs
- likely ticket-shaping boundaries
- what must be deferred to ticket-level QRSPI
- taxonomy/dependency concerns

## Step 4: Write question artifacts

Create the normal q-question outputs under the milestone-plan directory:

- `context/brainstorms/YYYY-MM-DD_HH-MM-SS_[slug].md`
- `questions/YYYY-MM-DD_HH-MM-SS_[slug].md`

Use `~/dotfiles/spec_metadata.sh` before writing.

The question doc must ask for research that can support milestone design/outline:

1. Current code/system state relevant to this milestone.
1. Requirement/source-doc state, with canonical paths.
1. Gap map candidates: current support / partial / missing.
1. User stories to support, including engineer-as-user stories.
1. Architecture-spec inputs and cross-cutting decisions.
1. Proposed ticket boundary evidence.
1. Cross-milestone dependencies.
1. Taxonomy change risks.
1. Details to defer to ticket-level QRSPI.

## Step 5: Update milestone-plan memory

Create or update `milestone-plan/AGENTS.md` with routing-only durable memory:

- current focus
- canonical project/milestone pointers
- approved scope boundaries
- durable terms/ambiguities
- next command

Keep it short. Do not copy full requirements.

## Response

End completed stage responses with the standard fenced XML `<qrspi-result>` from `qrspi-planning`, using:

- `<stage>question</stage>`
- `<artifact>` = question doc path
- `<next>` = `/q-milestone-research [question-doc]`
