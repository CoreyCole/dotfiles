---
name: q-address-review-research
description: Applies q-review-plan findings after follow-up research. Use after q-research-for-review answers planning-review questions to update parent design.md, design-product.md, outline.md, and plan.md based on review.md plus the research doc.
---

# Address Planning Review Research

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`
> **Planning review skill:** `~/.agents/skills/q-review-plan/SKILL.md`

Use this after a planning review created `needs_codebase_research` questions and `/skill:q-research-for-review` answered them. Read the review artifact and research doc, then update the parent planning documents directly.

This skill is only for pre-implementation planning-review follow-up. Implementation review follow-up uses a full QRSPI loop inside the implementation review directory.

## When Invoked

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Read `~/.agents/skills/q-review-plan/SKILL.md`.
1. Resolve inputs:
   - Preferred: `/skill:q-address-review-research [review.md path] [research.md path]`
   - If only a research doc path is provided, resolve the review directory from its parent and read `[review_dir]/review.md`.
   - If only a review directory path is provided, read `[review_dir]/review.md` and the newest `research/*.md` under it.
1. If required inputs are missing, respond:

```text
I'll apply planning review follow-up research to the parent design/product-design/outline/plan docs.

Please provide:
- the planning review artifact, e.g. `thoughts/[git_username]/plans/.../reviews/..._plan-review/review.md`
- and the research doc from `/skill:q-research-for-review`, e.g. `thoughts/[git_username]/plans/.../reviews/..._plan-review/research/YYYY-MM-DD_HH-MM-SS_topic.md`
```

Then wait for input.

## Load Context

Read:

- `[review_dir]/review.md`
- the provided research doc fully
- `[review_dir]/questions/*.md` relevant to the research
- the parent plan docs referenced by the review frontmatter:
  - `[parent_plan_dir]/AGENTS.md`
  - `[parent_plan_dir]/design.md` when present
  - `[parent_plan_dir]/design-product.md` when present
  - `[parent_plan_dir]/outline.md` when present
  - `[parent_plan_dir]/plan.md` when present
- code files explicitly referenced by the research doc when you need to verify how the doc update should be worded

Do not load unrelated parent-plan context unless needed to make the edit accurately.

## Process

1. Confirm the review is a planning review, not an implementation review.
1. Identify the `needs_codebase_research` findings from `review.md` and the questions answered by the research doc.
1. For each researched finding:
   - Determine whether the research resolves the uncertainty.
   - Edit the parent `design.md`, `design-product.md`, `outline.md`, and/or `plan.md` directly when the right planning-doc fix is now clear.
   - Preserve stage boundaries: design captures technical what/why, product design captures PRD coverage and product gates, outline captures structure and slices, plan captures exact implementation steps.
1. If the research shows the original finding is invalid, update `review.md` to mark it resolved as `no_doc_change_needed` and explain why.
1. If the research reveals another factual gap, write a new neutral questions doc under `[review_dir]/questions/` and make `/q-research` the next step.
1. If the research reveals a genuine business/product decision, ask via `/answer`; after the answer, apply the decision to the parent docs.
1. Re-read edited docs for consistency.
1. Update the same `[review_dir]/review.md` with:
   - research doc path
   - findings addressed
   - doc edits applied
   - findings dismissed by research
   - remaining research or human-decision follow-up
   - recommended next step
1. If durable decisions or review learnings should survive context resets, update `[parent_plan_dir]/AGENTS.md`.

## Edit Guidance

Apply the smallest doc changes that resolve the researched findings:

- Update `design.md` for changed goals, constraints, architecture choices, invariants, rejected paths, or approach rationale.
- Update `design-product.md` for PRD coverage, product Critical Findings, accepted non-goals/overrides, user/demo implications, or E2E edge cases.
- Update `outline.md` for slice boundaries, interfaces, signatures, sequencing, test checkpoints, rollout steps, or integration shape.
- Update `plan.md` for exact file edits, implementation order, test commands, migration commands, rollback instructions, or status checklist changes.

Do not create a nested design/outline/plan under the planning review directory. That review directory is only a research workspace for this follow-up path.

## Response Shapes

If all researched findings are addressed:

```text
Artifact: [exact path to updated review.md]
Summary: planning review research addressed in parent docs.
Changes: [short summary of edits to design.md / design-product.md / outline.md / plan.md / AGENTS.md.]
Findings: none remaining from this research pass.
Next: [/q-plan exact-outline-path OR /q-review exact-plan-path OR /q-implement exact-plan-path]
```

Choose the next command this way:

- If `plan.md` does not exist, next is `/q-plan [exact outline.md path]`.
- If `plan.md` exists but has not had a clean plan review after the doc changes, next is `/q-review [exact plan.md path]`.
- If this addressed a plan-review and no findings remain, next is `/q-implement [exact plan.md path]`.

If more codebase research is needed:

```text
Artifact: [exact path to updated review.md]
Summary: planning review research partially addressed; another research pass is needed.
Changes: [short summary of applied edits, or none.]
Findings: [remaining research-needed findings with examples]
Next: /q-research [exact path to new questions doc]
```

If human judgment is needed:

```text
Artifact: [exact path to updated review.md]
Summary: planning review research surfaced human decisions before docs can be finalized.
Changes: [short summary of applied edits, or none.]
Findings: [decision-needed findings with examples]
Next: awaiting /answer decisions
```

Then add a `Questions for /answer` section and immediately invoke `/answer` with `execute_command`.

## Rules

- Only use this skill for planning-review research follow-up.
- Read both the review artifact and research doc before editing.
- Edit parent planning docs directly when research resolves the finding.
- Keep stage boundaries clear between design, product design, outline, and plan.
- Do not edit implementation code.
- Do not create a full nested QRSPI plan in the planning review directory.
- Update the original review artifact instead of creating a second review artifact.
- Always return exact artifact and next-step paths.
