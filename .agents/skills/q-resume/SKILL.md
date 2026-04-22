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
| question | `[plan_dir]/AGENTS.md`, existing `questions/*.md`, relevant `context/question/*.md`, `research/*.md`, `design.md`, `outline.md`, `prds/*` as relevant |
| research | relevant `questions/*.md`, relevant `context/research/*.md` |
| design | `[plan_dir]/AGENTS.md`, `questions/*.md`, `research/*.md`, `adrs/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md` |
| outline | `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, `research/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md`, `context/outline/*.md` |
| plan | `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, `outline.md`, `research/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md`, `context/outline/*.md`, `context/plan/*.md` |
| implement | `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, `outline.md`, `plan.md`, `research/*.md`, `prds/*`, relevant `context/plan/*.md`, latest relevant `context/implement/*.md` |

### 3. Continue working

Based on the handoff's **Status** and **Next** sections, continue where the previous session left off.

- If `status: in_progress` - continue the current stage from where it left off. You are working on the `[stage]` stage.
- If `status: complete` and `next_stage` is set - the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`; if `next_stage: review`, run `/q-review`). For `review`, prefer passing the exact implement handoff path you just read. For other stages, pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null - the pipeline is complete. Tell the user.

Apply any **Learnings**, **User Decisions**, and referenced **Context Artifacts** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.

## Response Format

When resuming work produces a user-facing completion response, use the same three-line shape:

```text
Artifact: [exact path to the primary artifact file that was created or updated]
Summary: [brief result]
Next: [next command, or `pipeline complete`]
```

If the handoff indicates the next stage should begin immediately, continue directly rather than stopping to explain the handoff.
