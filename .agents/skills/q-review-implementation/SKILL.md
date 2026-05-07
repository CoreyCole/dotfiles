---
name: q-review-implementation
description: LLM review for completed QRSPI implementation code. Use after q-implement hands off to review; applies straightforward code fixes as a final stacked slice and creates a review-directory QRSPI plan for deeper follow-up work.
---

# QRSPI Implementation Review

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`
> **Review rubric:** `~/.pi/agent/skills/review-rubric/SKILL.md`

Review the completed implementation against the plan, codebase reality, and verification evidence. Straightforward code fixes can be made immediately as a final review-fix slice. Deeper issues become a new QRSPI plan rooted in the timestamped review directory so follow-up branches can stack on top of the implementation.

## Finding Classification

Classify every real finding into exactly one bucket:

| Bucket | Meaning | Action |
|---|---|---|
| `straightforward_fix` | The bug, patch, and verification are clear and localized. | Apply it immediately in the review context as a final stacked slice, then verify. |
| `needs_followup_qrspi` | The issue needs research, design tradeoff analysis, multi-slice work, broad refactoring, rollout planning, or unclear ownership. | Create a review-directory QRSPI plan seeded by neutral questions. |

Do not downgrade deep issues into quick fixes just because a small patch is possible. If the right fix depends on facts or design judgment, use `needs_followup_qrspi`.

## Artifact Locations

Create one timestamped implementation review directory:

```text
[plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/
  review.md
  AGENTS.md
  prds/
  questions/
  research/
  context/
    question/
    research/
    design/
    outline/
    plan/
    implement/
  adrs/
  outline.md
  design.md
  plan.md
  handoffs/
  reviews/
```

The canonical review artifact is:

```text
[review_dir]/review.md
```

When `needs_followup_qrspi` findings exist, the same `review_dir` is the follow-up QRSPI plan directory. Seed it with:

```text
[review_dir]/questions/YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review-followup-questions.md
```

Later stages write `design.md`, `design-product.md`, `outline.md`, and `plan.md` inside `review_dir`, not in the parent plan. `/q-implement` then uses that review-dir `plan.md` to add follow-up slices on top of the already-reviewed implementation stack.

## Load Context

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Read `~/.pi/agent/skills/review-rubric/SKILL.md`.
1. Resolve `plan_dir` and the implement-complete handoff:
   - If a handoff path was provided, use it.
   - If a plan directory was provided, use the newest complete implement handoff in `[plan_dir]/handoffs/`.
1. Read:
   - `[plan_dir]/AGENTS.md`
   - the implement-complete handoff
   - `[plan_dir]/plan.md`
   - code files changed by implementation, using handoff sections, `git status`, `git diff`, `git show`, or the known branch range
   - verification evidence from the handoff
1. Read `design.md`, `design-product.md`, `outline.md`, `questions/*.md`, `research/*.md`, and planning context only as needed to clarify intent. The primary review target is code plus verification evidence.

## Focused Review Lanes

For anything broader than a tiny localized change, use the existing lane selector and focused lane prompts from `q-review/agents/`.

```bash
uv run ~/.agents/skills/q-review/bin/select-lanes.py \
  --mode implementation \
  --plan-dir [plan_dir] \
  --reviewed-artifact [implement-handoff] \
  --review-dir [review_dir] \
  --pretty
```

For committed stacks, include the exact range when known:

```bash
uv run ~/.agents/skills/q-review/bin/select-lanes.py \
  --mode implementation \
  --plan-dir [plan_dir] \
  --reviewed-artifact [implement-handoff] \
  --review-dir [review_dir] \
  --diff-range [base]..HEAD \
  --pretty
```

Use the selector's `subagent_tool_args` directly with the `subagent` tool. It disables the builtin reviewer defaults for `reads` and `progress` so focused lanes do not create root `plan.md` / `progress.md` files. Focused lane reports are advisory; verify each candidate finding yourself before including it.

## Process

1. Run `~/dotfiles/spec_metadata.sh` before creating `review_dir` or writing markdown.
1. Create `review_dir` and write `review.md` there.
1. Build understanding from the handoff, changed files, verification evidence, and relevant plan requirements.
1. Review actual code for correctness, regressions, security, invariants, tests, operations, and maintainability.
1. Run focused lanes when useful; read every lane report; verify candidate findings yourself.
1. Classify findings into `straightforward_fix` and `needs_followup_qrspi`.
1. Write the initial `review.md` before applying code fixes or creating follow-up docs.
1. Apply all `straightforward_fix` findings directly when safe:
   - Create or reuse a final review-fix slice on top of the implementation stack when tracked source/test/doc files change.
   - If the repo uses Graphite and you are not already on a dedicated review-fix branch, create a branch on top of the current implementation head using the existing ticket slug plus `review-fixes` or another obvious final-slice suffix.
   - Never make review fixes directly on `develop`.
   - Keep fixes limited to the verified straightforward findings.
   - Run the specific verification command for each fix.
   - Commit only files changed by these fixes when project workflow expects committed slices.
1. For `needs_followup_qrspi` findings, initialize `review_dir` as a normal QRSPI plan:
   - copy `AGENTS.md` from `~/.agents/skills/qrspi-planning/AGENTS.md` if missing
   - create `prds/`, `questions/`, `research/`, `adrs/`, `handoffs/`, `reviews/`, and `context/{question,research,design,design-product,outline,plan,implement}/`
   - write `prds/source-review.md` pointing to `review.md`
   - write neutral research questions under `questions/`
1. Update `review.md` with applied fixes, commits/branches if any, verification results, and the follow-up question doc path.
1. If durable review learnings should survive, update `[plan_dir]/AGENTS.md`; for follow-up work, also update `[review_dir]/AGENTS.md` with the current focus and source review link.

## Review Artifact Template

```markdown
---
date: [ISO datetime with timezone]
reviewer: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
plan_dir: [exact parent plan dir path]
review_dir: [exact review dir path]
review_mode: implementation
reviewed_artifact: [exact implement handoff path]
status: complete
type: implementation_review
verdict: [correct|needs_attention]
---

# Implementation Review: [plan name]

## Summary
[Short assessment of the implementation after any straightforward fixes.]

## Findings Summary
- [Finding summary, or `None.`]

## Findings
### Finding 1: [Title]
- Classification: [straightforward_fix|needs_followup_qrspi]
- Priority: [P0|P1|P2|P3]
- References: [code refs]
- Issue: [What is wrong.]
- Example: [Concrete runtime or maintenance scenario showing why it matters.]
- Resolution: [Applied fix and verification, or follow-up QRSPI questions.]

## Focused Review Lanes
- [Lane summaries, or `Not used; review was small/localized.`]

## Applied Straightforward Fixes
- `[path]` — [what changed, branch/commit if applicable, verification]

## Follow-up QRSPI Plan
- Plan dir: [review_dir or `None.`]
- Questions doc: [path or `None.`]
- Findings included: [finding numbers or `None.`]

## Verification
- [Commands and outcomes.]

## Recommended Next Steps
[Next command.]
```

## Response Shapes

If no findings remain:

```text
Artifact: [exact path to review.md]
Summary: implementation review complete. verdict: correct.
Changes: [straightforward fixes applied, branch/commit if any, or none.]
Findings: none.
Next: pipeline complete
```

If straightforward fixes were applied and deeper follow-up is needed:

```text
Artifact: [exact path to review.md]
Summary: implementation review complete. straightforward fixes applied; follow-up QRSPI plan created for deeper findings.
Changes: [short summary of fixes, branch/commit if any.]
Findings: [remaining needs_followup_qrspi findings with examples]
Next: /q-research [exact path to follow-up questions doc]
```

If only deeper follow-up is needed:

```text
Artifact: [exact path to review.md]
Summary: implementation review complete. follow-up QRSPI plan created for deeper findings.
Changes: none.
Findings: [needs_followup_qrspi findings with examples]
Next: /q-research [exact path to follow-up questions doc]
```

If straightforward fixes were attempted but verification still fails:

```text
Artifact: [exact path to review.md]
Summary: implementation review needs attention. straightforward fix verification did not pass.
Changes: [short summary of attempted fixes.]
Findings: [remaining failing findings with examples]
Next: /q-review [exact implementation handoff path]
```

## Rules

- Review code and verification evidence, not just planning docs.
- Write `review.md` before applying code fixes or creating follow-up plans.
- Apply only `straightforward_fix` code changes directly.
- Treat direct code fixes as a final review-fix slice stacked on top of the implementation, not as parent planning-doc edits.
- Never edit the parent plan's `design.md`, `design-product.md`, `outline.md`, or `plan.md` for implementation-review follow-up work.
- Put all deeper implementation follow-up work in the timestamped `review_dir` as a fresh QRSPI plan with its own `design.md`, `design-product.md`, `outline.md`, and `plan.md`.
- Seed deeper follow-up with neutral research questions; do not copy review recommendations as settled solutions.
- Do not ask whether to create the follow-up QRSPI plan; create it automatically for `needs_followup_qrspi` findings.
- Prefer a short, verified review over speculative findings.
- Always summarize the canonical review artifact and exact next command.
