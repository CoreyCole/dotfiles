---
name: q-review-implementation
description: LLM review for completed QRSPI implementation code. Use after q-implement hands off to review; applies straightforward code fixes as a final stacked slice and creates a review-directory QRSPI plan for deeper follow-up work.
---

# QRSPI Implementation Review

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
    brainstorms/
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

Later stages write `design.md`, optional `design-product.md`, `outline.md`, and `plan.md` inside `review_dir`, not in the parent plan. `/q-implement` then uses that review-dir `plan.md` to add follow-up slices on top of the already-reviewed implementation stack.

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
   - relevant project guidance surfaced by the focused project-guidance lane, including root/package `AGENTS.md`, `.agents/rules/`, `.cursor/rules/`, local skills, and docs referenced by the plan or changed files
1. Read `design.md`, optional `design-product.md`, `outline.md`, `questions/*.md`, `context/brainstorms/*.md`, `research/*.md`, PRDs/tickets, and planning context as needed to clarify intent and alignment. The primary review target is code plus verification evidence.

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
1. Summarize the implemented behavior at a high level and check alignment with PRDs, ticket text, question docs, `context/brainstorms/`, research findings, design/outline/plan, and approved plan-memory constraints.
1. Review actual code for correctness, regressions, security, invariants, tests, operations, maintainability, and compliance with relevant project guidance (`AGENTS.md`, `.agents/rules/`, `.cursor/rules/`, local skills, and docs). Preserve conflicting relevant guidance as `IMPORTANT: needs human attention`; do not silently choose between conflicting instructions.
1. Run focused lanes when useful; read every lane report; verify candidate findings yourself.
   - Treat a lane output as failed if it is empty, only contains raw tool-call markup/JSON such as `<tool_call>` or `{"cmd": ...}`, lacks the required lane report sections, or contains no evidence for its findings.
   - Rerun each failed lane once with the same task plus an explicit reminder to actually use tools and return only the markdown lane report.
   - If the rerun still fails, record the lane as unavailable in `review.md` and continue with your own targeted verification instead of trusting it.
1. Classify findings into `straightforward_fix` and `needs_followup_qrspi`. Treat conflicting relevant project guidance as `needs_followup_qrspi` unless it can be resolved by a clearly more-specific local instruction; label it `IMPORTANT: needs human attention` in `review.md` and seed neutral follow-up questions that ask which source is authoritative.
1. Write the initial `review.md` before applying code fixes or creating follow-up docs.
1. Apply all `straightforward_fix` findings directly when safe:
   - Create or reuse a final review-fix slice on top of the implementation stack when tracked source/test/doc files change.
   - If the repo uses Graphite and you are not already on a dedicated review-fix branch, create a branch on top of the current implementation head using the existing ticket slug plus `review-fixes` or another obvious final-slice suffix.
   - Never make review fixes directly on `develop`.
   - Keep fixes limited to the verified straightforward findings.
   - Run the specific verification command for each fix.
   - Commit only files changed by these fixes when project workflow expects committed slices.
1. For `needs_followup_qrspi` findings, initialize `review_dir` as a normal QRSPI plan:
   - copy `AGENTS.md` from `~/.agents/skills/qrspi-planning/_AGENTS.md` if missing
   - create `prds/`, `questions/`, `research/`, `adrs/`, `handoffs/`, `reviews/`, and `context/{brainstorms,question,research,design,design-product,outline,plan,implement}/`
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

## Current Implementation
[High-level summary of what the implementation does now.]

## Requirements Alignment
- PRD/ticket requirements: [aligned/gaps, with refs]
- Brainstormed requirements and decisions: [aligned/gaps, with refs to `context/brainstorms/`]
- Design/outline/plan commitments: [aligned/gaps, with refs]
- Verification evidence: [what proves alignment and what remains unproven]

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
- [Lane summaries, including project-guidance lane results, or `Not used; review was small/localized.`]

## Conflicting Guidance
- IMPORTANT: needs human attention — [conflict summary with exact source refs and decision needed, or `None.`]

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

All response shapes must be a fenced XML `<qrspi-result>` block followed by the mandatory concise human summary. Do not emit the old prose `Artifact path` / `Summary text` / `Next command` shape.

Post-XML natural summary format for implementation review: `Found: ... Fixed: ...`. Caveman clear. Few words. Most important words only. If clean: `Found: no blockers. Fixed: none.`

If no findings remain after any straightforward fixes, point the primary artifact at `done.md` and route to the final human implementation gate:

```xml
<qrspi-result>
  <stage>review-implementation</stage>
  <status>complete</status>
  <outcome>ready-for-human-review</outcome>
  <workspace>[absolute implementation workspace]</workspace>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall implementation goal]</plan-goal>
    <stage-completed>[what the implementation now does and what review checked/fixed]</stage-completed>
    <key-decisions>[why final human review is safe; note any applied fix commit]</key-decisions>
  </summary>
  <artifact>thoughts/.../done.md</artifact>
  <artifacts>
    <artifact role="review">thoughts/.../reviews/..._implementation-review/review.md</artifact>
  </artifacts>
  <next>human-review-implementation</next>
</qrspi-result>
```

If deeper follow-up QRSPI work is needed, keep the primary artifact as `review.md`, include a follow-up plan or questions artifact, and route back to QRSPI question in the review-dir context:

```xml
<qrspi-result>
  <stage>review-implementation</stage>
  <status>complete</status>
  <outcome>needs-followup</outcome>
  <workspace>[absolute implementation workspace]</workspace>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall implementation goal]</plan-goal>
    <stage-completed>[review found deeper follow-up and initialized review-dir QRSPI artifacts]</stage-completed>
    <key-decisions>[what follow-up must research/design/implement]</key-decisions>
  </summary>
  <artifact>thoughts/.../reviews/..._implementation-review/review.md</artifact>
  <artifacts>
    <artifact role="followup-questions">thoughts/.../reviews/..._implementation-review/questions/YYYY-MM-DD_HH-MM-SS_...md</artifact>
  </artifacts>
  <next>/q-research thoughts/.../reviews/..._implementation-review/questions/YYYY-MM-DD_HH-MM-SS_...md</next>
</qrspi-result>
```

If straightforward fixes were attempted but verification still fails, use `<status>blocked</status>` or `<status>error</status>` with the review artifact and verification failure in `<summary>`.

## Rules

- Review code and verification evidence, not just planning docs.
- Write `review.md` before applying code fixes or creating follow-up plans.
- Apply only `straightforward_fix` code changes directly.
- Treat direct code fixes as a final review-fix slice stacked on top of the implementation, not as parent planning-doc edits.
- Never edit the parent plan's `design.md`, `design-product.md`, `outline.md`, or `plan.md` for implementation-review follow-up work.
- Put all deeper implementation follow-up work in the timestamped `review_dir` as a fresh QRSPI plan with its own `design.md`, optional `design-product.md`, `outline.md`, and `plan.md`.
- Seed deeper follow-up with neutral research questions; do not copy review recommendations as settled solutions.
- Do not ask whether to create the follow-up QRSPI plan; create it automatically for `needs_followup_qrspi` findings.
- Surface conflicting relevant project guidance as `IMPORTANT: needs human attention` with exact source refs and the decision needed; do not apply code fixes based on one side of the conflict until it is resolved.
- Prefer a short, verified review over speculative findings.
- In both `review.md` and the user response, summarize the current implementation at a high level and state how it aligns with PRDs, tickets, brainstormed requirements, research findings, design/outline/plan commitments, and verification evidence.
- Always summarize the canonical review artifact and exact next command.
