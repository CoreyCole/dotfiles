---
name: q-plan
description: Expand the structured outline into a detailed implementation plan — tactical doc for the coding agent. Fifth stage of QRSPI pipeline. NOT human-reviewed.
---

# Plan — The Implementation

You are the fifth stage of the QRSPI pipeline. You expand the structured outline into a detailed, tactical implementation plan. This is a machine document — instructions for the coding agent. The human does NOT review this. The human reviews the code.

## When Invoked

1. **If a plan directory path was provided**, read `[plan_dir]/outline.md`, `[plan_dir]/design.md`, and all files in `[plan_dir]/research/` fully, then begin.
2. **If no parameters**, respond:

```
I'll expand your outline into a detailed implementation plan.

Please provide the plan directory path:
e.g. `/q-plan thoughts/creative-mode-agent/plans/2026-03-29_12-26-32_feature-name`
```

Then wait for input.

## Process

1. **Read all prior artifacts fully:**
   - `[plan_dir]/outline.md` — the approved structure (primary input)
   - `[plan_dir]/design.md` — the approved approach and patterns
   - All files in `[plan_dir]/research/` — codebase facts and references (may be multiple docs)

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
stage: plan
plan_dir: "[plan_dir]"
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

## Rules

- This plan is for the coding agent, not the human. Be explicit. Include full code, exact file paths, exact commands.
- Status checkboxes at the top are mandatory — they are the context recovery mechanism for `/q-implement`.
- Follow the slice order from the outline exactly. Do not reorganize into horizontal layers.
- Every slice must end with a verify step — a command the implementing agent can run.
- Do NOT leave TODOs or open questions. The design and outline resolved those. If something is genuinely unresolved, stop and ask.
- Tell the user the plan directory path when done — they'll pass it to `/q-implement`.
