---
name: q-outline
description: Create a structured outline (~2 pages) — signatures, types, vertical slices, test checkpoints. Fourth stage of QRSPI pipeline. Last human review gate before code.
---

# Structured Outline — How Do We Get There?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the fourth stage of the QRSPI pipeline. You answer the question **"how do we get there?"** in a structured outline that is the "C header file" for the implementation — signatures, types, phases, and test checkpoints. No full implementations. This is the last human review gate before code is written.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why*. The outline says *how* — type definitions, package structures, interface signatures, database schemas, API surfaces, vertical slices with test checkpoints. The plan expands the outline into full implementation code. If the design is the architecture review, the outline is the sprint planning. The plan is the coding agent's instructions.

## When Invoked

This skill supports two modes.

### Mode 1: Standard QRSPI outline

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read all files in `[plan_dir]/questions/`
   - Read `[plan_dir]/design.md`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path or design doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin.

### Mode 2: Direct outline mode (simple tasks)

Use this mode when the user has a clear, bounded task and wants to skip earlier QRSPI stages.

1. **If no plan directory path was provided, but the user gave a concrete task/ticket/description or referenced files**, do NOT stop and ask for prior QRSPI artifacts.
2. Run `~/dotfiles/spec_metadata.sh` to get:
   - git username
   - timestamp
   - repository metadata
3. Create a new plan directory under:
   - `thoughts/[git_username]/plans/YYYY-MM-DD_HH-MM-SS_[plan-slug]/`
4. Treat user-provided task + referenced files as source material.
5. Read all referenced files fully.
6. Read relevant codebase files needed to produce an accurate outline.
7. Write `outline.md` in the new plan directory.
8. If helpful, you may add lightweight supporting artifacts (`research/`, `design.md`) for your own structure, but this is optional.

### If no useful input was provided

If there is neither a plan directory/design path nor a concrete task/ticket/description, respond:

```
I'll create a structured outline.

Please provide either:
1. A QRSPI plan directory path or design doc path
   e.g. `/q-outline thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
   or `/q-outline thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/design.md`
2. Or a well-defined task/ticket/description
   e.g. `/q-outline Add per-agent timeout configuration in pkg/agents`
```

Then wait for input.

## Process

### Standard mode

1. **Verify artifacts are loaded**: all `questions/*.md`, `design.md`, all `research/*.md`, and any relevant files in `prds/`.
2. **Define the structural foundation** — types, interfaces, schemas, package structures.
3. **Break the approved approach into vertical slices.** Each slice must be independently testable.
4. **For each slice, define:**
   - Files to create or modify
   - Key signatures and types (what, not how)
   - Test checkpoint — how to verify this slice works
5. **Present the outline to the user** for review.
6. **Iterate** until approved, then write final outline.

### Direct-outline mode

1. Derive the structure from the concrete task + codebase reality.
2. Build sensible vertical slices in delivery order.
3. Include signatures/types and explicit test checkpoints.
4. Present to user for review, iterate, then write final outline.

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
[2-3 sentences. What we're building and the approved approach from design.md (or direct-task context in direct mode).]

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

When outline.md is written, use this exact response shape:

```
Artifact: [exact path to outline.md]
Summary: [brief summary of slices and their test checkpoints]
Next: /q-plan [exact path to outline.md]
```

You may add one extra sentence noting this is the last review gate before code.

**If the user responds with feedback** (slice reordering, missing pieces, scope changes), ask followup questions if helpful, do any additional research needed, update outline.md accordingly, then respond again with the same format above.

## Rules

- This is the structural backbone — longer than the design, shorter than the plan.
- **Vertical slices, not horizontal layers.**
- Show signatures and types, NOT full function bodies.
- Every slice must have a test checkpoint.
- Present to the user BEFORE writing the final file.
- In every user-facing completion response, use: `Artifact: ...`, `Summary: ...`, `Next: ...`.
