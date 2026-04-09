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
| question | (none — you're producing questions.md) |
| research | `questions.md` only |
| design | `questions.md`, `research/*.md` |
| outline | `questions.md`, `design.md`, `research/*.md` |
| plan | `questions.md`, `design.md`, `outline.md`, `research/*.md` |
| implement | `questions.md`, `design.md`, `outline.md`, `plan.md`, `research/*.md` |

### 3. Continue working

Based on the handoff's **Status** and **Next** sections, continue where the previous session left off.

- If `status: in_progress` - continue the current stage from where it left off. You are working on the `[stage]` stage.
- If `status: complete` and `next_stage` is set - the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`). Pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null - the pipeline is complete. Tell the user.

Apply any **Learnings** and **User Decisions** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.
