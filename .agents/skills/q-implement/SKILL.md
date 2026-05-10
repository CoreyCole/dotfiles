---
name: q-implement
description: Execute one implementation slice per invocation. Seventh stage of QRSPI pipeline. Load `plan.md` and optional `design-product.md`, update status checkboxes, and create per-slice handoffs as you go — they are your context recovery mechanism.
---

# Implement — Execute the Plan

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the seventh stage of the QRSPI pipeline. You execute exactly one unchecked slice per invocation, update status checkboxes, create a handoff after every verified slice, and then stop. Only after **all slices are complete** may the final handoff send implementation to `/q-review`, which writes the canonical implementation review artifact to `[plan_dir]/reviews/`. Never prompt for review after an intermediate slice. The plan and the handoffs are your roadmap and your recovery mechanism when the context window resets.

Implementation is always handoff-driven. After every successful slice, the authoritative artifact is the new handoff document for that slice, and the canonical next command is `/q-resume [that handoff path]` until implementation is complete.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/AGENTS.md`
   - Read all files in `[plan_dir]/questions/`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/design-product.md` if present
   - Read `[plan_dir]/outline.md`
   - Read `[plan_dir]/plan.md`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/design-product/` if any
   - Read all files in `[plan_dir]/context/plan/`
   - Read the newest relevant files in `[plan_dir]/context/implement/` if any
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path or plan doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin from the first unchecked slice.
1. **If no parameters**, respond:

```
I'll implement the plan slice by slice.

Please provide the plan directory path or plan doc path:
e.g. `/q-implement thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-implement thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/plan.md`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0, including `[plan_dir]/AGENTS.md` and `plan.md`. `design-product.md` is optional. `plan.md` is your primary input. Check the status checkboxes and preserve product Critical Findings during implementation when `design-product.md` exists.

1. **Sync thoughts before making the fresh implementation copy:**

   - If this is the initial implementation start and you are still in the source checkout before creating/copying the implementation directory, run `just sync-thoughts` first so planning artifacts are formatted, committed, pulled/rebased, and synced on the source checkout before any implementation branch is created.
   - Do this before `gt create <slug>_slice-1` and before copying the repository. This keeps the copied repo from inheriting unsynced thought artifacts and avoids needing `just sync-thoughts` from an untracked fresh-copy branch later.
   - If you are resuming inside an existing fresh implementation copy, do not run `just sync-thoughts` there just to sync planning docs; record canonical thought updates in the handoff or sync from the source checkout after the implementation checkpoint.

1. **Set up a fresh implementation directory before editing code:**

   - Never use `git worktree` for `/q-implement` work.
   - Implementation must happen in a fresh filesystem copy of the repository whose directory name is associated with the plan directory or ticket slug.
   - If you are already inside the fresh copy for this plan/ticket, continue there. Otherwise create one next to the source checkout and switch into it before branch setup.
   - Derive the copy name from the Linear ticket slug when available; otherwise use the plan directory basename. Example: `repo-pro-8910-flow-2-compliance-hold-implement` or `repo-2026-03-29_12-26-32_feature-name-implement`.
   - macOS: `cp -ac source-dir clean-copy-dir`
   - Linux: `cp -a --reflink=auto source-dir clean-copy-dir`
   - After copying, run `git status --short` and `gt log short` in the fresh directory. If the current branch appears in the Graphite stack, do not run `gt track`; if Graphite does not recognize a plain copied branch, run `gt track` before `gt modify`/`gt create`.

1. **Set up the branch before editing code:**

   - Create a Graphite branch only for a slice that will introduce tracked source/test/doc changes.
   - If `plan_dir` is a timestamped implementation review directory under `[parent_plan_dir]/reviews/*_implementation-review/`, this is follow-up implementation work. Create follow-up slice branches stacked on top of the already-reviewed implementation head, using the existing ticket slug plus a review suffix such as `review-slice-N`; do not overwrite or reuse the parent implementation slice branches.
   - Verification-only slices (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits) do **not** get their own branch. Run them on the current top implementation branch. If they pass, mark the slice complete and hand off to review; GitHub cannot create PRs for empty branches.
   - Before Slice 1 edits: if `git branch --show-current` is `develop`, create the Slice 1 branch **from `develop`**.
   - Before Slice N edits: be on the Slice N branch only when Slice N has planned tracked edits. If you are still on the previous slice branch and Slice N has planned tracked edits, run `gt create <linear-slug>_slice-N` before editing.
   - If a verification-only slice fails and needs a code fix, put the fix on the branch that owns the broken change (usually the current top branch via `gt modify`; use `gt modify --into <branch>` only after explicit user confirmation).
   - Use the Linear ticket's canonical branch slug from the Linear CLI / ticket context, not an ad-hoc name.
   - Match the plan's slice terminology in the suffix: use `slice-N`, not `phase-N`.
   - Example stack: `cc/pro-8910-flow-2-compliance-hold-license-validation-node-level_slice-1` -> `cc/pro-8910-flow-2-compliance-hold-license-validation-node-level_slice-2`.
   - Do not keep committing later edit slices onto an earlier `slice-N` branch.
   - Do not create placeholder branches for future or verification-only slices.
   - Do not rename the branch away from the Linear slug unless the user explicitly asks.
   - Do not commit `/q-implement` work directly on `develop`.

1. **If one or more slices are unchecked, pick the first unchecked slice and execute only that slice in this invocation:**
   a. Read the files you're about to modify to confirm they match what the plan expects.
   b. If you need fresh orientation for this slice, run `codebase-locator` with a narrowly scoped task and, if needed, `codebase-analyzer` on the surfaced files or flow. Write the resulting timestamped artifact(s) under `[plan_dir]/context/implement/` before editing.
   c. Implement the changes described in the plan.
   d. Run the verify step for the slice.
   e. If verification fails, fix the issue. If you can't fix it, stop and tell the user.
   f. If verification passes, update the checkbox in `plan.md` from `[ ]` to `[x]`.
   g. If the slice surfaced durable decisions, tradeoffs, review learnings, or gotchas that future agents should remember first, update `[plan_dir]/AGENTS.md`.

   - Keep it short and curated.
   - Remove or rewrite stale bullets instead of appending contradictions.
     h. Commit the slice if tracked source/test/doc changes were made. For a verification-only slice with no tracked changes, do not commit and do not create an empty branch.
     i. If additional edit slices remain unchecked after this slice, run `gt create <linear-slug>_slice-(N+1)` from the just-committed Slice N branch so the next edit slice is stacked on top, then create a checkpoint handoff via `/q-handoff` (no argument). This is mandatory; do not stop after only updating `plan.md`. Do **not** mention `/q-review` yet.
     j. If only verification-only slices remain, do not pre-create a branch for them. Create a checkpoint handoff via `/q-handoff` with `Next` pointing to `/q-resume`; the resumed agent will run the verification-only slice on the current top branch.
     k. If this was the last unchecked slice, do the final verification pass, write a concise finished-implementation summary, and then create a review handoff via `/q-handoff continue`.
     l. Stop. Do **not** start the next slice in the same invocation.

1. **If all slices are already checked when you start**, do the final verification pass, create a review handoff via `/q-handoff continue`, and stop.

1. **If reality diverges from the plan** (file moved, API changed, pattern different):

   - Stop and present the mismatch clearly:
     ```
     Issue in Slice [N]:
     Expected: [what the plan says]
     Found: [actual situation]
     How should I proceed?
     ```
   - Update the plan with any deviations before continuing.

## Context Recovery

If your context window resets mid-implementation:

1. Confirm you are in the fresh implementation directory for this plan/ticket, not the original checkout and not a `git worktree`; if needed, recreate the fresh copy with `cp -ac` on macOS or `cp -a --reflink=auto` on Linux before continuing.
1. Read `[plan_dir]/AGENTS.md`
1. Read `[plan_dir]/design-product.md` if present
1. Read `[plan_dir]/plan.md`
1. Read the newest implement-stage handoff in `[plan_dir]/handoffs/` if one exists
1. Read the newest relevant context artifact in `[plan_dir]/context/implement/` if one exists
1. Use the status checkboxes to find the next unchecked slice, and the latest handoff/context artifact to recover the exact verified checkpoint
1. Execute only that next slice

This is why the checkboxes and handoffs exist. Keep them updated.

## Response

After completing a slice, create the required `/q-handoff` artifact first, then respond with one concise handoff block:

- Use separate `Implemented:`, `Verification:`, and `Next:` lines instead of compressing everything into a single summary.
- `Implemented:` says what changed or, for an already-complete plan, what implementation is now complete.
- `Verification:` includes the verify command(s) and concise pass result.
- `Artifact:` gives the exact handoff file path.
- `Next:` says what should happen next and includes the `/q-resume` or `/q-review` command with the exact handoff file path.
- For a non-final slice, mention the slice number or name and make `Next:` resume implementation from the handoff.
- For the final slice or an already-complete plan, summarize the finished implementation as a whole and make `Next:` start review.
- Keep each line short and concrete.
- Do **not** use generic lines like `Implemented: checkpoint saved for stage implement` or `Implemented: implementation complete` without the actual work.
- Do **not** add any text after the `Next:` line.

Expected response shape:

For non-final implementation slices, `Artifact:` must be the newly created implement handoff file and `Next:` must be `/q-resume [exact handoff path]`.
For the final implementation slice, `Artifact:` must be the final completion handoff file and `Next:` must be `/q-review [exact handoff path]`.

Expected ending shape:

```text
Implemented: [what was implemented or what implementation is complete]
Verification: [verify command(s) and concise pass result]
Artifact: [exact path to handoff file]
Next: [/q-resume or /q-review] [exact path to handoff file] — [what happens next]
```

For a non-final slice, `Next:` must point to `/q-resume`, not `/q-review`. For the final slice or an already-complete plan, `Next:` must point to `/q-review`, not `/q-resume`.

Do not include a `PR:` line unless the user explicitly asked you to open one.

## Rules

- Implement exactly one slice per invocation. Never roll directly into the next slice after finishing one.
- Before the initial fresh copy/implementation branch, run `just sync-thoughts` in the source checkout so planning artifacts are synced on main/upstream before implementation branches are created.
- Always do `/q-implement` work in a fresh filesystem copy named for the plan directory or ticket slug. Never use `git worktree`.
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving on. Vertical slices exist so you catch problems early.
- Never do `/q-implement` coding work on `develop`. If you start on `develop`, first run `gt create <linear-branch-name>` using the ticket's canonical Linear slug and a `slice-N` suffix that matches the plan.
- Commit after each successful slice that changed tracked files. Small, working commits. In agent sessions, prefer `gt modify --commit --no-interactive -m "..."` so Graphite does not wait for an editor or prompt.
- Do not commit or branch for verification-only slices with no tracked changes.
- For implementation-review follow-up plans under `reviews/*_implementation-review/`, branch names should make the stacked review follow-up clear, for example `<linear-slug>_review-slice-N`.
- After each non-final edit slice commit, create the next slice branch with `gt create <linear-slug>_slice-(N+1)` for normal parent plans, or `gt create <linear-slug>_review-slice-(N+1)` for implementation-review follow-up plans, only when the next slice has planned tracked edits. If the next slice is verification-only, do not create a placeholder branch.
- After each successful slice, create the appropriate handoff via `/q-handoff` before stopping. This is mandatory.
- Do not prompt for review until all slices are complete.
- For non-final slices, do not end with `plan.md` as the primary artifact and do not suggest `/q-implement [plan_dir]` as the canonical next step. The canonical next step is `/q-resume [new handoff path]`.
- When implementation is complete, the completion handoff must target `/q-review` and the `Implemented:` line must summarize the finished implementation, not just the last slice.
- End every successful slice response with the `Implemented:`/`Verification:`/`Artifact:`/`Next:` handoff block and nothing after it.
- Never push or open a pull request as part of this skill unless the user explicitly asks for it.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
