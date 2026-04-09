---
name: q-plan
description: Expand the structured outline into a detailed implementation plan — tactical doc for the coding agent. Fifth stage of QRSPI pipeline. NOT human-reviewed.
---

# Plan — The Implementation

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the fifth stage of the QRSPI pipeline. You expand the structured outline into a detailed, tactical implementation plan. This is a machine document — instructions for the coding agent. The human does NOT review this. The human reviews the code.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/questions.md`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/outline.md`
   - Read all files in `[plan_dir]/research/`
1. **If a plan directory path was provided**, load the artifacts above, then begin.
2. **If no parameters**, respond:

```
I'll expand your outline into a detailed implementation plan.

Please provide the plan directory path:
e.g. `/q-plan thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0: `questions.md`, `design.md`, `outline.md`, and all `research/*.md` files.

2. **Read key files from the codebase** that the outline references — you need to see the actual code to write accurate implementation steps.

3. **Expand each slice** from the outline into detailed implementation steps:
   - Full file paths for every change
   - Actual code to write (function bodies, not just signatures)
   - Test code
   - Commands to verify each slice

4. **Add status checkboxes** at the top — these are the context recovery mechanism. When the implementing agent's context window resets, it reloads this file and the checkboxes tell it where to pick up.

5. **Write the plan** directly. No human review step — alignment already happened in design and outline.

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

When plan.md is written, respond to the user with the **full file path** (not just the directory):

```
Plan written to thoughts/[git_username]/plans/[timestamp]_[plan-name]/plan.md

[number] slices ready for implementation.

Start implementation with:

/q-implement thoughts/[git_username]/plans/[timestamp]_[plan-name]
```

Always include the complete `thoughts/.../plan.md` path. Never abbreviate to just the directory.

No human review of the plan — alignment already happened in design and outline. The human reviews the code.

## Rules

- This plan is for the coding agent, not the human. Be explicit. Include full code, exact file paths, exact commands.
- Status checkboxes at the top are mandatory — they are the context recovery mechanism for `/q-implement`.
- Follow the slice order from the outline exactly. Do not reorganize into horizontal layers.
- Every slice must end with a verify step — a command the implementing agent can run.
- Do NOT leave TODOs or open questions. The design and outline resolved those. If something is genuinely unresolved, stop and ask.
