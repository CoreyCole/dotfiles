---
name: q-outline
description: Create a structured outline (~2 pages) — signatures, types, vertical slices, test checkpoints. Fourth stage of QRSPI pipeline. Last human review gate before code.
---

# Structured Outline — How Do We Get There?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the fourth stage of the QRSPI pipeline. You answer the question **"how do we get there?"** in a structured outline that is the "C header file" for the implementation — signatures, types, phases, and test checkpoints. No full implementations. This is the last human review gate before code is written.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why*. The outline says *how* — type definitions, package structures, interface signatures, database schemas, API surfaces, vertical slices with test checkpoints. The plan expands the outline into full implementation code. If the design is the architecture review, the outline is the sprint planning. The plan is the coding agent's instructions.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/questions.md`
   - Read `[plan_dir]/design.md`
   - Read all files in `[plan_dir]/research/`
1. **If a plan directory path was provided**, load the artifacts above, then begin.
2. **If no parameters**, respond:

```
I'll create a structured outline from your approved design.

Please provide the plan directory path:
e.g. `/q-outline thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0: `questions.md`, `design.md`, and all `research/*.md` files.

2. **Define the structural foundation** — the types, interfaces, schemas, and package structures that the plan will implement. This is the "C header" view of the entire system.

3. **Break the approved approach into vertical slices.** Each slice delivers one working piece of functionality end-to-end — not all-DB-then-all-API. Each slice is independently testable.

4. **For each slice, define:**
   - Files to create or modify
   - Key signatures and types (what, not how)
   - Test checkpoint — how to verify this slice works before moving on

5. **Present the outline to the user** for review. This is the final human gate. If the structure is wrong, this is where you redirect — not during implementation.

6. **Iterate** until the user approves. Then write the final version.

## Output Template

Write to `[plan_dir]/outline.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: outline
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# Outline: [Feature Name]

## Overview
[2-3 sentences. What we're building and the approved approach from design.md.]

## Type Definitions
[Key types, structs, interfaces — the "C header" for the system]

## Database Schema (if applicable)
[Table definitions]

## Package / File Structure
[Where things live, import direction]

## API Surface (if applicable)
[Endpoints, CLI commands]

## Slices

### Slice 1: [Name]
**Files:** `path/to/file.ext` (new), `path/to/other.ext` (modify)

**Signatures:**
- `FunctionName(param Type) (ReturnType, error)`
- `type NewStruct struct { ... }`

**Test checkpoint:** [How to verify this slice works — specific command or assertion]

### Slice 2: [Name]
**Files:** ...

**Signatures:**
- ...

**Test checkpoint:** ...

### Slice N: [Name]
...

## Out of Scope
- [Things explicitly not included in this implementation]
```

## Response

When outline.md is written, respond to the user with the **full file path** (not just the directory):

```
Outline written to thoughts/[git_username]/plans/[timestamp]_[plan-name]/outline.md

[brief summary of slices and their test checkpoints]

This is the last review gate before code. Ready to proceed? Generate the plan with:

/q-plan thoughts/[git_username]/plans/[timestamp]_[plan-name]
```

Always include the complete `thoughts/.../outline.md` path. Never abbreviate to just the directory.

**If the user responds with feedback** (slice reordering, missing pieces, scope changes), ask followup questions if more context would be helpful, do any additional research needed, update outline.md accordingly, then respond again with the same format above. This is the last gate — get it right. Repeat until the user approves and moves to the next stage.

## Rules

- This is the structural backbone — longer than the design, shorter than the plan. Include type definitions, schemas, API surfaces, and package structures that the design deliberately omits.
- **Vertical slices, not horizontal layers.** Each slice ships a working piece end-to-end. If your slices are "all models", "all routes", "all tests" — you're doing it wrong.
- Show signatures and types, NOT full function bodies. The plan stage fills in the implementation.
- Every slice must have a test checkpoint. If you can't describe how to test it, the slice is too big or too vague.
- Present to the user BEFORE writing the final file. This is the last review gate.
