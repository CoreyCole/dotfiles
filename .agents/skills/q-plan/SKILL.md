---
name: q-plan
description: Expand the structured outline into a detailed implementation plan — tactical doc for the coding agent. Fifth stage of QRSPI pipeline. NOT human-reviewed.
---

# Plan — The Implementation

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the fifth stage of the QRSPI pipeline. You expand the structured outline into a detailed, tactical implementation plan. This is a machine document — instructions for the coding agent. The human does NOT review this. Human alignment happened in design, outline, and the outline `/q-review`; the human reviews the code again after implementation.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/AGENTS.md`
   - Read all files in `[plan_dir]/questions/`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/outline.md`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/research/`
   - Read all files in `[plan_dir]/context/design/`
   - Read all files in `[plan_dir]/context/outline/`
   - Read all files in `[plan_dir]/context/plan/` if any
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path or outline doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin.
2. **If no parameters**, respond:

```
I'll expand your outline into a detailed implementation plan.

Please provide the plan directory path or outline doc path:
e.g. `/q-plan thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-plan thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/outline.md`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0: `[plan_dir]/AGENTS.md`, all `questions/*.md`, `design.md`, `outline.md`, all `research/*.md`, relevant context artifacts in `context/research/`, `context/design/`, `context/outline/`, and `context/plan/`, and any relevant files in `prds/`.

2. **Read key files from the codebase** that the outline references — you need to see the actual code to write accurate implementation steps.
   - If the current file graph, entry points, or nearby patterns are still unclear, run `codebase-locator` and, if needed, `codebase-analyzer`, then write timestamped artifact(s) under `[plan_dir]/context/plan/` before finalizing the plan.

3. **Expand each slice** from the outline into detailed implementation steps:
   - Full file paths for every change
   - Actual code to write (function bodies, not just signatures)
   - Test code
   - Commands to verify each slice

4. **Add status checkboxes** at the top — these are the context recovery mechanism. When the implementing agent's context window resets, it reloads this file and the checkboxes tell it where to pick up.

5. **If the plan locks in durable sequencing changes, invariants, or implementation caveats that future implementers/reviewers should remember first, update `[plan_dir]/AGENTS.md`.**
   - Keep it short and curated.
   - Point back to `plan.md`, `outline.md`, or code paths instead of copying the whole plan.

6. **Immediately before writing or updating `plan.md`, gather metadata** with `~/dotfiles/spec_metadata.sh` and use it to populate the frontmatter fields.

7. **Write the plan** directly. No human review step — alignment already happened in design and outline.

## Output Template

Write to `[plan_dir]/plan.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: plan
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# Implementation Plan: [Feature Name]

## Status
- [ ] Slice 1: [Name]
- [ ] Slice 2: [Name]
- [ ] Slice 3: [Name]
...

## Slice 1: [Name]

### Files
- `path/to/file.ext` (new)
- `path/to/other.ext` (modify)

### Changes

**`path/to/file.ext`** (new):
[Full implementation code]

**`path/to/other.ext`** (modify):
[Specific changes with enough surrounding context to locate the edit]

### Tests
**`path/to/test_file.ext`**:
[Test code]

### Verify
[Command to run to confirm this slice works]

---

## Slice 2: [Name]
...
```

## Response

When plan.md is written, use this exact response shape:

```
Artifact: [exact path to plan.md]
Summary: [number] slices ready for implementation.
Next: /q-implement [exact path to plan.md]
```

Always include the complete `thoughts/.../plan.md` path. Never abbreviate to just the directory.

No human review of the plan — alignment already happened in design, outline, and outline review. The human reviews the code.

## Rules

- This plan is for the coding agent, not the human. Be explicit. Include full code, exact file paths, exact commands.
- Status checkboxes at the top are mandatory — they are the context recovery mechanism for `/q-implement`.
- Follow the slice order from the outline exactly. Do not reorganize into horizontal layers.
- Every slice must end with a verify step — a command the implementing agent can run.
- Do NOT leave TODOs or open questions in the final plan. If something is genuinely unresolved, stop and ask.
- In every user-facing completion response, use the same three-line shape: `Artifact: ...`, `Summary: ...`, `Next: ...`.
