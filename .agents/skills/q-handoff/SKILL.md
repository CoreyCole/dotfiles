---
name: q-handoff
description: Create a handoff document to carry context forward within a QRSPI planning pipeline. Use "continue" arg to advance to the next stage; implement completion hands off to `/q-review`.
---

# Create Pipeline Handoff

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are creating a handoff document to preserve your working context within a QRSPI planning pipeline. This handoff will be used by a future session to continue working on the same stage, or to pick up at the next stage.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)

## Arguments

- **(no argument)** — checkpoint the current stage as `in_progress`.
- **`continue`** — mark the current stage as `complete` and move to the next stage.

## Stage order

| # | Stage | Skill | Produces |
|---|-------|-------|----------|
| 1 | question | `/q-question` | `questions/*.md` |
| 2 | research | `/q-research` | `research/*.md` |
| 3 | design | `/q-design` | `design.md` |
| 4 | outline | `/q-outline` | `outline.md` |
| 5 | plan | `/q-plan` | `plan.md` |
| 6 | implement | `/q-implement` | code changes |

`review` is the post-implementation handoff target, not a core planning stage. When `implement` completes, `continue` should create a review-ready handoff and point to `/q-review`. `/q-review` writes the canonical review artifact to `[plan_dir]/reviews/`.

## When to use

- Before context reset mid-stage (no argument)
- At end of a stage before handing off (`continue`)
- Any time you want a checkpoint

## Process

### 1. Gather metadata

Run `~/dotfiles/spec_metadata.sh` and use it as the source of truth for the handoff filename timestamp and frontmatter fields (`date`, `researcher`, `git_commit`, `branch`, `repository`).

### 2. Identify the plan directory

Use the current plan directory:

```
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
```

If unknown, ask the user.

### 3. Determine mode

- `continue`: set `status: complete`, compute `next_stage`
  - For `question` through `plan`, point the user to `/q-resume` so the next QRSPI stage can begin.
  - For `implement`, set `next_stage: review` and point the user directly to `/q-review`.
- checkpoint: set `status: in_progress`

### 4. Refresh long-term memory if needed

Before writing the handoff, update `[plan_dir]/AGENTS.md` if this stage uncovered durable context that future agents should remember first:
- approved decisions or scope boundaries
- important tradeoffs or rejected paths
- non-obvious invariants, gotchas, or review learnings

Keep it curated. Do **not** dump transient notes or duplicate the full artifact.

### 5. Write the handoff

Create:

```
[plan_dir]/handoffs/YYYY-MM-DD_HH-MM-SS_[stage]-handoff.md
```

Use this template:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: [question|research|design|outline|plan|implement]
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
status: [in_progress|complete]
next_stage: [next stage name, `review`, or null if in_progress or pipeline complete]
---

# [Stage] Handoff

## Status
[What is done and what remains.]

## Learnings
[Important findings not fully captured in artifacts, with file:line references where relevant.]

## User Decisions
[User approvals/rejections/changes that matter downstream.]

## Context Artifacts
[Exact paths to relevant context files under `[plan_dir]/context/` that the next session should load first.]

## Next
[Specific instructions for the next session. For implement-complete handoffs, tell the reviewer what to review first and which verification evidence already passed.]
```

### 6. Sync

Run `just sync-thoughts`.

### 7. Tell the user

Use this exact response shape.

If `continue` mode for `question` through `plan`:

```
Artifact: [exact path to handoff file]
Summary: stage [current] complete.
Next: /q-resume [exact path to handoff file]
```

If `continue` mode for `implement`:

```
Artifact: [exact path to handoff file]
Summary: implementation complete. ready for review.
Next: /q-review [exact path to handoff file]
```

If checkpoint mode:

```
Artifact: [exact path to handoff file]
Summary: checkpoint saved for stage [current].
Next: /q-resume [exact path to handoff file]
```

Never abbreviate paths.
