---
name: q-implement
description: Execute one implementation slice per invocation. Seventh stage of QRSPI pipeline. Load `plan.md` and optional `design-product.md`, update status checkboxes, and create per-slice handoffs as you go — they are your context recovery mechanism.
---

## QRSPI mode contract

- `autoMode=false`: stop at human gates; still emit valid `<qrspi-result>` and show validated advance button.
- `autoMode=true`: continue through human gates automatically unless `needs_human`, `blocked`, `error`, invalid artifact, disallowed transition, run failure, or XML retry exhaustion.
- `enablePlanReviews=true`: run planning `/q-review` after design, outline, and plan.
- `enablePlanReviews=false`: skip planning `/q-review`; final implementation `/q-review` always runs.
- Research never has its own human stop. Humans evaluate research in design/outline review.
- Emit the QRSPI XML footer as a fenced `xml` code block at the end of every completed QRSPI stage result so it is syntax highlighted.

## QRSPI XML summary contract

The `<summary>` element is used by humans to understand workflow state before asking follow-up questions or advancing. It must be structured, specific, self-contained, not a generic completion label. Use these child elements inside `<summary>`:

- `<plan-goal>`: overall plan/workflow goal in plain language; not just current stage label.
- `<stage-completed>`: what this stage/session did and how it moves toward the goal. Extremely concise; sacrifice grammar for concision.
- `<key-decisions>`: direction we are headed; significant tradeoffs, risks, open questions, follow-up, or why next step is safe. Use `None.` only when truly none.

Keep each child element short: 1-2 concise lines max.

For review stages, always include both: (1) what the entire implementation/plan now does as a whole, and (2) what this review session checked and changed. Do not write vague summaries like `review complete`, `implementation review result`, `done`, or `summary of findings` without the concrete details a human would need to ask informed questions.

## QRSPI footer instructions

When more than one artifact is relevant, keep `<artifact>` as the primary next-command artifact and also include `<artifacts>` with every important artifact path, including review records, done summaries, handoffs, ADRs, and follow-up questions.

Do not duplicate the same artifact/summary/next information in prose outside the XML. For normal QRSPI stage completion, the final response may be only the fenced `xml` `<qrspi-result>` block; make the XML `<summary>` comprehensive enough for humans.

Intermediate handoffs use `<stage>implement</stage>`, `<status>handoff</status>`, and `<next>/q-resume [handoff]</next>`. Final completion uses `<status>complete</status>` and `<next>/q-review [handoff]</next>`. For stage completion, emit only a fenced `xml` QRSPI footer; do not duplicate Implemented/Verification/Artifact/Next in prose.

```xml
<qrspi-result>
  <stage>implement</stage>
  <status>[handoff or complete]</status>
  <workspace>
[absolute path to the implementation workspace created by q-plan]
  </workspace>
  <policy>
    <autoMode>[latest known autoMode]</autoMode>
    <enablePlanReviews>[latest known enablePlanReviews]</enablePlanReviews>
    <invalidResultRetryLimit>[latest known invalidResultRetryLimit or 1]</invalidResultRetryLimit>
  </policy>

  <summary>
    <plan-goal>[Overall plan/workflow goal.]</plan-goal>
    <stage-completed>[What this stage/session did; how it moves toward the goal.]</stage-completed>
    <key-decisions>[Direction, tradeoffs, risks, open questions, follow-up, or why next step is safe.]</key-decisions>
  </summary>
  <artifact>
[exact path to handoff.md]
  </artifact>
  <next>
[/q-resume or /q-review] [exact path to handoff.md]
  </next>
</qrspi-result>
```

# Implement — Execute the Plan

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the seventh stage of the QRSPI pipeline. You execute exactly one unchecked slice per invocation, update status checkboxes, create a handoff after every verified slice, and then stop. Each slice should leave the engineer with a concrete, reviewable/testable increment: code diff, behavior, verification command, and artifact/handoff evidence. Only after **all slices are complete** may the final handoff send implementation to `/q-review`, which writes the canonical implementation review artifact to `[plan_dir]/reviews/`. Never prompt for review after an intermediate slice. The plan and the handoffs are your roadmap and your recovery mechanism when the context window resets.

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

1. **Use the implementation workspace created by `/q-plan`:**

   - Normal parent-plan implementation must run inside the absolute workspace path recorded by `/q-plan` in the latest QRSPI `<workspace>` element and in `plan.md`'s `Implementation Workspace Prep` section.
   - Do not create another fresh copy during `/q-implement` for a normal parent plan. If the recorded workspace path is missing, inaccessible, dirty in an unexpected way, or does not contain `[plan_dir]/plan.md`, stop and ask rather than silently creating a second implementation copy.
   - Never use `git worktree` for `/q-implement` work.
   - If invoked from the planning/source checkout, switch to the recorded workspace before branch setup and code edits.
   - Do not run `just sync-thoughts` from the implementation workspace just to sync planning docs. `/q-plan` syncs thoughts after creating the plan, and `/q-review` syncs after modifying planning docs and copies updates into the workspace.
   - Exception: if `plan_dir` is an implementation-review follow-up plan under `[parent_plan_dir]/reviews/*_implementation-review/` and has its own `design.md`/`outline.md`/`plan.md`, do **not** make another fresh workspace/copy for review fixes. Reuse the original implementation copy/checkout from the parent plan so review-fix branches stack on top of the already-reviewed implementation.
   - For review-dir follow-up plans, find the original implementation copy from the parent plan handoffs/review artifacts or current cwd. If it is unavailable, stop and ask for the original implementation directory; do not create a second copy that would fork the stack.
   - After switching to the recorded workspace, run `git status --short`, identify the repository, and apply that repository's submission model before editing.
   - **cn-agents model:** if the repository is `cn-agents` or its `AGENTS.md` says it commits directly to `main`, do not run `gt log`, `gt track`, `gt create`, or `gt modify`. Stay on `main` in the fresh implementation workspace and use `git commit` for each slice that changes tracked files. The workspace path is the isolation boundary; slice branches are not used.
   - **Graphite model:** only in repos that use Graphite (for example the Chestnut monorepo), run `gt log short`. If the current branch appears in the Graphite stack, do not run `gt track`; if Graphite does not recognize a plain copied branch, run `gt track` before `gt modify`/`gt create`.

1. **Set up the repository submission target before editing code:**

   - First determine whether the current repo uses the `cn-agents` direct-`main` model or the Graphite model. Do not assume Graphite just because this is QRSPI implementation work.
   - For `cn-agents`, do not create a branch for any slice. Stay on `main` in the recorded fresh workspace, commit completed slices directly with `git commit`, and record the commit hash in the handoff. If you are not on `main`, stop and ask before editing.
   - For Graphite repos, create a Graphite branch only for a slice that will introduce tracked source/test/doc changes.
   - In Graphite repos, if `plan_dir` is a timestamped implementation review directory under `[parent_plan_dir]/reviews/*_implementation-review/`, this is follow-up implementation work. Reuse the original implementation copy and create follow-up slice branches stacked on top of the already-reviewed implementation head with `gt create <linear-slug>_review_plan_slice-N`; do not overwrite, reuse, or fork away from the parent implementation slice branches.
   - Verification-only slices (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits) do **not** get their own branch. Run them in the current implementation workspace/current top branch. If they pass, mark the slice complete and hand off to review; GitHub/Graphite cannot create PRs for empty branches.
   - Graphite repos only: before Slice 1 edits, if `git branch --show-current` is `develop`, create the Slice 1 branch **from `develop`**.
   - Graphite repos only: before Slice N edits, be on the Slice N branch only when Slice N has planned tracked edits. If you are still on the previous slice branch and Slice N has planned tracked edits, run `gt create <linear-slug>_slice-N` before editing.
   - Graphite repos only: if a verification-only slice fails and needs a code fix, put the fix on the branch that owns the broken change (usually the current top branch via `gt modify`; use `gt modify --into <branch>` only after explicit user confirmation).
   - Graphite repos only: use the Linear ticket's canonical branch slug from the Linear CLI / ticket context, not an ad-hoc name.
   - Graphite repos only: match the plan's slice terminology in the suffix: use `slice-N`, not `phase-N`.
   - Example Graphite stack: `cc/pro-8910-flow-2-compliance-hold-license-validation-node-level_slice-1` -> `cc/pro-8910-flow-2-compliance-hold-license-validation-node-level_slice-2`.
   - Graphite repos only: do not keep committing later edit slices onto an earlier `slice-N` branch.
   - Do not create placeholder branches for future or verification-only slices in any repo.
   - Graphite repos only: do not rename the branch away from the Linear slug unless the user explicitly asks.
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
     h. Commit the slice if tracked source/test/doc changes were made, using the exact `### Commit Message` block dictated in that slice of `plan.md`. Do not improvise or omit the body; the commit body must be XML wrapped in `<qrspi-commit>`. Use the repo's commit mechanism: `git commit` on `main` for `cn-agents`, Graphite commit/modify commands only for Graphite repos. If the slice changed tracked files but has no dictated commit message, update `plan.md` first to add one in the required format. For a verification-only slice with no tracked changes, do not commit and do not create an empty branch.
     i. If additional edit slices remain unchecked after this slice, create the next slice branch only for Graphite repos and only when the next slice has planned tracked edits: run `gt create <linear-slug>_slice-(N+1)` from the just-committed Slice N branch so the next edit slice is stacked on top. For `cn-agents`, do not create a next-slice branch; leave the workspace on `main`. Then create a checkpoint handoff via `/q-handoff` (no argument). This is mandatory; do not stop after only updating `plan.md`. Do **not** mention `/q-review` yet.
     j. If only verification-only slices remain, do not pre-create a branch for them. Create a checkpoint handoff via `/q-handoff` with `Next` pointing to `/q-resume`; the resumed agent will run the verification-only slice in the current implementation workspace.
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

1. Confirm you are in the implementation workspace recorded by `/q-plan` and not a `git worktree`. For normal parent-plan implementation, use the recorded workspace path from the latest QRSPI `<workspace>` element or `plan.md`'s `Implementation Workspace Prep`; do not recreate it unless the user explicitly approves replacement. For implementation-review follow-up plans under `reviews/*_implementation-review/`, use the original implementation copy/checkout from the parent plan; do not create a second fresh copy for review fixes.
1. Read `[plan_dir]/AGENTS.md`
1. Read `[plan_dir]/design-product.md` if present
1. Read `[plan_dir]/plan.md`
1. Read the newest implement-stage handoff in `[plan_dir]/handoffs/` if one exists
1. Read the newest relevant context artifact in `[plan_dir]/context/implement/` if one exists
1. Use the status checkboxes to find the next unchecked slice, and the latest handoff/context artifact to recover the exact verified checkpoint
1. Execute only that next slice

This is why the checkboxes and handoffs exist. Keep them updated.

## Response

After completing a slice, create the required `/q-handoff` artifact first, then emit only the fenced `xml` `<qrspi-result>` footer described above. Do not include separate `Implemented:`, `Verification:`, `Artifact:`, or `Next:` prose lines.

For non-final implementation slices, `<artifact>` must be the newly created implement handoff file and `<next>` must be `/q-resume [exact handoff path]`. For the final implementation slice, `<artifact>` must be the final completion handoff file and `<next>` must be `/q-review [exact handoff path]`. Put what changed, engineer-test/review instructions, verification commands/results, slice status, and next-step rationale in the XML `<summary>` and `<artifacts>` as needed.

## Rules

- Implement exactly one slice per invocation. Never roll directly into the next slice after finishing one.
- Every implementation and review-fix slice should be independently reviewable/testable by the engineer. Include the diff/branch context, behavior to inspect, and exact verification/manual test command or UI scenario in the handoff/XML summary.
- Always do `/q-implement` work in the fresh filesystem copy created by `/q-plan` and recorded in `<workspace>` / `plan.md`. Never use `git worktree`.
- Do not create a second normal implementation copy in `/q-implement`; stop and ask if the recorded workspace is missing or unusable.
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving on. Vertical slices exist so you catch problems early.
- Never do `/q-implement` coding work on `develop`. In Graphite repos, if you start on `develop`, first run `gt create <linear-branch-name>` using the ticket's canonical Linear slug and a `slice-N` suffix that matches the plan. In `cn-agents`, implementation work should be in the recorded fresh workspace on `main`; if you are not on `main`, stop and ask.
- Commit after each successful slice that changed tracked files. Use the exact commit message dictated by the slice's `### Commit Message` block in `plan.md`; it must include the workspace name and slice in the subject and an XML body wrapped in `<qrspi-commit>` with `<workspace>`, `<slice number="N">`, and `<artifacts>` containing exact `<design>`, `<outline>`, and `<plan>` paths. In `cn-agents`, use `git commit` directly on `main` inside the fresh workspace. In Graphite repos, prefer `gt modify --commit --no-interactive -m "$(cat /tmp/slice-commit-message.txt)"` or equivalent non-interactive command so Graphite does not wait for an editor or prompt.
- Do not commit or branch for verification-only slices with no tracked changes.
- For implementation-review follow-up plans under `reviews/*_implementation-review/`, do not create a new fresh copy; stack fixes in the original implementation copy. In Graphite repos, branch names must make the stacked review plan clear: `gt create <linear-slug>_review_plan_slice-N`. In `cn-agents`, keep using direct commits on `main` in that same original implementation copy. Each review-fix slice must give the engineer a small focused fix to review/test on top of the original implementation stack.
- After each non-final edit slice commit, create the next slice branch only in Graphite repos: `gt create <linear-slug>_slice-(N+1)` for normal parent plans, or `gt create <linear-slug>_review_plan_slice-(N+1)` for implementation-review follow-up plans, only when the next slice has planned tracked edits. In `cn-agents`, never create slice branches; continue on `main` in the same fresh workspace. If the next slice is verification-only, do not create a placeholder branch.
- After each successful slice, create the appropriate handoff via `/q-handoff` before stopping. This is mandatory.
- Do not prompt for review until all slices are complete.
- For non-final slices, do not end with `plan.md` as the primary artifact and do not suggest `/q-implement [plan_dir]` as the canonical next step. The canonical next step is `/q-resume [new handoff path]`.
- When implementation is complete, the completion handoff must target `/q-review` and summarize the finished implementation, not just the last slice.
- End every successful slice response with only the required fenced `xml` `<qrspi-result>` footer; put implementation, verification, artifact, and next-step details in the XML `<summary>`, `<artifact>`, `<artifacts>`, and `<next>` elements.
- Include `<workspace>` immediately after `<status>` in implementation result XML, using the absolute workspace path created by `/q-plan`.
- Never push or open a pull request as part of this skill unless the user explicitly asks for it.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
