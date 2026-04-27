---
name: q-implement
description: Execute one implementation slice per invocation. Sixth stage of QRSPI pipeline. Update status checkboxes and create per-slice handoffs as you go — they are your context recovery mechanism.
---

# Implement — Execute the Plan

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the sixth stage of the QRSPI pipeline. You execute exactly one unchecked slice per invocation, update status checkboxes, create a handoff after every verified slice, and then stop. Only after **all slices are complete** may the final handoff send implementation to `/q-review`, which writes the canonical implementation review artifact to `[plan_dir]/reviews/`. Never prompt for review after an intermediate slice. The plan and the handoffs are your roadmap and your recovery mechanism when the context window resets.

Implementation is always handoff-driven. After every successful slice, the authoritative artifact is the new handoff document for that slice, and the canonical next command is `/q-resume [that handoff path]` until implementation is complete.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/AGENTS.md`
   - Read all files in `[plan_dir]/questions/`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/outline.md`
   - Read `[plan_dir]/plan.md`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/plan/`
   - Read the newest relevant files in `[plan_dir]/context/implement/` if any
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path or plan doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin from the first unchecked slice.
2. **If no parameters**, respond:

```
I'll implement the plan slice by slice.

Please provide the plan directory path or plan doc path:
e.g. `/q-implement thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-implement thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/plan.md`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0, including `[plan_dir]/AGENTS.md`. `plan.md` is your primary input. Check the status checkboxes.

2. **If one or more slices are unchecked, pick the first unchecked slice and execute only that slice in this invocation:**
   a. Read the files you're about to modify to confirm they match what the plan expects.
   b. If you need fresh orientation for this slice, run `codebase-locator` with a narrowly scoped task and, if needed, `codebase-analyzer` on the surfaced files or flow. Write the resulting timestamped artifact(s) under `[plan_dir]/context/implement/` before editing.
   c. Implement the changes described in the plan.
   d. Run the verify step for the slice.
   e. If verification fails, fix the issue. If you can't fix it, stop and tell the user.
   f. If verification passes, update the checkbox in `plan.md` from `[ ]` to `[x]`.
   g. If the slice surfaced durable decisions, tradeoffs, review learnings, or gotchas that future agents should remember first, update `[plan_dir]/AGENTS.md`.
      - Keep it short and curated.
      - Remove or rewrite stale bullets instead of appending contradictions.
   h. Commit the slice.
   i. If additional slices remain unchecked after this slice, create a checkpoint handoff via `/q-handoff` (no argument). This is mandatory; do not stop after only updating `plan.md`. Do **not** mention `/q-review` yet.
   j. If this was the last unchecked slice, do the final verification pass, write a concise finished-implementation summary, and then create a review handoff via `/q-handoff continue`.
   k. Stop. Do **not** start the next slice in the same invocation.

3. **If all slices are already checked when you start**, do the final verification pass, create a review handoff via `/q-handoff continue`, and stop.

4. **If reality diverges from the plan** (file moved, API changed, pattern different):
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
1. Read `[plan_dir]/AGENTS.md`
2. Read `[plan_dir]/plan.md`
3. Read the newest implement-stage handoff in `[plan_dir]/handoffs/` if one exists
4. Read the newest relevant context artifact in `[plan_dir]/context/implement/` if one exists
5. Use the status checkboxes to find the next unchecked slice, and the latest handoff/context artifact to recover the exact verified checkpoint
6. Execute only that next slice

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
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving on. Vertical slices exist so you catch problems early.
- Commit after each successful slice. Small, working commits.
- After each successful slice, create the appropriate handoff via `/q-handoff` before stopping. This is mandatory.
- Do not prompt for review until all slices are complete.
- For non-final slices, do not end with `plan.md` as the primary artifact and do not suggest `/q-implement [plan_dir]` as the canonical next step. The canonical next step is `/q-resume [new handoff path]`.
- When implementation is complete, the completion handoff must target `/q-review` and the `Implemented:` line must summarize the finished implementation, not just the last slice.
- End every successful slice response with the `Implemented:`/`Verification:`/`Artifact:`/`Next:` handoff block and nothing after it.
- Never push or open a pull request as part of this skill unless the user explicitly asks for it.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
