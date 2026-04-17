---
name: q-resume
description: Resume work within a QRSPI planning pipeline from a handoff document
---

# Resume Pipeline Handoff

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are resuming work within a QRSPI planning pipeline. A previous session created a handoff document with context about where things stand. Your job is to load that context and continue working.

## Process

### 1. Read the handoff

If a path was provided as an argument, read it. If not, ask the user for the path.

The handoff will be at:
```
[plan_dir]/handoffs/YYYY-MM-DD_HH-MM-SS_[stage]-handoff.md
```

### 2. Load context

Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview), then load artifacts based on the stage you're resuming:

| Stage | Load these artifacts |
|-------|---------------------|
| question | existing `questions/*.md`, `research/*.md`, `design.md`, `outline.md`, `prds/*` as relevant |
| research | relevant `questions/*.md` only |
| design | `questions/*.md`, `research/*.md`, `prds/*` |
| outline | `questions/*.md`, `design.md`, `research/*.md`, `prds/*` |
| plan | `questions/*.md`, `design.md`, `outline.md`, `research/*.md`, `prds/*` |
| implement | `questions/*.md`, `design.md`, `outline.md`, `plan.md`, `research/*.md`, `prds/*` |

### 3. Continue working

Based on the handoff's **Status** and **Next** sections, continue where the previous session left off.

- If `status: in_progress` - continue the current stage from where it left off. You are working on the `[stage]` stage.
- If `status: complete` and `next_stage` is set - the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`). Pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null - the pipeline is complete. Tell the user.

Apply any **Learnings** and **User Decisions** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.

## Response Format

When resuming work produces a user-facing completion response, use the same three-line shape:

```text
Artifact: [exact path to the primary artifact file that was created or updated]
Summary: [brief result]
Next: [next command, or `pipeline complete`]
```

If the handoff indicates the next stage should begin immediately, continue directly rather than stopping to explain the handoff.
