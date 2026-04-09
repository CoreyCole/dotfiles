---
name: q-implement
description: Execute the implementation plan slice by slice. Sixth stage of QRSPI pipeline. Update status checkboxes as you go — they are your context recovery mechanism.
---

# Implement — Execute the Plan

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the sixth stage of the QRSPI pipeline. You execute the plan slice by slice, updating status checkboxes as you go. The plan is both your roadmap and your recovery mechanism when the context window resets.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/questions.md`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/outline.md`
   - Read `[plan_dir]/plan.md`
   - Read all files in `[plan_dir]/research/`
1. **If a plan directory path was provided**, load the artifacts above, then begin from the first unchecked slice.
2. **If no parameters**, respond:

```
I'll implement the plan slice by slice.

Please provide the plan directory path:
e.g. `/q-implement thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0. `plan.md` is your primary input. Check the status checkboxes — if some slices are already checked, pick up from the first unchecked slice.

2. **For each slice:**
   a. Read the files you're about to modify to confirm they match what the plan expects.
   b. Implement the changes described in the plan.
   c. Run the verify step for the slice.
   d. If verification passes, update the checkbox in `plan.md` from `[ ]` to `[x]`.
   e. Commit the slice.
   f. If verification fails, fix the issue. If you can't fix it, stop and tell the user.

3. **If reality diverges from the plan** (file moved, API changed, pattern different):
   - Stop and present the mismatch clearly:
     ```
     Issue in Slice [N]:
     Expected: [what the plan says]
     Found: [actual situation]
     How should I proceed?
     ```
   - Update the plan with any deviations before continuing.

4. **After all slices are complete**, do a final verification pass and open a PR.

## Context Recovery

If your context window resets mid-implementation:
1. Read `[plan_dir]/plan.md`
2. The status checkboxes tell you exactly where you left off
3. Pick up from the first unchecked slice

This is why the checkboxes exist. Keep them updated.

## Response

When all slices are complete and the PR is open, respond to the user with:

```
Implementation complete. All [number] slices verified and committed.

PR: [PR URL]

Pipeline complete for [plan_dir].
```

## Rules

- Implement one slice at a time. Do not batch multiple slices.
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving to the next slice. Vertical slices exist so you catch problems early.
- Commit after each successful slice. Small, working commits.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
