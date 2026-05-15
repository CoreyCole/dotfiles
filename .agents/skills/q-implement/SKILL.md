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

Runtime completion for the `implement` node happens only when implementation is ready for automated implementation review. Use `<status>complete</status>`, `<outcome>complete</outcome>`, the final implementation-complete handoff as `<artifact>`, and `<next>/q-review [handoff]</next>`. For non-final checkpoint handoffs, write the handoff artifact but do not present it as a completed workflow-node result unless intentionally stopping with `blocked`/`needs_human`.

```xml
<qrspi-result>
  <stage>implement</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <workspace>
[absolute path to the implementation workspace created/repaired by q-workspace]
  </workspace>
  <policy>
    <autoMode>[latest known autoMode]</autoMode>
    <enablePlanReviews>[latest known enablePlanReviews]</enablePlanReviews>
    <invalidResultRetryLimit>[latest known invalidResultRetryLimit or 1]</invalidResultRetryLimit>
  </policy>

  <summary>
    <plan-goal>[Overall plan/workflow goal.]</plan-goal>
    <stage-completed>[Implementation completed and final handoff written.]</stage-completed>
    <key-decisions>[Verification evidence and why implementation review is safe.]</key-decisions>
  </summary>
  <artifact>
[exact path to final implementation-complete handoff.md]
  </artifact>
  <next>
/q-review [exact path to final implementation-complete handoff.md]
  </next>
</qrspi-result>
```

# Implement — Execute the Plan

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must end with only a fenced `xml` block containing `<qrspi-result>`. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

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

1. **Use the implementation workspace created or repaired by `/q-workspace`:**

   - Implementation must run inside the absolute workspace path recorded by `/q-workspace` in the latest QRSPI `<workspace>` element and in `plan.md`'s `Implementation Workspace Prep` section.
   - Do not create another fresh copy during `/q-implement`. If the recorded workspace path is missing, inaccessible, dirty in an unexpected way, or does not contain `[plan_dir]/plan.md`, stop and ask rather than silently creating a second implementation copy.
   - Never use `git worktree` for `/q-implement` work.
   - If invoked from the planning/source checkout, switch to the recorded workspace before branch setup and code edits.
   - Do not run `just sync-thoughts` from the implementation workspace just to sync planning docs. `/q-workspace` syncs reviewed planning docs and copies them into the workspace.
   - For review-dir follow-up plans under `[parent_plan_dir]/reviews/*_implementation-review/`, verify `/q-workspace` selected a base that preserves the parent implementation stack. If the parent stack was unmerged, the current workspace branch/commit must be the parent stack top before creating review-fix slice branches.
   - After switching to the recorded workspace, run `git status --short`, identify the repository, and apply that repository's submission model before editing.
   - **cn-agents model:** if the repository is `cn-agents`, use the prepared workspace as the isolation boundary, then use Graphite slice branches inside it. For each tracked edit slice, implement and verify on the current base/top branch, then use `gt create ..._slice-N` (normal plans) or `gt create ..._review_plan_slice-N` (review-fixes plans) to create the slice branch and commit after you have the full slice context. Leave final integration to `/cn-agents-merge`. Do not commit QRSPI implementation slices directly to `main`. If this is a review-fixes plan and the parent stack is unmerged, run `gt parent` after branch creation and verify it equals the parent implementation top branch recorded by `/q-workspace`.
   - **Graphite model:** only in repos that use Graphite (for example the Chestnut monorepo), run `gt log short`. If the current branch appears in the Graphite stack, do not run `gt track`; if Graphite does not recognize a plain copied branch, run `gt track` before `gt modify`/`gt create`.

1. **Set up the repository submission target before editing code:**

   - First determine whether the current repo is `cn-agents` or another Graphite/trunk-based repo. Do not assume direct-to-main just because the implementation is in a fresh workspace; `cn-agents` uses Graphite slice branches in that workspace.
   - For `cn-agents` and other Graphite repos, do **not** pre-create the next slice branch before making edits. Implement the slice on the current base/top branch, run verification, update the plan/handoff docs, then run `gt create <slug>_slice-N` (or review-plan variant) with the final conventional commit message. This lets the implementing agent write the commit after seeing the complete diff and verification results.
   - If you are already on an existing matching slice branch for this slice (for example after recovering from a partial attempt), continue there and use `gt modify` to update the slice commit instead of creating a duplicate branch.
   - Verification-only slices (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits) do **not** get their own branch. Run them in the current implementation workspace/current top branch. If they pass, mark the slice complete and hand off to review; GitHub/Graphite cannot create PRs for empty branches.
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
     h. Create the required implementation handoff **before committing** so the handoff travels in the same slice commit. For Graphite edit slices created after implementation, set handoff frontmatter `git_commit` to `pending-slice-commit` (or the current pre-slice base hash plus an explanatory note), not to a self-referential final hash. The final branch-head hash belongs in the QRSPI XML response after commit.
     i. Commit the slice if tracked source/test/doc changes were made. In `cn-agents` and other Graphite repos, create the slice branch at this point with `gt create <slug>_slice-N -m "$(cat /tmp/slice-commit-message.txt)"` (or the repo's non-interactive equivalent); if already on the matching slice branch, use `gt modify --no-interactive -m "$(cat /tmp/slice-commit-message.txt)"` to amend the current slice commit. Do **not** use `gt modify --commit` for post-create handoff/content fixes; `gt modify` amends by default and `--commit` creates an additional commit. Do not run `gt create` before the slice is implemented, verified, and the handoff is written. For a verification-only slice with no tracked changes, do not commit and do not create an empty branch.
     j. Commit messages must follow Conventional Commits 1.0.0: `<type>[optional scope]: <description>` as the subject, optional explanatory body, then footer section. Include the QRSPI XML as a footer after a blank line, wrapped in `<qrspi-commit>` and containing `<workspace>`, `<slice number="N">`, and `<artifacts>` entries for exact `<design>`, `<outline>`, and `<plan>` paths. If the slice's `### Commit Message` block is missing, non-conventional, or lacks the XML footer, update `plan.md` before committing.
     k. After `gt create`/`gt modify`, capture the final branch-head hash with `git rev-parse --short HEAD` for the response XML only. Do not amend solely to replace `pending-slice-commit` in the handoff; putting the commit's own final hash inside the same commit is impossible without changing the hash again.
     l. If additional edit slices remain unchecked after this slice, do **not** pre-create the next branch. The checkpoint handoff should tell the next `/q-resume` agent to implement the next edit slice on the current top branch and run `gt create <slug>_slice-(N+1)` only after that slice is implemented and verified. Do **not** mention `/q-review` yet.
     m. If only verification-only slices remain, do not pre-create a branch for them. The checkpoint handoff should point to `/q-resume`; the resumed agent will run the verification-only slice in the current implementation workspace.
     n. If this was the last unchecked slice, do the final verification pass, write a concise finished-implementation summary, and create a review handoff via `/q-handoff continue` before committing that final edit slice or, for verification-only completion, without a new commit.
     o. Stop. Do **not** start the next slice in the same invocation.

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

1. Confirm you are in the implementation workspace recorded by `/q-workspace` and not a `git worktree`. Use the recorded workspace path from the latest QRSPI `<workspace>` element or `plan.md`'s `Implementation Workspace Prep`; do not recreate it unless the user explicitly approves replacement. For implementation-review follow-up plans under `reviews/*_implementation-review/`, verify the workspace base preserves the parent implementation stack as recorded by `/q-workspace`.
1. Read `[plan_dir]/AGENTS.md`
1. Read `[plan_dir]/design-product.md` if present
1. Read `[plan_dir]/plan.md`
1. Read the newest implement-stage handoff in `[plan_dir]/handoffs/` if one exists
1. Read the newest relevant context artifact in `[plan_dir]/context/implement/` if one exists
1. Use the status checkboxes to find the next unchecked slice, and the latest handoff/context artifact to recover the exact verified checkpoint
1. Execute only that next slice

This is why the checkboxes and handoffs exist. Keep them updated.

## Response

After completing a slice, create the required `/q-handoff` artifact first. Do not include separate `Implemented:`, `Verification:`, `Artifact path:`, or `Next command:` prose lines.

For non-final implementation slices, write the handoff artifact and stop in normal chat context; do not emit a completed workflow-node XML result, because the runtime `implement` node should not advance until all slices are done. For the final implementation slice, emit the fenced XML footer described above with `<stage>implement</stage>`, `<status>complete</status>`, `<outcome>complete</outcome>`, the final completion handoff as `<artifact>`, and `<next>/q-review [exact handoff path]</next>`. Put what changed, engineer-test/review instructions, verification commands/results, slice status, and next-step rationale in the XML `<summary>` and `<artifacts>` as needed.

## Rules

- Implement exactly one slice per invocation. Never roll directly into the next slice after finishing one.
- Every implementation and review-fix slice should be independently reviewable/testable by the engineer. Include the diff/branch context, behavior to inspect, and exact verification/manual test command or UI scenario in the handoff/XML summary.
- Always do `/q-implement` work in the fresh filesystem copy created/repaired by `/q-workspace` and recorded in `<workspace>` / `plan.md`. Never use `git worktree`.
- Do not create a second normal implementation copy in `/q-implement`; stop and ask if the recorded workspace is missing or unusable.
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving on. Vertical slices exist so you catch problems early.
- Never do `/q-implement` coding work on `develop`. In Graphite repos, including `cn-agents`, do not pre-create slice branches before implementation. Start from the current base/top branch, implement and verify the slice, then create the slice branch with `gt create <slug>_slice-N` (or modify the existing matching slice branch) using the plan/ticket slug and a `slice-N` suffix that matches the plan.
- Commit after each successful slice that changed tracked files. Use a Conventional Commit subject (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, etc.), optional body, and QRSPI XML footer. The footer must be wrapped in `<qrspi-commit>` with `<workspace>`, `<slice number="N">`, and `<artifacts>` containing exact `<design>`, `<outline>`, and `<plan>` paths. In `cn-agents` and other Graphite repos, prefer `gt create <slug>_slice-N -m "$(cat /tmp/slice-commit-message.txt)"` after implementation/verification/handoff creation, or `gt modify --no-interactive -m "$(cat /tmp/slice-commit-message.txt)"` when already on the matching slice branch. Remember: `gt modify` amends by default; `gt modify --commit` creates a new commit and is usually wrong for fixing the current slice.
- Do not commit or branch for verification-only slices with no tracked changes.
- For implementation-review follow-up plans under `reviews/*_implementation-review/`, do not create a new fresh copy; stack fixes in the original implementation copy. In Graphite repos, including `cn-agents`, branch names must make the stacked review plan clear: `gt create <slug>_review_plan_slice-N`. Each review-fix slice must give the engineer a small focused fix to review/test on top of the original implementation stack.
- After each non-final edit slice commit, do not create the next slice branch. The next `/q-resume` agent owns the next slice context and will run `gt create <slug>_slice-(N+1)` or `gt create <slug>_review_plan_slice-(N+1)` only after implementing and verifying that next slice. If the next slice is verification-only, no branch is created.
- After each successful slice, create the appropriate handoff via `/q-handoff` before stopping. This is mandatory.
- Do not prompt for review until all slices are complete.
- For non-final slices, do not end with `plan.md` as the primary artifact and do not suggest `/q-implement [plan_dir]` as the canonical next step. The canonical next step is `/q-resume [new handoff path]`.
- When implementation is complete, the completion handoff must target `/q-review` and summarize the finished implementation, not just the last slice.
- End every successful slice response with only the required fenced `xml` `<qrspi-result>` footer; put implementation, verification, artifact, and next-step details in the XML `<summary>`, `<artifact>`, `<artifacts>`, and `<next>` elements.
- Include `<workspace>` immediately after `<status>` in implementation result XML, using the absolute workspace path created/repaired by `/q-workspace`.
- Never push or open a pull request as part of this skill unless the user explicitly asks for it.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
