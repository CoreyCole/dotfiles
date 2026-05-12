---
name: q-review-plan
description: LLM review for QRSPI planning artifacts before implementation. Use after outline or plan creation to review and directly fix design.md, optional design-product.md, outline.md, and plan.md; creates research follow-up questions only when codebase facts are missing.
---

# QRSPI Planning Review

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`
> **Review rubric:** `~/.pi/agent/skills/review-rubric/SKILL.md`

Review pre-implementation artifacts and make the planning docs better. This is an LLM review gate, not a passive report and not the human design/product-design interview. Findings should usually become direct edits to `design.md`, optional `design-product.md`, `outline.md`, or `plan.md`.

## Review Target

Load the planning artifacts that exist for the provided plan directory:

- Always review `design.md` when present.
- Review `design-product.md` when present. Missing `design-product.md` is not itself a finding for internal tools, bugfixes, refactors, or other low product-risk work.
- Always review `outline.md` when present.
- Review `plan.md` when present, especially when the input is `plan.md` or the plan has already been written.

Run this skill after `outline.md` is written and again after `plan.md` is written. The first pass gets the design and outline ready for `/q-plan`; the second pass gets the full implementation plan ready for `/q-implement`.

## Finding Classification

Classify every real finding into exactly one bucket:

| Bucket | Meaning | Action |
|---|---|---|
| `obvious_doc_fix` | The issue and fix are clear from the existing docs/code you already verified. | Edit `design.md`, `design-product.md`, `outline.md`, or `plan.md` immediately. |
| `needs_codebase_research` | The review found a likely issue, but the right doc change depends on facts not yet researched. | Automatically create a research questions doc under the review directory. Next step is `/skill:q-research-for-review`; do not ask the human for permission. |
| `needs_human_judgment` | The issue depends on product/business intent, risk tolerance, or a tradeoff not settled in prior QRSPI artifacts. This should be rare. | Ask via `/answer`; then apply the decision to the docs. |

Do not use research follow-up for questions you can answer with targeted reads during the review. Do the reads yourself first.

## Artifact Locations

Create one timestamped review directory under the parent plan:

```text
[plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_[outline|plan]-review/
  review.md
  questions/    # only when needs_codebase_research findings exist
  research/     # q-research-for-review writes here later
  context/
    research/   # research locator/analyzer artifacts
```

Use `outline-review` when `plan.md` does not exist or was not part of the review. Use `plan-review` when `plan.md` is reviewed.

The canonical review artifact is always:

```text
[review_dir]/review.md
```

Research follow-up question docs go directly under:

```text
[review_dir]/questions/YYYY-MM-DD_HH-MM-SS_[plan-name]_review-followup-questions.md
```

The review directory is a lightweight research workspace for planning-review follow-up. It does not get its own `design.md`, `design-product.md`, `outline.md`, or `plan.md`; `q-address-review-research` applies the researched fixes back to the parent planning docs.

## Load Context

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Read `~/.pi/agent/skills/review-rubric/SKILL.md`.
1. Resolve `plan_dir` from the input artifact or directory.
1. Read:
   - `[plan_dir]/AGENTS.md`
   - `[plan_dir]/design.md` if present
   - `[plan_dir]/design-product.md` if present
   - `[plan_dir]/outline.md` if present
   - `[plan_dir]/plan.md` if present and in scope
   - relevant `questions/*.md`, `context/brainstorms/*.md`, `research/*.md`, `prds/*`, and `context/{design,design-product,outline,plan}/*`
   - code/files explicitly referenced by the planning docs, plus any files needed to verify claims
1. If no planning artifact exists, stop and ask for a valid plan directory or artifact path.

## Focused Review Lanes

For tiny local planning changes, review directly. For broader plans, use the existing lane selector and focused lane prompts from `q-review/agents/`.

Run the selector with planning mode:

```bash
uv run ~/.agents/skills/q-review/bin/select-lanes.py \
  --mode outline \
  --plan-dir [plan_dir] \
  --reviewed-artifact [outline.md-or-plan.md] \
  --review-dir [review_dir] \
  --pretty
```

Use the selector's `subagent_tool_args` directly with the `subagent` tool. It disables the builtin reviewer defaults for `reads` and `progress` so focused lanes do not create root `plan.md` / `progress.md` files. Planning reviews route from `design.md`, `design-product.md`, `outline.md`, and `plan.md` only. Do not route lanes from `questions/`, `research/`, or `context/` paths.

Focused lane reports are advisory. Verify every candidate finding yourself before including it in `review.md` or changing docs.

## Process

1. Run `~/dotfiles/spec_metadata.sh` before creating `review_dir` or writing markdown.
1. Resolve `review_kind`:
   - `outline-review` if reviewing only design and outline.
   - `plan-review` if reviewing `plan.md` too.
1. Build understanding before judging:
   - Identify touched components, interfaces, data models, tests, migrations, rollout concerns, and nearby patterns.
   - Summarize the current planned design/approach at a high level.
   - Check alignment with PRDs, ticket text, question docs, `context/brainstorms/`, research findings, and approved plan-memory constraints.
   - Verify major named references and assumptions in the codebase.
1. Review planning docs for:
   - fidelity to approved questions/research/design and optional product design
   - hidden scope drift or missing requirements, especially product Critical Findings when present
   - vertical slice quality and sequencing
   - concrete file paths, interfaces, migrations, rollback, observability, and invariants
   - test checkpoints that actually prove each slice works and cover product E2E edge cases
   - plan steps that are too vague for a coding agent
   - local codebase rules under `.agents/rules/` when the plan touches areas covered by repo-specific rules
1. Run focused lanes when useful, then read every focused-lane output artifact before synthesis.
   - Treat a lane output as failed if it is empty, only contains raw tool-call markup/JSON such as `<tool_call>` or `{"cmd": ...}`, lacks the required lane report sections, or contains no evidence for its findings.
   - Rerun each failed lane once with the same task plus an explicit reminder to actually use tools and return only the markdown lane report.
   - If the rerun still fails, record the lane as unavailable in `review.md` and continue with your own targeted verification instead of trusting it.
1. Classify findings into `obvious_doc_fix`, `needs_codebase_research`, or `needs_human_judgment`. Only flag a missing `design-product.md` when the work is product-critical, high-stakes, user-facing with unclear PRD coverage, compliance/security sensitive, or changes irreversible user/data behavior.
1. Apply all `obvious_doc_fix` edits directly to `design.md`, `design-product.md`, `outline.md`, and/or `plan.md`.
1. For each `needs_codebase_research` finding, create `[review_dir]/questions/`, `[review_dir]/research/`, and `[review_dir]/context/research/`, then write neutral research questions under `[review_dir]/questions/`. Questions must link to `[review_dir]/review.md`, the affected parent docs, and exact file refs.
1. For each `needs_human_judgment` finding, write a self-contained `Questions for /answer` item. Use `/answer`, then apply the answer to the docs when possible.
1. Re-read edited docs and ensure `review.md` describes the post-edit state.
1. Write or update `[review_dir]/review.md`.
1. If durable decisions or review learnings should survive context resets, update `[plan_dir]/AGENTS.md`.

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
review_mode: planning
review_kind: [outline-review|plan-review]
reviewed_artifacts:
  - [design.md path or none]
  - [design-product.md path or none]
  - [outline.md path or none]
  - [plan.md path or none]
status: complete
type: planning_review
verdict: [correct|needs_attention]
---

# Planning Review: [plan name]

## Summary
[Short assessment of the reviewed planning docs after direct edits.]

## Current Design / Plan
[High-level summary of what the current design/outline/plan proposes.]

## Requirements Alignment
- PRD/ticket requirements: [aligned/gaps, with refs]
- Brainstormed requirements and decisions: [aligned/gaps, with refs to `context/brainstorms/`]
- Research/design constraints: [aligned/gaps, with refs]

## Findings Summary
- [Finding summary, or `None.`]

## Findings
### Finding 1: [Title]
- Classification: [obvious_doc_fix|needs_codebase_research|needs_human_judgment]
- Priority: [P0|P1|P2|P3]
- References: [doc path and code refs]
- Issue: [What was wrong.]
- Example: [Concrete scenario showing why it matters.]
- Resolution: [Edited docs, research questions doc, or human decision needed.]

## Focused Review Lanes
- [Lane summaries, or `Not used; review was small/localized.`]

## Applied Doc Edits
- `[path]` — [what changed]

## Research Follow-up Needed
- [Finding numbers and question doc path, or `None.`]

## Human Decisions Needed
- [Questions asked or `None.`]

## Follow-up Questions Doc
[Exact questions doc path or `None.`]

## Verification
- [Commands/reads performed and outcome.]

## Recommended Next Steps
[Next command.]
```

## Response Shapes

If all findings were fixed directly and the review is ready for the next stage:

```text
Artifact: [exact path to review.md]
Summary: planning review complete. verdict: correct. Current plan: [one-sentence high-level design/plan summary].
Alignment: [one sentence on PRD/ticket/brainstorm/research alignment, including notable gaps or "aligned".]
Changes: [short summary of edits to design.md / design-product.md / outline.md / plan.md / AGENTS.md, or none.]
Findings: none.
Next: [/q-plan exact-outline-path OR /q-review exact-plan-path OR /q-implement exact-plan-path]
```

Choose the next command this way:

- If `plan.md` does not exist, next is `/q-plan [exact outline.md path]`.
- If `plan.md` was just created or edited and has not had a plan review pass yet, next is `/q-review [exact plan.md path]`.
- If this was a `plan-review` and no findings remain, next is `/q-implement [exact plan.md path]`.

If codebase research is needed:

```text
Artifact: [exact path to review.md]
Summary: planning review needs codebase research before all docs can be finalized. Current plan: [one-sentence high-level design/plan summary].
Alignment: [one sentence on PRD/ticket/brainstorm/research alignment, including notable gaps.]
Changes: [short summary of direct doc edits already made, or none.]
Findings: [concise finding summaries with classification and examples]
Next: /skill:q-research-for-review [exact path to follow-up questions doc]
```

If human judgment is needed, first write `review.md`, then end with:

```text
Artifact: [exact path to review.md]
Summary: planning review needs human decisions before all docs can be finalized. Current plan: [one-sentence high-level design/plan summary].
Alignment: [one sentence on PRD/ticket/brainstorm/research alignment, including decision-dependent gaps.]
Changes: [short summary of direct doc edits already made, or none.]
Findings: [concise decision-blocked findings with examples]
Next: awaiting /answer decisions
```

Then add a `Questions for /answer` section and immediately invoke `/answer` with `execute_command`.

## Rules

- Planning review is an LLM review gate, not the human design review.
- Address clear findings directly in `design.md`, `design-product.md`, `outline.md`, and `plan.md`.
- Review `plan.md` after `/q-plan`; the old rule that the plan is never reviewed no longer applies.
- Do not leave obvious documentation fixes as passive findings.
- Do not ask the human about `needs_codebase_research` findings; create the research questions doc automatically.
- Use `needs_human_judgment` only for genuine business/product decisions not settled by prior QRSPI artifacts.
- Never edit implementation code in planning review.
- Do not create a full nested QRSPI design/outline/plan for planning-review research follow-up. Use `q-address-review-research` to apply researched fixes back to the parent docs.
- In both `review.md` and the user response, summarize the current design/plan at a high level and state how it aligns with PRDs, tickets, brainstormed requirements, research findings, and approved constraints.
- Always summarize the canonical review artifact and exact next command.
