---
name: q-implement
description: Execute one implementation slice per invocation. Sixth stage of QRSPI pipeline. Update status checkboxes and create per-slice handoffs as you go — they are your context recovery mechanism.
---

# Implement — Execute the Plan

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the sixth stage of the QRSPI pipeline. You execute exactly one unchecked slice per invocation, update status checkboxes, create a handoff after every verified slice, and then stop. The plan and the handoffs are your roadmap and your recovery mechanism when the context window resets.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read all files in `[plan_dir]/questions/`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/outline.md`
   - Read `[plan_dir]/plan.md`
   - Read all files in `[plan_dir]/research/`
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

1. **Verify artifacts are loaded** from step 0. `plan.md` is your primary input. Check the status checkboxes.

2. **If one or more slices are unchecked, pick the first unchecked slice and execute only that slice in this invocation:**
   a. Read the files you're about to modify to confirm they match what the plan expects.
   b. Implement the changes described in the plan.
   c. Run the verify step for the slice.
   d. If verification fails, fix the issue. If you can't fix it, stop and tell the user.
   e. If verification passes, update the checkbox in `plan.md` from `[ ]` to `[x]`.
   f. Commit the slice.
   g. If additional slices remain unchecked after this slice, create a checkpoint handoff via `/q-handoff` (no argument).
   h. If this was the last unchecked slice, do the final verification pass and then create a completion handoff via `/q-handoff continue`.
   i. Stop. Do **not** start the next slice in the same invocation.

3. **If all slices are already checked when you start**, do the final verification pass, create a completion handoff via `/q-handoff continue`, and stop.

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
1. Read `[plan_dir]/plan.md`
2. Read the newest implement-stage handoff in `[plan_dir]/handoffs/` if one exists
3. Use the status checkboxes to find the next unchecked slice, and the latest handoff to recover the exact verified checkpoint
4. Execute only that next slice

This is why the checkboxes and handoffs exist. Keep them updated.

## Response

After completing a slice, respond in two parts:

1. A concise human summary of the slice you just finished and the verification that passed.
   - Keep it short and concrete.
   - Include the slice number or name.
   - Include the verify command(s) and the result in concise form.

2. Then **end your response with the exact output shape from `/q-handoff`**.
   - For a non-final slice, this must be the checkpoint output from `/q-handoff`.
   - For the final slice, this must be the completion output from `/q-handoff continue`.
   - Do **not** add any text after the `/q-handoff` output.

Expected ending shape:

```text
Artifact: [exact path to handoff file]
Summary: [the exact summary returned by /q-handoff]
Next: /q-resume [exact path to handoff file]
```

Do not include a `PR:` line unless the user explicitly asked you to open one.

## Rules

- Implement exactly one slice per invocation. Never roll directly into the next slice after finishing one.
- Run the verify step after EVERY slice. Do not skip verification.
- Update the plan's status checkboxes as you complete slices — this is mandatory, not optional.
- If a slice fails verification, fix it before moving on. Vertical slices exist so you catch problems early.
- Commit after each successful slice. Small, working commits.
- After each successful slice, create the appropriate handoff via `/q-handoff` before stopping. This is mandatory.
- End every successful slice response with the exact `/q-handoff` output and nothing after it.
- Never push or open a pull request as part of this skill unless the user explicitly asks for it.
- If you hit a problem not covered by the plan, update the plan before continuing. The plan stays alive.
- Read the code you're about to modify before changing it — the codebase may have evolved since the plan was written.
