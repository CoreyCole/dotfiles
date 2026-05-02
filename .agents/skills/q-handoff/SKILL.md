---
name: q-handoff
description: Create a handoff document to carry context forward within a QRSPI planning pipeline. Use "continue" arg to advance to the next stage; implement completion hands off to `/q-review` only after all slices are complete.
---

# Create Pipeline Handoff

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are creating a handoff document to preserve your working context within a QRSPI planning pipeline. This handoff will be used by a future session to continue working on the same stage, or to pick up at the next stage.

**Handoff mode is stop-work mode.** Once this skill is invoked, do not continue implementation, debugging, refactoring, verification fixes, or artifact edits in the current session. Reads and status/inspection commands are allowed only to gather accurate context for the handoff. The priority is to pass the important context, risks, current state, and next-edit instructions to the next agent so that agent can resume code changes in a fresh session.

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

`review` is the post-implementation handoff target, not a core planning stage. Only when `implement` is fully complete should `continue` create a review-ready handoff and point to `/q-review`. Intermediate implementation checkpoints must stay on `/q-resume`. `/q-review` writes the canonical review artifact to `[plan_dir]/reviews/`.

## When to use

- Before context reset mid-stage (no argument)
- At end of a stage before handing off (`continue`)
- Any time you want a checkpoint

## Process

### 0. Stop editing and inspect only

- Stop all implementation work immediately.
- Do **not** edit code, tests, generated files, stage artifacts, or plans while creating the handoff.
- Do **not** fix lint/test failures discovered during handoff creation; record them clearly for the next agent.
- Use read-only inspection (`git status`, `git diff`, `git log`, file reads, test output already available) to understand what needs to be handed off.
- The only required write is the handoff document itself. Update `[plan_dir]/AGENTS.md` only when a durable gotcha is critical for future sessions and cannot be safely captured in the handoff alone.

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
  - For `implement`, use this only when all implementation slices are complete; then set `next_stage: review` and point the user directly to `/q-review`.
- checkpoint: set `status: in_progress`
  - Use this for any non-final implementation slice so the next step remains `/q-resume`.

### 4. Refresh long-term memory only if essential

Prefer recording new context in the handoff. Update `[plan_dir]/AGENTS.md` only if this stage uncovered durable context that future agents should remember before reading any handoff, such as:

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

Use this exact response shape:

```
Implemented: [one concise line describing what was completed or checkpointed]
Verification: [relevant verification evidence if known, or `not run` with a short reason]
Artifact: [exact path to handoff file]
Next: [/q-resume or /q-review] [exact path to handoff file] — [what happens next]
```

Line requirements:

- `Implemented:` must be specific to the work captured in the handoff.
- `Verification:` must include relevant verification evidence when known. If no verification applies for the stage, say `not run` and why.
- `Next:` must include both the exact resume/review command and a short description of what happens next.
- For checkpoint mode, mention the current stage checkpoint and the concrete work that remains next.
- For `continue` mode from `question` through `plan`, mention the completed stage and the next stage that `/q-resume` should start.
- For `continue` mode from `implement`, mention what was implemented, the verification evidence if known, and that review is next.
- Do **not** use generic lines like `Implemented: stage complete`, `Implemented: checkpoint saved`, or `Implemented: implementation complete` without describing the actual work.

Next routing:

- For `continue` mode from `implement`, use `/q-review`.
- For all other handoffs, use `/q-resume`.

Never abbreviate paths.
