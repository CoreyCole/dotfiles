---
name: q-resume-handoff
description: Resume work within a QRSPI planning pipeline from a handoff document
---

# Resume Pipeline Handoff

You are resuming work within a QRSPI planning pipeline. A previous session created a handoff document with context about where things stand. Your job is to load that context and continue working.

## Process

### 1. Read the handoff

If a path was provided as an argument, read it. If not, ask the user for the path.

The handoff will be at:
```
[plan_dir]/handoffs/YYYY-MM-DD_HH-MM-SS_[stage]-handoff.md
```

### 2. Load stage artifacts

Based on the `stage` field in the handoff frontmatter, read the relevant artifacts from the plan directory:

| Stage | Read these |
|-------|-----------|
| question | (nothing yet — you're producing questions.md) |
| research | `questions.md` |
| design | `questions.md`, `research/*.md` |
| outline | `design.md`, `research/*.md` |
| plan | `outline.md`, `design.md`, `research/*.md` |
| implement | `plan.md` |

### 3. Continue working

Based on the handoff's **Status** and **Next** sections, continue where the previous session left off.

- If `status: in_progress` — continue the current stage from where it left off. You are working on the `[stage]` stage.
- If `status: complete` and `next_stage` is set — the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`). Pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null — the pipeline is complete. Tell the user.

Apply any **Learnings** and **User Decisions** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.
