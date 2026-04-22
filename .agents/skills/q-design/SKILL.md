---
name: q-design
description: Create a ~200-300 line design document — WHERE are we going? Current state, recommended approach, and timestamped ADRs under `adrs/` for detailed design decisions. Third stage of QRSPI pipeline. Human alignment gate.
---

# Design — Where Are We Going?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the third stage of the QRSPI pipeline. You answer the question **"where are we going?"** in a short design document (~200-300 lines). This forces alignment between human and agent before any code is written. This is the cheapest place to change direction.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why* (recommended approach, decision summaries, patterns). The outline says *how* we get there (signatures, types, vertical slices). The plan is the low-level implementation (full code, exact file paths). Put detailed decision records in timestamped files under `adrs/` so later stages load the approved direction first, while humans can still inspect the reasoning when needed. If you're writing type definitions, package structures, or detailed signatures — that belongs in the outline, not here.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/AGENTS.md`
   - Read all files in `[plan_dir]/questions/`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/research/`
   - Read all files in `[plan_dir]/context/design/` if any
   - Read all files in `[plan_dir]/adrs/` if any
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

1. **Verify artifacts are loaded** from step 0: `[plan_dir]/AGENTS.md`, all `questions/*.md`, all `research/*.md`, relevant context artifacts in `context/research/` and `context/design/`, any existing `adrs/*.md`, and any relevant files in `prds/`.
2. **Read the original ticket / PRD context** if referenced in question docs or stored in `prds/`.
3. **Read key files** identified in research findings and context artifacts.
4. **If current-state validation is still missing or stale, run `codebase-locator`** with a narrowly scoped refresh task and, if needed, `codebase-analyzer` on the surfaced files or flows. Write the resulting timestamped artifact(s) under `[plan_dir]/context/design/`.
5. **Draft the design artifacts:**
   - `design.md` stays lean and default-loadable:
     - Current state
     - Desired end state
     - Patterns to follow / avoid
     - Recommended approach and rationale
     - Brief decision summaries with links to ADRs
     - Open questions
   - Create `adrs/` if needed, then write **one ADR per design decision** at:
     - `[plan_dir]/adrs/YYYY-MM-DD_HH-MM-SS_[decision-slug].md`
   - Each ADR captures the detailed record for that decision:
     - Context and decision drivers
     - The chosen decision
     - Alternatives considered / rejected
     - Consequences / trade-offs
   - Keep rejected or superseded approaches out of `design.md` beyond a brief linked summary.
6. **Present the design to the user** for review. If you wrote or updated ADRs, summarize the key decisions and their ADR links too.
7. **Iterate** until approved.
8. **If the approved design introduced durable decisions, tradeoffs, or invariants that future stages should remember first, update `[plan_dir]/AGENTS.md`.**
   - Keep it short and curated.
   - Point back to `design.md`, `adrs/*.md`, or other canonical artifacts instead of duplicating them.
9. **Immediately before writing or updating `design.md` and any ADRs, gather metadata** with `~/dotfiles/spec_metadata.sh`, use it to populate the frontmatter fields and timestamped ADR filenames, and then write the final version(s).

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

## Recommended Approach
[Description of the selected solution shape and why it fits the research. Keep this focused on the approved path only.]

Representative code:
[Short snippet showing solution shape only]

## Decision
Going with this approach because [reasons grounded in research].

## Resolved Decisions
- [Decision summary]. See [`adrs/YYYY-MM-DD_HH-MM-SS_decision-slug.md`](adrs/YYYY-MM-DD_HH-MM-SS_decision-slug.md).
- [Decision summary]. See [`adrs/YYYY-MM-DD_HH-MM-SS_other-decision.md`](adrs/YYYY-MM-DD_HH-MM-SS_other-decision.md).

## Open Questions
- [Question needing human input]
```

## ADR Template

When a design decision needs a durable record, write one ADR per decision under `[plan_dir]/adrs/` using a timestamped filename from `~/dotfiles/spec_metadata.sh`:

```text
[plan_dir]/adrs/YYYY-MM-DD_HH-MM-SS_[decision-slug].md
```

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: design
artifact: adr
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
related_artifact: "thoughts/[git_username]/plans/[timestamp]_[plan-name]/design.md"
---

# ADR: [Decision Name]

## Status
Accepted

## Context
[Problem framing, constraints, and why this decision was needed.]

## Decision Drivers
- [Driver]
- [Driver]

## Decision
[The selected decision for this specific topic.]

## Alternatives Considered

### Alternative A: [Name]
**Status:** Rejected
[Why it was considered, why it was rejected, and when it might have been reasonable.]

### Alternative B: [Name]
**Status:** Rejected
[Same treatment.]

## Consequences
- [Positive consequence]
- [Trade-off / cost]
```

## Response

When design.md is written, use this exact response shape:

```
Artifact: [exact path to design.md]
Summary: [brief summary of the recommended approach and key decisions; if ADRs were written, include their exact `adrs/...` paths here]
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

- Target ~200-300 lines for `design.md`. Keep each ADR concise and decision-focused.
- Include brief representative snippets only.
- Every pattern claim must reference a real file from research.
- Keep rejected or superseded approaches out of `design.md`; put them in timestamped `adrs/*.md` files.
- Use one ADR per design decision, not one monolithic decision dump.
- Present to user BEFORE finalizing.
- Write for teammate alignment.
- In every completion response, use: `Artifact: ...`, `Summary: ...`, `Next: ...`.
