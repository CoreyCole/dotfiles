---
name: q-handoff
description: Create a handoff document to carry context forward within a QRSPI planning pipeline. Use "continue" arg to advance to the next stage.
---

# Create Pipeline Handoff

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`


You are creating a handoff document to preserve your working context within a QRSPI planning pipeline. This handoff will be used by a future session to continue working on the same stage, or to pick up at the next stage.

## Arguments

- **(no argument)** — checkpoint the current stage as `in_progress`. The next session resumes where you left off in the same stage.
- **`continue`** — mark the current stage as `complete` and direct the next session to proceed to the next QRSPI stage.

## Stage order

The QRSPI pipeline stages in order:

| # | Stage | Skill | Produces |
|---|-------|-------|----------|
| 1 | question | `/q-question` | `questions.md` |
| 2 | research | `/q-research` | `research/*.md` |
| 3 | design | `/q-design` | `design.md` |
| 4 | outline | `/q-outline` | `outline.md` |
| 5 | plan | `/q-plan` | `plan.md` |
| 6 | implement | `/q-implement` | code changes |

## When to use

- Before your context window resets mid-stage (no argument)
- At the end of a stage, before handing off to the next `/q-*` command (`continue`)
- Any time you want to checkpoint your progress within the pipeline

## Process

### 1. Gather metadata

Run `~/dotfiles/spec_metadata.sh` to get the current timestamp, git username, commit, and branch.

### 2. Identify the plan directory

The plan directory should already be known from the current session. It follows the pattern:
```
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
```

If you don't know it, ask the user.

### 3. Determine mode

- If the argument is `continue`: set `status: complete` and compute the next stage from the stage order table above. If the current stage is `implement`, there is no next stage — note "pipeline complete" in the Next section.
- Otherwise: set `status: in_progress`.

### 4. Write the handoff

Create the file at:
```
[plan_dir]/handoffs/YYYY-MM-DD_HH-MM-SS_[stage]-handoff.md
```

Where `[stage]` is the current pipeline stage: `question`, `research`, `design`, `outline`, `plan`, or `implement`.

Use this template:

```markdown
---
date: [ISO timestamp with timezone]
researcher: [git username]
git_commit: [current commit hash]
branch: [current branch]
stage: [question|research|design|outline|plan|implement]
status: [in_progress|complete]
next_stage: [next stage name, or null if in_progress or pipeline complete]
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# [Stage] Handoff

## Status

{What has been done in this stage and what remains. If the stage is complete, say so. If in progress, describe where you left off — e.g. "answered questions 1-4, questions 5-7 remain" or "user approved approach B, writing final design.md now".}

## Learnings

{Important things discovered during this stage that aren't captured in the artifact. Codebase surprises, patterns found, gotchas, user preferences expressed during review. Include file:line references where relevant.}

## User Decisions

{Decisions the user made during this stage — especially at design and outline review gates. What did they approve, reject, or modify? These are critical context that won't be in the artifact if the user gave verbal feedback you incorporated.}

## Next

{What the next session should do. Be specific.

If `continue` mode: state that the current stage is complete and direct the next session to run the next `/q-*` skill. Example: "Research stage complete. Run `/q-design` with `[plan_dir]` to begin the design stage."

If checkpoint mode: describe where you left off within the current stage. Example: "continue answering question 5" or "implement slice 3, slices 1-2 are done".}
```

Keep it concise. The artifacts (questions.md, research/*.md, design.md, etc.) carry the substance — the handoff carries the meta-context that isn't in them.

### 5. Sync

Run `just sync-thoughts` to save.

### 6. Tell the user

Always include the full `thoughts/...` path so the user can copy-paste the resume command directly.

If `continue` mode:
```
Stage [current] complete. Handoff created at [handoff_path].

Next stage: [next_stage] — resume with:

/q-resume thoughts/[git_username]/plans/[timestamp]_[plan-name]/handoffs/[handoff_filename]
```

If checkpoint mode:
```
Handoff created at [handoff_path]. Resume with:

/q-resume thoughts/[git_username]/plans/[timestamp]_[plan-name]/handoffs/[handoff_filename]
```
