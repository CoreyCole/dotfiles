---
name: q-handoff
description: Create a handoff document to carry context forward within a QRSPI planning pipeline. Use "continue" arg to advance to the next stage; implement completion hands off to `/q-review` only after all slices are complete.
---

# Create Pipeline Handoff

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute active QRSPI plan/ticket directory before q-workspace; absolute fresh implementation workspace after q-workspace]</workspace>
  <workspaceMetadata>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk, or empty when not applicable]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the just-finished branch/chunk, or empty when not applicable]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify, or current git branch]</currentBranch>
  </workspaceMetadata>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall goal]</plan-goal>
    <stage-completed>[specific work completed]</stage-completed>
    <key-decisions>[decisions, risks, follow-up, or why next step is safe]</key-decisions>
  </summary>
  <artifact>thoughts/...</artifact>
  <artifacts>
    <artifact role="related">thoughts/...</artifact>
  </artifacts>
  <next>[display/debug command matching the graph]</next>
</qrspi-result>
```

`status` is lifecycle. `outcome` selects the graph branch. `<workspace>` is always required: before `/q-workspace`, set it to the absolute active QRSPI plan/ticket directory where the next planning stage should run; after `/q-workspace`, set it to the absolute fresh implementation workspace. `<workspaceMetadata>` records branch context for humans and runtime handoff/debugging: `trunkBranch` is usually `main`; `stackBottomBranch` is the lowest Graphite branch above trunk; `parentBranch` is the branch immediately below the chunk of work just completed; `currentBranch` is the branch created/updated for the chunk. Use empty elements when not in a Graphite repo or the value is unknowable. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

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
| 4 | design-product | `/q-design-product` | `design-product.md` |
| 5 | outline | `/q-outline` | `outline.md` |
| 6 | plan | `/q-plan` | `plan.md` |
| 7 | implement | `/q-implement` | code changes |

`review` is the post-implementation handoff target, not a core planning stage. Only when `implement` is fully complete should `continue` create a review-ready handoff and point to `/q-review`. Intermediate implementation checkpoints must stay on `/q-resume`. `/q-review` writes the canonical review artifact to `[plan_dir]/reviews/`.

Implementation handoffs must not create branches. If the next implementation work is verification-only (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits), record that it should run in the current implementation workspace/current top branch instead of creating a placeholder branch. GitHub/Graphite cannot create PRs for empty branches.

Implementation handoffs must also preserve the fresh-directory rule: never use `git worktree`; `/q-implement` and `/q-resume` implementation work happens in a fresh filesystem copy named `[repo-name]_[plan-dir-basename]`, where `[plan-dir-basename]` is the final directory name of the active QRSPI plan directory. Record the current implementation directory when known, or instruct the next agent to create one with macOS `cp -ac source-dir clean-copy-dir` or Linux `cp -a --reflink=auto source-dir clean-copy-dir` before editing. The fresh workspace is the isolation boundary; do not assume a branch should exist.

Implementation handoffs must record the repository submission model and current state, not redefine implementation policy. For `cn-agents`, write explicitly: implementation uses a fresh workspace plus Graphite slice branches; record the current branch/commit, whether the next work has tracked edits, and that final integration uses `/cn-agents-merge`. For other Graphite repos, record the current branch/commit and whether the next work has tracked edits. `/q-resume` loads `q-implement` for exact branch and commit rules.

Implementation handoffs should be created only after the implementation agent has run the completed work's `just check ...` command for the changed Go/templ files so formatting/lint issues are cleaned up before handoff. This lint cleanup requirement applies only to the implementation phase; do not run implementation lint/build cleanup during question, research, design, outline, or plan handoffs.

Implementation handoffs must record branch/commit state, not define commit-message policy. For implementation stages, point the next agent back to `/q-resume [handoff]`; `/q-resume` loads `q-implement` for the current branch and commit rules. For tracked-edit Graphite work, the implementation agent should create/modify the branch first, then write the handoff on that branch so it can record final `currentBranch`, `parentBranch`, `stackBottomBranch`, and `trunkBranch`; the handoff is then staged and amended into the same commit with `gt modify --no-interactive`. Record any commit command already run, current branch, commit hash, what completed, what next work is, and whether next work has planned tracked edits. Do not amend solely to chase the final self-referential commit hash inside the handoff; the final branch-head hash is reported in the QRSPI XML footer.

## When to use

- Before context reset mid-stage (no argument)
- At end of a stage before handing off (`continue`)
- Any time you want a checkpoint

## Process

### 0. Stop editing and inspect only

- Stop all implementation work immediately.
- Do **not** edit code, tests, generated files, stage artifacts, or plans while creating the handoff.
- Do **not** fix lint/test failures discovered during handoff creation; record them clearly for the next agent.
- For implementation-stage handoffs, if the completed work's `just check ...` verification/lint cleanup was not run before entering handoff mode, record that gap clearly instead of starting new fixes during handoff creation. This does not apply to planning-stage handoffs.
- Use read-only inspection (`git status`, `git diff`, `git log`, file reads, test output already available) to understand what needs to be handed off.
- The only required write is the handoff document itself. Update `[plan_dir]/AGENTS.md` only when a durable gotcha is critical for future sessions and cannot be safely captured in the handoff alone.

### 1. Gather metadata

Run `~/dotfiles/spec_metadata.sh` and use it as the source of truth for the handoff filename timestamp and frontmatter fields (`date`, `researcher`, `branch`, `repository`). For `git_commit`, use the current hash for read-only/planning handoffs or already-committed implementation checkpoints. For tracked-edit implementation handoffs, run this after `gt create`/`gt modify` so `branch` is the current implementation branch. If the handoff will be amended into the current commit, use the current pre-handoff branch hash and note that the branch is amended after handoff creation; do not try to embed the final hash of the same commit inside itself.

For implementation-stage QRSPI XML, also gather workspace branch metadata after any `gt create` / `gt modify` is complete:

- `currentBranch`: `git branch --show-current`
- `parentBranch`: branch immediately below the just-created/current implementation branch in `gt log short` (or `gt parent` when it reports the stack parent)
- `stackBottomBranch`: lowest Graphite branch above trunk in `gt log short`
- `trunkBranch`: trunk branch from the bottom of `gt log short`, usually `main`

If Graphite is unavailable or this is a verification-only/no-branch checkpoint, preserve the current branch and use empty elements for unknown Graphite-only values.

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
  - Use this for any non-final implementation checkpoint so the next step remains `/q-resume`.

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
git_commit: [current commit hash; for implementation handoffs amended into the current commit, use the pre-handoff branch hash and note the final hash is reported in XML]
branch: [current branch]
repository: [repository name]
stage: [question|research|design|design-product|outline|plan|implement]
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
status: [in_progress|complete]
next_stage: [next stage name, `review`, or null if in_progress or pipeline complete]
---

# [Stage] Handoff

## Status
[What completed and what remains. For implementation handoffs, describe completed work by behavior/files/outcome, not by slice number. Describe next work by behavior/files/outcome, and state whether it has planned tracked edits or is verification-only/no-branch. Also state the repo submission model: `cn-agents` workspace Graphite branches + `/cn-agents-merge`, or other Graphite stacked branches.]

## Working Directory
[For implementation handoffs: exact fresh implementation directory path if known, confirm it is not a git worktree, and record the current branch. If this is `cn-agents`, explicitly say tracked edit slices happen on Graphite slice branches in this workspace, not direct `main`; final integration is `/cn-agents-merge`. If unknown, instruct the next agent to use the `/q-plan`-created fresh copy named `[repo-name]_[plan-dir-basename]` before editing. For non-implementation handoffs: omit or say not applicable.]

## Learnings
[Important findings not fully captured in artifacts, with file:line references where relevant.]

## User Decisions
[User approvals/rejections/changes that matter downstream.]

## Context Artifacts
[Exact paths to relevant context files under `[plan_dir]/context/` that the next session should load first.]

## Verification
[Relevant verification evidence when known, or `not run` with a short reason. For implementation handoffs, include the `just check ...` command run for changed Go/templ files, plus any focused tests. Planning-stage handoffs do not need implementation lint/build cleanup.]

## Next
[Specific instructions for the next session. For implementation handoffs, say what was completed and what concrete work is next; do not identify work by slice number. Include whether the next work has tracked edits, current branch/commit state, and that `/q-resume` should continue under `q-implement` rules. If this handoff was amended into the current branch, say the handoff frontmatter hash is the pre-handoff branch hash and the final branch-head hash is in the prior QRSPI XML result / `git rev-parse --short HEAD`. For implement-complete handoffs, tell the reviewer what to review first, which verification evidence already passed, and that final `cn-agents` integration uses `/cn-agents-merge` after review.]
```

### 6. Sync

For non-implementation stages, run `just sync-thoughts` from the normal source checkout.

For implementation handoffs from a fresh copied repo, first check the current branch:

```bash
git branch --show-current
git status --short
```

Hard rule: do **not** run `just sync-thoughts` from a Graphite slice branch when the handoff must be published to canonical hosted thoughts. The repo script only pulls/pushes on `main`; on slice branches it formats and commits thought changes locally, then skips pull/push, leaving the handoff stranded in the implementation copy.

For `cn-agents`, implementation handoffs are normally created inside the fresh implementation workspace on the current Graphite branch and travel with that branch stack. Mention the current branch, what completed, what next work is, whether next work has tracked edits, and `/cn-agents-merge` as the final integration command after implementation/review. Do not require the workspace to be on `main` for implementation handoffs.

For Graphite repos, if the copy is still on a slice branch, do not fake hosted sync success. Record the handoff as written locally and report that canonical thoughts sync is blocked until a `main` checkout can run `just sync-thoughts` or the handoff is copied to the canonical source checkout.

Before claiming the handoff is synced, verify the handoff was committed on the current implementation slice branch, was copied/synced to the canonical thoughts checkout, or was already pushed by `just sync-thoughts`. For `cn-agents`, do not claim canonical integration until `/cn-agents-merge` brings the slice stack back to `main`.

### 7. Tell the user

Emit a fenced XML `<qrspi-result>` block followed by the mandatory concise human summary when the handoff completes or stops a runtime node. Preserve the current stage, policy, workspace, and primary handoff artifact. Do not emit the old prose `Implemented:` / `Verification:` / `Artifact path:` / `Next command:` shape.

For checkpoint handoffs that should not advance the runtime graph, write the handoff artifact and use `/q-resume [handoff.md]` in normal chat context; do not emit a completed workflow-node result. If the runtime must stop, use a supported lifecycle status such as `needs_human`, `blocked`, or `error`, omit `<outcome>`, and still include `<workspace>` immediately after `<status>`.

For final implementation handoffs that should start implementation review, emit:

```xml
<qrspi-result>
  <stage>implement</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <workspace>[absolute implementation workspace]</workspace>
  <workspaceMetadata>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the completed implementation branch]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify]</currentBranch>
  </workspaceMetadata>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall workflow goal]</plan-goal>
    <stage-completed>[implementation completed and final handoff written]</stage-completed>
    <key-decisions>[verification evidence and why implementation review is safe]</key-decisions>
  </summary>
  <artifact>thoughts/.../handoffs/YYYY-MM-DD_HH-MM-SS_implementation-complete.md</artifact>
  <next>/q-review thoughts/.../handoffs/YYYY-MM-DD_HH-MM-SS_implementation-complete.md</next>
</qrspi-result>
```

Line-quality requirements still apply inside `<summary>`:

- `<workspace>` must be present: absolute active plan/ticket directory for planning handoffs, absolute fresh implementation workspace for implementation handoffs.
- `<workspaceMetadata>` must be present. For implementation handoffs after Graphite branch creation, fill `trunkBranch`, `stackBottomBranch`, `parentBranch`, and `currentBranch`; for non-Graphite/planning contexts, include empty elements except `currentBranch` when known.
- `<stage-completed>` must describe the actual work, not generic `stage complete`.
- `<key-decisions>` must include verification evidence when known, or say why verification was not run.
- Never abbreviate artifact paths.

Next routing:

- For `continue` mode from `implement`, use `/q-review` in XML `<next>`.
- For all other handoffs, use `/q-resume` in XML `<next>`.

Never abbreviate paths.
