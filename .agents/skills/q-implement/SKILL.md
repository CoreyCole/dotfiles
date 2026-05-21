---
name: q-implement
description: Execute one implementation slice per invocation. Seventh stage of QRSPI pipeline. Load `plan.md` and optional `design-product.md`, update status checkboxes, and create per-slice handoffs as you go — they are your context recovery mechanism.
---

## QRSPI mode contract

- `autoMode=false`: stop at human gates; still emit valid `<qrspi-result>` and show validated advance button.
- `autoMode=true`: continue through human gates automatically unless `needs_human`, `blocked`, `error`, invalid artifact, disallowed transition, run failure, or XML retry exhaustion.
- `enablePlanReviews=true`: run planning `/q-review` after outline and plan. Do not run `/q-review` immediately after design; design advances to `/q-outline` (or optional `/q-design-product`).
- `enablePlanReviews=false`: skip planning `/q-review`; final implementation `/q-review` always runs.
- Research never has its own human stop. Humans evaluate research in design/outline review.
- Emit the QRSPI XML result as a fenced `xml` code block for every completed QRSPI stage result so it is syntax highlighted, then add only the mandatory concise human summary after it.

## QRSPI XML summary contract

The `<summary>` element is used by humans to understand workflow state before asking follow-up questions or advancing. It must be structured, specific, self-contained, not a generic completion label. Use these child elements inside `<summary>`:

- `<plan-goal>`: overall plan/workflow goal in plain language; not just current stage label.
- `<stage-completed>`: what this stage/session did and how it moves toward the goal. Extremely concise; sacrifice grammar for concision.
- `<key-decisions>`: direction we are headed; significant tradeoffs, risks, open questions, follow-up, or why next step is safe. Use `None.` only when truly none.

Keep each child element short: 1-2 concise lines max.

For review stages, always include both: (1) what the entire implementation/plan now does as a whole, and (2) what this review session checked and changed. Do not write vague summaries like `review complete`, `implementation review result`, `done`, or `summary of findings` without the concrete details a human would need to ask informed questions.

## QRSPI footer instructions

When more than one artifact is relevant, keep `<artifact>` as the primary next-command artifact and also include `<artifacts>` with every important artifact path, including review records, done summaries, handoffs, ADRs, and follow-up questions.

Do not duplicate artifact lists or machine-control details in prose outside the XML. For normal QRSPI stage completion, the response must be the fenced `xml` `<qrspi-result>` block followed by a mandatory concise human summary; make both summaries specific enough for humans.

Runtime completion for the `implement` node happens only when implementation is ready for automated implementation review. Use `<status>complete</status>`, `<outcome>complete</outcome>`, the final implementation-complete handoff as `<artifact>`, and `<next>/q-review [handoff]</next>`. For non-final checkpoint handoffs, write the handoff artifact but do not present it as a completed workflow-node result unless intentionally stopping with `blocked`/`needs_human`.

```xml
<qrspi-result>
  <stage>implement</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <workspace>
[absolute path to the implementation workspace created/repaired by q-workspace]
  </workspace>
  <workspaceMetadata>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the completed implementation branch]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify]</currentBranch>
  </workspaceMetadata>
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

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute implementation workspace when known]</workspace>
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

`status` is lifecycle. `outcome` selects the graph branch. `<workspaceMetadata>` records branch context for humans and runtime handoff/debugging: `trunkBranch` is usually `main`; `stackBottomBranch` is the lowest Graphite branch above trunk; `parentBranch` is the branch immediately below the chunk of work just completed; `currentBranch` is the branch created/updated for the chunk. Use empty elements when not in a Graphite repo or the value is unknowable. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

You are the seventh stage of the QRSPI pipeline. You execute exactly one unchecked slice per invocation, update status checkboxes, create a handoff after every verified slice, and then stop. Each slice should leave the engineer with a concrete, reviewable/testable increment: code diff, behavior, verification command, and artifact/handoff evidence. Only after **all slices are complete** may the final handoff send implementation to `/q-review`, which writes the canonical implementation review artifact to `[plan_dir]/reviews/`. Never prompt for review after an intermediate slice. The plan and the handoffs are your roadmap and your recovery mechanism when the context window resets.

Implementation is always handoff-driven. After every successful planned work chunk, the authoritative artifact is the new handoff document, and the canonical next command is `/q-resume [that handoff path]` until implementation is complete.

**Human handoff wording hard rule:** the lead engineer does not care about slice numbers or workspace boilerplate. In every implementation handoff and user-facing handoff summary, never write `slice 1`, `slice 2`, `next slice`, or similar. Use exactly `Done:` and `Next:`. Describe behavior/files/outcome only. Use one workspace line max: `Workspace: [path]; Branch: [branch@commit]`. Translate plan checkbox numbers into human-relevant work.

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
   - For `cn-agents` and other Graphite repos, do **not** pre-create the next slice branch before making edits. Implement the slice on the current base/top branch, run verification, update any plan/status docs, then run `gt create <slug>_slice-N` (or review-plan variant) with the final conventional commit message. After `gt create`, write the handoff on the new slice branch with final branch metadata, stage it, and run `gt modify --no-interactive` to amend the slice so the handoff travels with the same branch. This lets the implementing agent write the commit after seeing the complete diff and lets the handoff record the final branch names.
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
     h. Commit the slice if tracked source/test/doc changes were made. In `cn-agents` and other Graphite repos, create the slice branch at this point with `gt create <slug>_slice-N -m "$(cat /tmp/slice-commit-message.txt)"` (or the repo's non-interactive equivalent); if already on the matching slice branch, use `gt modify --no-interactive -m "$(cat /tmp/slice-commit-message.txt)"` to amend the current slice commit. Do not run `gt create` before the slice is implemented, verified, and plan/status docs are updated. For a verification-only slice with no tracked changes, do not commit and do not create an empty branch.
     i. After `gt create`/`gt modify`, capture workspace branch metadata for the handoff and response XML: `currentBranch` from `git branch --show-current`, `parentBranch` as the Graphite branch immediately below the current/just-created branch, `stackBottomBranch` as the lowest branch above trunk in `gt log short`, and `trunkBranch` as the trunk branch from that stack (usually `main`).
     j. Create the required implementation handoff **after branch creation** so it records the final branch names. Set handoff frontmatter `branch` to the new/current slice branch. For `git_commit`, use the current pre-handoff branch hash plus a note in the handoff that the branch is amended after handoff creation; the final branch-head hash belongs in the QRSPI XML response after the amend.
     k. Stage the handoff and amend the slice with `gt modify --no-interactive` (or `gt modify --no-interactive -m "$(cat /tmp/slice-commit-message.txt)"` if the message needs to be preserved/updated). Do **not** use `gt modify --commit` for post-create handoff/content fixes; `gt modify` amends by default and `--commit` creates an additional commit. Capture the final branch-head hash with `git rev-parse --short HEAD` for the response XML only. Do not amend solely to chase the final self-referential hash inside the handoff.
     l. Commit messages must follow Conventional Commits 1.0.0: `<type>[optional scope]: <description>` as the subject, optional explanatory body, then footer section. Include the QRSPI XML as a footer after a blank line, wrapped in `<qrspi-commit>` and containing `<workspace>`, `<slice number="N">`, and `<artifacts>` entries for exact `<design>`, `<outline>`, and `<plan>` paths. If the slice's `### Commit Message` block is missing, non-conventional, or lacks the XML footer, update `plan.md` before committing.
     m. If additional edit work remains unchecked after this work, do **not** pre-create the next branch. The checkpoint handoff should use `Done: ...` and `Next: ...`, not reference slice number. It should tell the next `/q-resume` agent to implement the next work on the current top branch and run `gt create <slug>_slice-N` only after that work is implemented and verified. Do **not** mention `/q-review` yet.
     n. If only verification-only work remains, do not pre-create a branch for it. The checkpoint handoff should point to `/q-resume`; the resumed agent will run the verification-only work in the current implementation workspace.
     o. If this was the last unchecked slice, do the final verification pass, create/modify the final slice branch first when tracked edits exist, then write a concise finished-implementation summary and review handoff via `/q-handoff continue`; stage that handoff and amend the final slice. For verification-only completion with no tracked changes, write the review handoff without a new branch/commit.
     p. Stop. Do **not** start the next slice in the same invocation.

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
1. Use the status checkboxes to find the next unchecked work, and the latest handoff/context artifact to recover the exact verified checkpoint
1. Execute only that next work

This is why the checkboxes and handoffs exist. Keep them updated.

## Response

After completing planned work, create the required `/q-handoff` artifact first. Do not include separate `Implemented:`, `Verification:`, `Artifact path:`, or `Next command:` prose lines. In the handoff, use only `Done:` and `Next:` for the human summary; no slice numbers.

For non-final implementation work, write the handoff artifact and stop in normal chat context; do not emit a completed workflow-node XML result, because the runtime `implement` node should not advance until all planned work is done. Handoff content must use `Done: ...` and `Next: ...`; do not identify work by slice number. For final implementation work, emit the fenced XML footer described above followed by the mandatory concise human summary, with `<stage>implement</stage>`, `<status>complete</status>`, `<outcome>complete</outcome>`, `<workspaceMetadata>` populated from the post-commit branch stack, the final completion handoff as `<artifact>`, and `<next>/q-review [exact handoff path]</next>`. Put what changed, engineer-test/review instructions, verification commands/results, completed work, and next-step rationale in the XML `<summary>` and `<artifacts>` as needed.

## Rules

- Implement exactly one slice per invocation. Never roll directly into the next slice after finishing one.
- Every implementation and review-fix slice should be independently reviewable/testable by the engineer. Include the diff/branch context, behavior to inspect, and exact verification/manual test command or UI scenario in the handoff/XML summary.
- Always do `/q-implement` work in the fresh filesystem copy created/repaired by `/q-workspace` and recorded in `<workspace>` / `plan.md`. Never use `git worktree`.
- Do not create a second normal implementation copy in `/q-implement`; stop and ask if the recorded workspace is missing or unusable.
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving on. Vertical slices exist so you catch problems early.
- Never do `/q-implement` coding work on `develop`. In Graphite repos, including `cn-agents`, do not pre-create slice branches before implementation. Start from the current base/top branch, implement and verify the slice, then create the slice branch with `gt create <slug>_slice-N` (or modify the existing matching slice branch) using the plan/ticket slug and a `slice-N` suffix that matches the plan.
- Commit after each successful slice that changed tracked files. Use a Conventional Commit subject (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, etc.), optional body, and QRSPI XML footer. The footer must be wrapped in `<qrspi-commit>` with `<workspace>`, `<slice number="N">`, and `<artifacts>` containing exact `<design>`, `<outline>`, and `<plan>` paths. In `cn-agents` and other Graphite repos, prefer `gt create <slug>_slice-N -m "$(cat /tmp/slice-commit-message.txt)"` after implementation/verification/plan updates, then create the handoff on the new branch and `gt modify --no-interactive` to amend it into that slice. If already on the matching slice branch, use `gt modify --no-interactive -m "$(cat /tmp/slice-commit-message.txt)"` for code/doc changes, write the handoff, then `gt modify --no-interactive` again for the handoff. Remember: `gt modify` amends by default; `gt modify --commit` creates a new commit and is usually wrong for fixing the current slice.
- Do not commit or branch for verification-only slices with no tracked changes.
- For implementation-review follow-up plans under `reviews/*_implementation-review/`, do not create a new fresh copy; stack fixes in the original implementation copy. In Graphite repos, including `cn-agents`, branch names must make the stacked review plan clear: `gt create <slug>_review_plan_slice-N`. Each review-fix slice must give the engineer a small focused fix to review/test on top of the original implementation stack.
- After each non-final edit commit, do not create the next branch. The next `/q-resume` agent owns the next work context and will run `gt create <slug>_slice-N` or `gt create <slug>_review_plan_slice-N` only after implementing and verifying that next work. If the next work is verification-only, no branch is created. In handoffs, use `Done: ...` and `Next: ...`, not slice number.
- After each successful tracked-edit work chunk, create/modify the Graphite branch first, then create the appropriate handoff via `/q-handoff`, stage it, and amend it into the same commit before stopping. This is mandatory. Verification-only/no-branch work still writes the handoff directly on the current branch without creating an empty branch. Handoffs must use `Done: ...` and `Next: ...`, not slice number.
- Do not prompt for review until all slices are complete.
- For non-final implementation work, do not end with `plan.md` as the primary artifact and do not suggest `/q-implement [plan_dir]` as the canonical next step. The canonical next step is `/q-resume [new handoff path]`. Handoff prose must use `Done: ...` and `Next: ...`, not slice number.
- Before writing any implementation handoff, rewrite any phrase like `Completed slice N` or `Next slice N` into `Done: [behavior/files/outcome]` and `Next: [behavior/files/outcome]`.
- When implementation is complete, the completion handoff must target `/q-review` and summarize the finished implementation, not just the last slice.
- End every successful workflow-node response with the required fenced `xml` `<qrspi-result>` footer followed by the mandatory concise human summary; put implementation, verification, artifact, and next-step details in the XML `<summary>`, `<artifact>`, `<artifacts>`, and `<next>` elements.
- Include `<workspace>` immediately after `<outcome>` in complete implementation result XML (or immediately after `<status>` for non-complete results that omit `<outcome>`), using the absolute workspace path created/repaired by `/q-workspace`.
- Include `<workspaceMetadata>` immediately after `<workspace>` in implementation result XML. For Graphite repos, fill `trunkBranch`, `stackBottomBranch`, `parentBranch`, and `currentBranch` after branch creation/modification. For verification-only or non-Graphite work, include empty elements for unknown values and preserve `currentBranch` when known.
- Never push or open a pull request as part of this skill unless the user explicitly asks for it.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
