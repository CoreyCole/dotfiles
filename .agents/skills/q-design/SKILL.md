---
name: q-design
description: Create a ~200-300 line design document — WHERE are we going? Current state, approaches, recommendation. Third stage of QRSPI pipeline. Human alignment gate.
---

# Design — Where Are We Going?

You are the third stage of the QRSPI pipeline. You answer the question **"where are we going?"** in a short design document (~200-300 lines). This forces alignment between human and agent before any code is written. This is the cheapest place to change direction.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why* (approaches, decision, patterns). The outline says *how* we get there (signatures, types, vertical slices). The plan is the low-level implementation (full code, exact file paths). If you're writing type definitions, package structures, or detailed signatures — that belongs in the outline, not here.

## When Invoked

1. **If a plan directory path was provided**, read `[plan_dir]/questions.md` and all files in `[plan_dir]/research/` fully, then begin.
2. **If no parameters**, respond:

```
I'll create a design document from your research findings.

Please provide the plan directory path:
e.g. `/q-design thoughts/creative-mode-agent/plans/2026-03-29_12-26-32_feature-name`
```

Then wait for input.

## Process

1. **Read `[plan_dir]/questions.md` and ALL files in `[plan_dir]/research/` fully.** These are your primary inputs. There may be multiple research documents covering different topics.

2. **Read the original ticket** if referenced in `questions.md`. Now you know what's being built.

3. **Read key files** identified in the research findings — especially patterns the implementation should follow.

4. **Brain dump everything** the agent knows into the design document:
   - Current state of the relevant code
   - Desired end state after this work
   - Patterns to follow (and anti-patterns to avoid)
   - 2-3 approaches with trade-offs
   - Your recommendation with clear reasoning
   - Resolved decisions
   - Open questions for the human

5. **Present the design to the user** for review. This is the human alignment gate. Expect feedback, corrections, and "brain surgery" on your assumptions.

6. **Iterate** until the user approves. Then write the final version.

## Output Template

Write to `[plan_dir]/design.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
stage: design
plan_dir: "[plan_dir]"
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

## Rules

- Target ~200-300 lines. If you're past 300, you're writing an outline, not a design. Move structural detail to the outline.
- Include *brief* representative code snippets showing the shape — just enough to communicate the approach. Full type definitions, interface listings, and package structures belong in the outline.
- Every pattern claim must reference a real file from the research. No invented conventions.
- Present this to the user BEFORE writing the final file. Get alignment first.
- This document is meant to be shared with teammates for lightweight pre-alignment. Write for that audience.
- Tell the user the plan directory path when done — they'll pass it to `/q-outline`.
