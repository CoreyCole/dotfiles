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
2. **Read the original ticket / PRD context** if referenced in question docs or stored in `prds/`.
3. **Read key files** identified in research findings.
4. **Brain dump into the design doc:**
   - Current state
   - Desired end state
   - Patterns to follow / avoid
   - 2-3 approaches + trade-offs
   - Recommendation and rationale
   - Resolved decisions
   - Open questions
5. **Present design to user** for review.
6. **Iterate** until approved.
7. **Immediately before writing or updating `design.md`, gather metadata** with `~/dotfiles/spec_metadata.sh`, use it to populate the frontmatter fields, and then write the final version.

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
[3-5 sentences. What we're building, why, key risk, and mitigation.]

## Current State
[What exists today. File references from research.]

## Desired End State
[What the world looks like when this is done.]

## Patterns to Follow
- [Pattern from research with file:line reference]
- [Convention to match]

## Patterns to Avoid
- [Anti-pattern found in codebase and why]

## Approach A: [Name] (Recommended)
[Description, trade-offs, why recommended]

Representative code:
[Short snippet showing solution shape only]

## Approach B: [Name]
[Description, trade-offs, when it would be better]

## Decision
Going with Approach [X] because [reasons grounded in research].

## Resolved Decisions
- [Decision made during design phase]

## Open Questions
- [Question needing human input]
```

## Response

When design.md is written, use this exact response shape:

```
Artifact: [exact path to design.md]
Summary: [brief summary of the recommended approach and key decisions]
Next: /q-outline [exact path to design.md]
```

If there are open questions, include them below as:

```
Open questions:
- [question]
- [question]
```

Always include the complete `thoughts/.../design.md` path.

## Rules

- Target ~200-300 lines.
- Include brief representative snippets only.
- Every pattern claim must reference a real file from research.
- Present to user BEFORE finalizing.
- Write for teammate alignment.
- In every completion response, use: `Artifact: ...`, `Summary: ...`, `Next: ...`.
