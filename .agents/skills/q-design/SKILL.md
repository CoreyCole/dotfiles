---
name: q-design
description: Create a ~200-300 line design document — WHERE are we going? Current state, approaches, recommendation. Third stage of QRSPI pipeline. Human alignment gate.
---

# Design — Where Are We Going?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the third stage of the QRSPI pipeline. You answer the question **"where are we going?"** in a short design document (~200-300 lines). This forces alignment between human and agent before any code is written. This is the cheapest place to change direction.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why* (approaches, decision, patterns). The outline says *how* we get there (signatures, types, vertical slices). The plan is the low-level implementation (full code, exact file paths). If you're writing type definitions, package structures, or detailed signatures — that belongs in the outline, not here.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read all files in `[plan_dir]/questions/`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path or research doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin.
2. **If no parameters**, respond:

```
I'll create a design document from your research findings.

Please provide the plan directory path or research doc path:
e.g. `/q-design thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-design thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0: all `questions/*.md`, all `research/*.md`, and any relevant files in `prds/`.

2. **Read the original ticket / PRD context** if referenced in the question docs or stored in `prds/`. Now you know what's being built.

1. **Read key files** identified in the research findings — especially patterns the implementation should follow.

1. **Brain dump everything** the agent knows into the design document:

   - Current state of the relevant code
   - Desired end state after this work
   - Patterns to follow (and anti-patterns to avoid)
   - 2-3 approaches with trade-offs
   - Your recommendation with clear reasoning
   - Resolved decisions
   - Open questions for the human

1. **Present the design to the user** for review. This is the human alignment gate. Expect feedback, corrections, and "brain surgery" on your assumptions.

1. **Iterate** until the user approves. Then write the final version.

## Output Template

Write to `[plan_dir]/design.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: design
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# Design: [Feature Name]

## Executive Summary
[3-5 sentences. What we're building, why, key risk, and how we'll mitigate it.]

## Current State
[What exists today. File references from research.]

## Desired End State
[What the world looks like when this is done.]

## Patterns to Follow
- [Pattern from research with file:line reference]
- [Convention to match]

## Patterns to Avoid
- [Anti-pattern found in codebase with explanation of why it's wrong]

## Approach A: [Name] (Recommended)
[Description. Why this approach. Key trade-offs.]

Representative code:
[Short snippet showing the shape of the solution — types, signatures, key calls. Not full implementation.]

## Approach B: [Name]
[Description. Why not recommended. When it would be better.]

## Decision
Going with Approach [X] because [reasons grounded in research findings].

## Resolved Decisions
- [Decision made during this design phase]

## Open Questions
- [Question that needs human input before proceeding]
```

## Response

When design.md is written, respond to the user with the **full file path** (not just the directory):

```
Design written to thoughts/[git_username]/plans/[timestamp]_[plan-name]/design.md

[brief summary of the recommended approach and key decisions]

Open questions for you:
- [list any open questions from the doc]

Ready to proceed? Start the structured outline with:

/q-outline thoughts/[git_username]/plans/[timestamp]_[plan-name]/design.md
```

Always include the complete `thoughts/.../design.md` path. Never abbreviate to just the directory. The suggested next command must pass the full artifact path, not only the parent plan directory.

**If the user responds with feedback** (corrections, different approach, answered questions, new concerns), ask any followup questions if more context would be helpful, do any additional research needed, update design.md accordingly, then respond again with the same format above. This is brain surgery — expect multiple rounds. Repeat until the user approves and moves to the next stage.

## Rules

- Target ~200-300 lines. If you're past 300, you're writing an outline, not a design. Move structural detail to the outline.
- Include *brief* representative code snippets showing the shape — just enough to communicate the approach. Full type definitions, interface listings, and package structures belong in the outline.
- Every pattern claim must reference a real file from the research. No invented conventions.
- Present this to the user BEFORE writing the final file. Get alignment first.
- This document is meant to be shared with teammates for lightweight pre-alignment. Write for that audience.
