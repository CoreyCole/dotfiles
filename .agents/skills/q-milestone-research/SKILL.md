---
name: q-milestone-research
description: Research a milestone-plan directory for nested QRSPI project planning. Use when answering milestone-level research questions, mapping current code state to requirements, or running /q-milestone-research. Produces factual current-state, source-doc, gap, dependency, and ticket-shaping research.
---

# Milestone Research — What Is True Now?

Use this as the Research stage for milestone-level QRSPI. It mirrors `/q-research`, but the output supports milestone design, milestone outline, architecture-spec inputs, and proposed ticket boundaries.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-research/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. milestone-plan `AGENTS.md`
1. provided question doc
1. project/milestone artifacts explicitly referenced by those files

Research may inspect code freely to build an accurate current-state map. Stay factual. Use `file:line` references for current behavior and source docs.

## Step 2: Keep research at milestone granularity

Allowed:

- current capabilities
- missing concepts
- relevant services, tables, APIs, UI surfaces, jobs, tests
- requirement/source-doc facts
- gap map evidence
- likely ticket boundaries
- dependency and taxonomy signals

Avoid:

- low-level implementation instructions for future tickets
- exact code-edit slices
- speculative schema/API designs not required for milestone design
- replacing ticket-level QRSPI

## Step 3: Produce milestone research

Write `research/YYYY-MM-DD_HH-MM-SS_[slug].md`.

Required sections:

1. Brainstorm / alignment summary.
1. Evidence boundary.
1. Current code/system state.
1. Requirement/source-doc state.
1. Gap map: requirement → supported / partial / missing.
1. User-story implications, including engineer-as-user stories.
1. Architecture-spec inputs.
1. Proposed ticket-shaping implications.
1. Cross-milestone dependencies.
1. Taxonomy change signals.
1. Deferred to ticket-level QRSPI.
1. Open factual questions.

Use concise tables where possible. Cite canonical docs; do not copy full requirements.

## Step 4: Loop when facts are missing

If research reveals new code-answerable factual questions that materially affect milestone design, write a follow-up question/research note and run another research pass before design.

## Response

End completed stage responses with standard fenced XML `<qrspi-result>` from `qrspi-planning`, using:

- `<stage>research</stage>`
- `<artifact>` = research doc path
- `<next>` = `/q-milestone-design [research-doc]`
