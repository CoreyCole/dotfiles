---
name: q-verify
description: Generic QRSPI post-implementation verification stage. Use after implementation review and before final human approval to run project-defined verification, inspect UI/artifacts, update tests/docs, fix clear issues, and emit verify.md plus QRSPI XML.
---

# QRSPI Verify

> Pipeline overview: `~/.agents/skills/qrspi-planning/SKILL.md`

`q-verify` is a generic agent stage after implementation review and before final human implementation approval. It validates reviewed code in the real project environment using a project-owned verification contract.

## Runtime XML contract

Every completed verify stage must emit fenced XML first, then one concise summary line.

```xml
<qrspi-result>
  <stage>verify</stage>
  <status>complete</status>
  <outcome>ready-for-human-review</outcome>
  <workspaceMetadata>
    <planWorkspace>[absolute active QRSPI plan/ticket directory]</planWorkspace>
    <implementationWorkspace>[absolute implementation workspace]</implementationWorkspace>
    <trunkBranch>[trunk]</trunkBranch>
    <stackBottomBranch>[bottom branch]</stackBottomBranch>
    <parentBranch>[parent branch]</parentBranch>
    <currentBranch>[current branch]</currentBranch>
  </workspaceMetadata>
  <policy>
    <autoMode>[bool]</autoMode>
    <enablePlanReviews>[bool]</enablePlanReviews>
    <invalidResultRetryLimit>[int]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall goal]</plan-goal>
    <stage-completed>[verification run, fixes/docs/tests/artifacts updated]</stage-completed>
    <key-decisions>[evidence and why human review is safe]</key-decisions>
  </summary>
  <artifact>thoughts/.../verify.md</artifact>
  <artifacts>
    <artifact role="implementation-review">thoughts/.../reviews/.../review.md</artifact>
    <artifact role="verification-evidence">thoughts/...</artifact>
  </artifacts>
  <next>
    <step>Read ~/.agents/skills/qrspi-planning/SKILL.md.</step>
    <step>Read verify.md.</step>
    <step>Read the implementation review artifact.</step>
    <step>Present final implementation evidence for human review.</step>
  </next>
</qrspi-result>
```

Post-XML summary format: `Verified: ... Fixed: ... Evidence: ...` If no fixes: `Verified: ... Fixed: none. Evidence: ...`

If blocked by failing verification that cannot be safely fixed, use `<status>blocked</status>`, omit `<outcome>`, keep `<workspaceMetadata>` with both workspace paths, write `verify.md`, and set `<next>` steps to read `qrspi-planning`, read `q-resume`, read `verify.md` or handoff, then start `/q-resume`. On success, `<next>` should use ordered `<step>` children that present final implementation evidence for human review; runtime transition remains graph-authoritative.

## Inputs

Load only what is needed:

1. `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Plan dir `AGENTS.md`, `design.md`, optional `design-product.md`, `outline.md`, `plan.md`, ADRs.
1. Final implementation handoff and implementation review artifact.
1. Project verification guide path supplied by workflow/user. If absent, look for exactly one obvious guide in repo docs such as `docs/qrspi-verify.md` or package docs. If none, block and ask for the guide path.
1. Files referenced by the guide and failing evidence.

The project guide is authoritative for project-specific commands, E2E tools, screenshot policy, canonical UI baseline, fixture setup, and artifact locations. This skill must not hardcode project names, commands, or paths.

## Process

1. Confirm current directory is the implementation workspace recorded by `/q-workspace` or handoff.
1. Read the project verification guide and extract:
   - required commands
   - required E2E/user stories
   - required artifacts/screenshots/visual-review outputs
   - allowed fix scope
   - pass/fail criteria
1. Run required verification commands exactly as the guide specifies.
1. Inspect outputs, logs, screenshots, visual review artifacts, generated test diffs, and docs findings.
1. Fix clear problems directly when ALL are true:
   - root cause is proven by evidence
   - fix is local and low risk
   - fix is inside project-guide allowed scope or obviously required test/doc/verifier repair
   - fix does not weaken intended behavior, delete assertions, hide failures, or bypass real verification
1. For unclear product/UX changes, broad architecture changes, flaky infra, credential issues, or risky production behavior changes: do not guess; record blocker in `verify.md` and return blocked/needs_human as appropriate.
1. Re-run the smallest verification that proves each fix, then required final verification if practical.
1. Commit every fix applied during verify before requesting human manual testing. Use the repository's normal commit/stack workflow, include regenerated outputs, and keep the workspace clean except explicitly unrelated pre-existing changes. Do not ask the human to test uncommitted verification fixes.
1. Before marking verification complete, prompt the user to manually test any running UI/workspace described by the project guide. Include the exact URL from the project CLI/server output and concise flows to inspect. Do not proceed to a complete `verify.md` until the user confirms manual testing passed; if the user cannot test or reports a problem, record `needs_human` or `blocked` with their findings.
1. Write `[plan_dir]/verify.md`.
1. Update `[plan_dir]/AGENTS.md` only for durable gotchas future sessions must load before handoffs.

## Allowed fixes

Default allowed:

- tests, test fixtures, test helpers, generated test outputs
- docs additions/updates/simplifications
- verification scripts/config owned by the project guide
- screenshot/visual-review artifacts and indexes
- small production fixes only when the issue is obvious, localized, and directly blocking verification

Never silently:

- weaken stories/assertions to pass
- mark a visual regression as accepted without guide-approved/human approval path
- edit unrelated code
- hide failures with sleeps, retries, broad ignores, or fallback behavior
- bypass real E2E when the guide requires it

## `verify.md` template

```markdown
---
date: [ISO]
researcher: [git_username]
git_commit: [current commit]
branch: [current branch]
repository: [repo]
stage: verify
plan_dir: thoughts/...
status: complete|blocked|needs_human
verification_guide: [path]
---

# Verify: [plan name]

## Summary
[Concise result and confidence.]

## Project Verification Contract
- Guide: `[path]`
- Required checks: [list]

## Commands Run
- `[command]` — pass|fail|skipped, evidence path/log summary

## E2E / UI Evidence
- [story/check] — [result, screenshot/artifact paths]

## Fixes Applied During Verify
- `[path]` — [what and why]

## Tests / Docs Updated
- `[path]` — [what changed]

## Remaining Risks / Human Decisions
- [None or exact blocker/question]

## Recommended Human Review Focus
- [what human should inspect]
```

## Rules

- `q-verify` runs after implementation review, before final human implementation approval.
- Verification evidence must be durable: prefer files under the plan dir or project-guide artifact locations.
- If real browser/agent/worker services are required, use the guide's auth and service-management instructions. Do not invent credentials or hand-configure auth.
- Commit verify-stage fixes before human testing so the running/manual-tested workspace corresponds to committed code.
- Keep final user summary short and evidence-focused.
- Do not create a final implementation-review `done.md`; successful verify routes to `human-review-implementation`, and terminal completion/done artifacts belong only after final human approval.
