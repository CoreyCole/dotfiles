---
name: q-workspace
description: Prepare or repair the QRSPI implementation workspace after `/q-review [plan.md]` succeeds and before `/q-implement`. Use to create copied workspaces, sync reviewed plan dirs, choose the correct base branch/main vs unmerged parent stack, and prevent lost Graphite work.
---

# QRSPI Workspace Prep

Create/repair the implementation workspace after final planning review. This is the gate between `/q-review [plan.md]` and `/q-implement [plan.md]`. For implementation-review follow-up plans under `reviews/*_implementation-review/`, do **not** create a separate workspace; repair/sync the same original implementation workspace that was reviewed and stack follow-up work directly on top of the reviewed implementation head.

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute implementation workspace when known]</workspace>
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

`status` is lifecycle. `outcome` selects the graph branch. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

## Load

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Resolve `plan_dir` from the given `plan.md` or directory.
1. Read `[plan_dir]/AGENTS.md`, `[plan_dir]/plan.md`, newest `[plan_dir]/reviews/*_plan-review/review.md`, and parent plan artifacts if `plan_dir` is under `reviews/*_implementation-review/`.
1. Run `~/dotfiles/spec_metadata.sh` before writing/updating artifacts.

## Base selection

Determine `workspace_base` before copying anything:

| Case | Base |
|---|---|
| Normal parent plan that explicitly continues the current unmerged Graphite stack | current stack top branch/commit |
| Normal parent plan and prior implementation stack is merged | latest `origin/main` (or repo trunk) |
| Normal parent plan and no prior implementation stack exists | latest `origin/main` |
| Review-fixes/follow-up plan under `[parent]/reviews/*_implementation-review/` | same original implementation workspace that was reviewed; base/current branch must be the reviewed implementation head or a descendant |

For normal parent plans, do not assume `origin/main`/trunk is safe just because the plan is not under an implementation-review directory. First determine whether the work intentionally builds on the current checkout's unmerged Graphite stack by checking the user request, `plan.md` workspace section, `AGENTS.md`, current branch name, `gt branch info`, `gt parent`, and PR/stack metadata. If yes, the workspace must be contiguous with that stack: submit/sync the source stack first, then base the target workspace on the current stack top branch/commit, not trunk.

For review-fixes plans, first find the original implementation workspace from the parent plan's handoffs/review XML/artifacts or `plan.md` workspace section. Reuse that exact workspace. Then find the reviewed implementation head from the implementation handoff/review artifacts, local branches, and Graphite metadata. Verify the workspace is currently at that reviewed head or a descendant:

```bash
git merge-base --is-ancestor <reviewed_head_commit> HEAD
```

Review follow-up plans must stack on top of the implementation they reviewed even if that implementation has already merged to trunk. Do not fork review-plan branches from fresh `main`/trunk, and do not fast-forward the workspace past the reviewed head unless doing so preserves it as an ancestor. If the reviewed head is missing, stop and ask rather than creating a replacement workspace.

In Graphite repos, including `cn-agents`, the first review-plan slice branch created later by `/q-implement` must have `gt parent` equal to the reviewed implementation top branch (or the current descendant branch that already contains it). This applies to review-fix plans regardless of merge state. Normal continuation plans still use the selected unmerged stack top when they deliberately build on an existing stack.

## No-work-loss checks

Before creating or repairing a workspace:

- Run `git status --short` in the source checkout and any existing target workspace.
- If an existing workspace has tracked changes, untracked files outside the synced `plan_dir`, or local commits not recorded in the plan/review, stop and ask.
- Never delete or replace an existing workspace automatically.
- Never use `git worktree`.
- If the base branch/commit exists only in another copied workspace, copy from that workspace or fetch/cherry-pick only after proving the commit is reachable. Do not silently start from `main`.
- For Graphite continuation work, run `gt stack submit --no-interactive` (or repo-approved submit equivalent) in the source checkout before preparing the target workspace so `gt get` can recover the exact stack top remotely.

## Create or repair workspace

For normal new workspaces, write workspace metadata before copying so the copy starts clean at the post-sync commit. For implementation-review follow-up plans, skip new workspace creation and repair/sync the original implementation workspace only:

1. Choose a workspace path, normally a sibling directory named `[repo]-[plan timestamp]_[slug]`. For implementation-review follow-up plans, this must be the existing original implementation workspace path, not a new sibling copy.
1. Determine the selected base from the source checkout before writing metadata. For normal plans this is latest `origin/main` unless deliberately continuing an unmerged stack. For implementation-review follow-up plans, the selected base is the reviewed implementation head in the original implementation workspace, or a current descendant that preserves that head as an ancestor.
1. Ensure `[plan_dir]/AGENTS.md` exists before copying the workspace.
   - If `[plan_dir]` is a nested plan directory (for example `reviews/*_implementation-review/`) and has no local `AGENTS.md`, create one by copying/adapting the nearest parent plan `AGENTS.md`.
   - The nested `AGENTS.md` must clearly state that this directory is its own QRSPI workspace root and must reference the nested artifacts in that exact directory:
     - `[plan_dir]/design.md` when present
     - `[plan_dir]/design-product.md` when present
     - `[plan_dir]/outline.md` when present
     - `[plan_dir]/plan.md`
   - Do not leave the nested plan relying only on the parent `AGENTS.md`; the scheduled plan-workspace sync uses the local marker to discover nested plan workspaces.
1. Update `[plan_dir]/plan.md` `Implementation Workspace Prep` and `[plan_dir]/AGENTS.md` with:
   - absolute workspace path
   - selected base branch/commit used for the base decision
   - whether parent stack was already merged into main
   - for review-fixes plans, reviewed implementation head and expected Graphite parent for first review-plan slice
   - exact reason this base preserves the reviewed implementation and prevents lost work
1. Run `just sync-thoughts` in the planning/source checkout.
1. Re-read the source checkout HEAD after `just sync-thoughts`. For normal new workspaces, this post-sync HEAD is the actual copied workspace commit because it contains the workspace-prep metadata. State the exact post-sync HEAD in the XML summary.
1. If no workspace exists:
   - For `origin/main` base: copy the canonical main checkout after it is clean and at the post-`just sync-thoughts` HEAD.
   - For implementation-review follow-up plans: stop and ask for the original implementation workspace that was reviewed. Do not create a new copy or substitute a fresh trunk checkout.
   - For unmerged stack base: copy a checkout that has Graphite configured, then run `gt get --no-interactive <stack_top_branch>` in the target workspace when the branch is remote/submitted. If the branch is only local and cannot be submitted, copy the checkout that contains the stack top branch/commit, then checkout that branch/commit after proving reachability. Sync or rsync only the plan directory metadata without rebasing away the stack top.
1. If workspace exists and is safe: update it to the selected/post-sync base only if doing so does not discard changes or remove the reviewed implementation head from ancestry; otherwise stop. For Graphite continuation or implementation-review follow-up work, repair by running `gt get --no-interactive <reviewed_or_stack_top_branch>` in the same original workspace when needed, not by resetting to trunk and not by creating a second copy.
   - In `cn-agents-*` implementation copies, use `gt sync --no-interactive` to fast-forward trunk metadata; do not use `git pull`, `git merge`, or `git rebase`.
   - Do not rsync changed plan docs into an existing `cn-agents-*` workspace before syncing it to the commit that already contains those docs, or Graphite may correctly refuse the sync due to conflicting unstaged changes.
1. Use `rsync -a [source]/[plan_dir]/ [workspace]/[plan_dir]/` only after the workspace is at the correct base, or when repairing an existing safe workspace whose base intentionally differs from the source commit.
1. In the workspace, verify:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
test -f [plan_dir]/AGENTS.md
gt parent  # Graphite repos when base is an unmerged stack
test -f [plan_dir]/plan.md
```

If this is a nested/review-fix plan, also verify the workspace copy's `[plan_dir]/AGENTS.md` references the nested plan artifacts, not only the parent plan artifacts.

If the selected base is an unmerged stack, do not create an implementation branch unless needed to repair stack state. If you do create or find the first new slice branch, run `gt parent` and verify it points at the selected stack top branch.

## Update artifacts

The metadata update happens before copying for new workspaces. For repairs to an existing safe workspace, update artifacts, run `just sync-thoughts`, update/sync the workspace safely, then rsync `[plan_dir]/` only after the workspace base is correct.

Record:

- absolute workspace path
- `workspace_base` branch and commit
- whether parent stack was already merged into main/trunk, or whether this is a normal continuation of an unmerged stack
- for review-fix/follow-up plans, reviewed implementation head and expected Graphite parent for the first new review-plan slice
- for any normal unmerged-stack base, expected Graphite parent for the first new implementation slice
- exact reason this base prevents lost work and keeps workspaces/branches contiguous

Because a commit cannot reliably record its own hash inside tracked docs, distinguish:

- selected base: branch/commit used for the safety decision before workspace metadata sync
- actual workspace HEAD: post-sync commit copied or fast-forwarded into the workspace, reported exactly in the result XML

## Result XML

Emit only fenced XML:

```xml
<qrspi-result>
  <stage>workspace</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <workspace>[absolute workspace path]</workspace>
  <policy>
    <autoMode>false</autoMode>
    <enablePlanReviews>true</enablePlanReviews>
    <invalidResultRetryLimit>1</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall goal]</plan-goal>
    <stage-completed>[workspace created/repaired and plan synced]</stage-completed>
    <key-decisions>Base: [branch@commit]. Reason: [merged into main OR unmerged/continuation stack, expected gt parent].</key-decisions>
  </summary>
  <artifact>[plan_dir]/plan.md</artifact>
  <next>/q-implement [plan_dir]/plan.md</next>
</qrspi-result>
```

## Rules

- `/q-workspace` is mandatory after successful `/q-review [plan.md]` and before `/q-implement`.
- The XML summary must state the chosen base branch/commit and why.
- For review-fixes plans, never create a second workspace and never assume `main` is safe. Use the original implementation workspace that was reviewed, and prove the reviewed implementation head is still an ancestor of the workspace branch where follow-up slices will stack.
- For normal continuation plans, never assume trunk is safe. If the work builds on the current unmerged Graphite stack, submit/sync that stack and make the target workspace contiguous with the stack top via `gt get`.
- Prefer stopping over risking lost work.
