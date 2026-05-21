---
name: q-address-review-research
description: Applies q-review-plan findings after follow-up research. Use after q-research-for-review answers planning-review questions to update parent design.md, design-product.md, outline.md, and plan.md based on review.md plus the research doc.
---

# Address Planning Review Research

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

All response shapes must be a fenced XML `<qrspi-result>` block followed by the mandatory concise human summary. Use the exact helper stage ID provided by the runtime prompt: `address-review-research-design`, `address-review-research-outline`, or `address-review-research-plan`.

If all researched findings are addressed:

```xml
<qrspi-result>
  <stage>address-review-research-design|address-review-research-outline|address-review-research-plan</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>true</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall plan goal]</plan-goal>
    <stage-completed>[research findings addressed in parent planning docs]</stage-completed>
    <key-decisions>[why returning to the parent review is safe]</key-decisions>
  </summary>
  <artifact>thoughts/.../reviews/.../review.md</artifact>
  <artifacts>
    <artifact role="research">thoughts/.../reviews/.../research/...md</artifact>
    <artifact role="modified">thoughts/.../[design.md|outline.md|plan.md]</artifact>
  </artifacts>
  <next>/q-review thoughts/.../reviews/.../review.md</next>
</qrspi-result>
```

If more codebase research or human judgment is needed, use `<status>blocked</status>` or `<status>needs_human</status>` and summarize the unresolved findings. Do not create a nested design/outline/plan under the planning review directory.

## Rules

- Only use this skill for planning-review research follow-up.
- Read both the review artifact and research doc before editing.
- Edit parent planning docs directly when research resolves the finding.
- Keep stage boundaries clear between design, product design, outline, and plan.
- Do not edit implementation code.
- Do not create a full nested QRSPI plan in the planning review directory.
- Update the original review artifact instead of creating a second review artifact.
- Always return exact artifact and next-step paths.
