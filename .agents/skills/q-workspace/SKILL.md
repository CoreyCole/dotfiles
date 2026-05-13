---
name: q-workspace
description: Prepare or repair the QRSPI implementation workspace after `/q-review [plan.md]` succeeds and before `/q-implement`. Use to create copied workspaces, sync reviewed plan dirs, choose the correct base branch/main vs unmerged parent stack, and prevent lost Graphite work.
---

# QRSPI Workspace Prep

Create/repair the implementation workspace after final planning review. This is the gate between `/q-review [plan.md]` and `/q-implement [plan.md]`.

## Load

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Resolve `plan_dir` from the given `plan.md` or directory.
1. Read `[plan_dir]/AGENTS.md`, `[plan_dir]/plan.md`, newest `[plan_dir]/reviews/*_plan-review/review.md`, and parent plan artifacts if `plan_dir` is under `reviews/*_implementation-review/`.
1. Run `~/dotfiles/spec_metadata.sh` before writing/updating artifacts.

## Base selection

Determine `workspace_base` before copying anything:

| Case | Base |
|---|---|
| Normal parent plan and prior implementation stack is merged | latest `origin/main` (or repo trunk) |
| Normal parent plan and no prior implementation stack exists | latest `origin/main` |
| Review-fixes/follow-up plan under `[parent]/reviews/*_implementation-review/` and parent implementation top is merged into main | latest `origin/main`, which must contain the parent top commit |
| Review-fixes/follow-up plan and parent implementation top is **not** merged | parent implementation stack top branch/commit |

For review-fixes plans, find parent stack top from the parent plan's handoffs/review artifacts, `plan.md` workspace section, local branches, and Graphite metadata. Verify with Git:

```bash
git merge-base --is-ancestor <parent_top_commit> origin/main
```

- exit 0: parent stack already merged; base on latest `origin/main`.
- nonzero: parent stack unmerged; base on `<parent_top_branch>`/`<parent_top_commit>`.

In Graphite repos, including `cn-agents`, if the parent stack is unmerged then the first review-fix slice branch created later by `/q-implement` must have `gt parent` equal to the parent stack's top branch. Do not fork review fixes from `main` in that case.

## No-work-loss checks

Before creating or repairing a workspace:

- Run `git status --short` in the source checkout and any existing target workspace.
- If an existing workspace has tracked changes, untracked files outside the synced `plan_dir`, or local commits not recorded in the plan/review, stop and ask.
- Never delete or replace an existing workspace automatically.
- Never use `git worktree`.
- If the base branch/commit exists only in another copied workspace, copy from that workspace or fetch/cherry-pick only after proving the commit is reachable. Do not silently start from `main`.

## Create or repair workspace

1. Run `just sync-thoughts` in the planning/source checkout after review edits.
1. Choose a workspace path, normally a sibling directory named `[repo]-[plan timestamp]_[slug]`.
1. If no workspace exists:
   - For `origin/main` base: copy the canonical main checkout after it is at latest `origin/main`.
   - For unmerged parent stack base: copy the checkout that contains the parent top branch/commit, then checkout that branch/commit.
1. If workspace exists and is safe: update it to the selected base only if doing so does not discard changes; otherwise stop.
1. `rsync -a [source]/[plan_dir]/ [workspace]/[plan_dir]/`.
1. In the workspace, verify:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
test -f [plan_dir]/plan.md
```

If this is an unmerged review-fixes plan, do not create an implementation branch unless needed to repair stack state. If you do create or find a review-fix branch, run `gt parent` and verify it points at the parent stack top branch.

## Update artifacts

Update `[plan_dir]/plan.md` `Implementation Workspace Prep` and `[plan_dir]/AGENTS.md` with:

- absolute workspace path
- `workspace_base` branch and commit
- whether parent stack was already merged into main
- for review-fixes plans, expected Graphite parent for first review-fix slice
- exact reason this base prevents lost work

Run `just sync-thoughts`, then rsync `[plan_dir]/` into the workspace again.

## Result XML

Emit only fenced XML:

```xml
<qrspi-result>
  <stage>workspace</stage>
  <status>complete</status>
  <workspace>[absolute workspace path]</workspace>
  <policy>
    <autoMode>false</autoMode>
    <enablePlanReviews>true</enablePlanReviews>
    <invalidResultRetryLimit>1</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall goal]</plan-goal>
    <stage-completed>[workspace created/repaired and plan synced]</stage-completed>
    <key-decisions>Base: [branch@commit]. Reason: [merged into main OR unmerged parent stack, expected gt parent].</key-decisions>
  </summary>
  <artifact>[plan_dir]/plan.md</artifact>
  <next>/q-implement [plan_dir]/plan.md</next>
</qrspi-result>
```

## Rules

- `/q-workspace` is mandatory after successful `/q-review [plan.md]` and before `/q-implement`.
- The XML summary must state the chosen base branch/commit and why.
- For review-fixes plans, never assume `main` is safe. Prove the parent implementation top is merged first.
- Prefer stopping over risking lost work.
