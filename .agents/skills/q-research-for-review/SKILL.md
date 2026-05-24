---
name: q-research-for-review
description: Research QRSPI planning-review follow-up questions. Use when q-review-plan creates needs_codebase_research findings; follows q-research but preserves review context and routes results to q-address-review-research.
---

# Research for Planning Review

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute active QRSPI plan/ticket directory before q-workspace]</workspace>
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
  <next>
    <step>Read ~/.agents/skills/qrspi-planning/SKILL.md.</step>
    <step>Read ~/.agents/skills/[concrete next-stage]/SKILL.md.</step>
    <step>Read [primary artifact path from artifact element].</step>
    <step>Start the concrete next stage immediately unless blocked by an explicit human/safety gate.</step>
  </next>
</qrspi-result>
```

`status` is lifecycle. `outcome` selects the graph branch. `<next>` is an ordered instruction block containing only `<step>` children: read `qrspi-planning`, read the next stage skill, read the artifact(s) needed by that stage, then start the next stage immediately unless blocked by an explicit human/safety gate. Runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

> **Base research skill:** `~/.agents/skills/q-research/SKILL.md`
> **Planning review skill:** `~/.agents/skills/q-review-plan/SKILL.md`

Research factual gaps found by `q-review-plan`. This skill exists so normal `/q-research` can stay blind and generic while planning-review research keeps enough review context to resolve the reviewed findings cleanly.

## When Invoked

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Read `~/.agents/skills/q-research/SKILL.md` and follow its research process unless this skill overrides it.
1. Read `~/.agents/skills/q-review-plan/SKILL.md` to understand the three planning-review categories:
   - `obvious_doc_fix`
   - `needs_codebase_research`
   - `needs_human_judgment`
1. Resolve the provided input:
   - Preferred: a review follow-up questions doc under `[parent_plan_dir]/reviews/*_[outline|plan]-review/questions/*.md`
   - Acceptable: the planning review directory; use its newest `questions/*.md`
   - Acceptable: the planning `review.md`; use the linked follow-up questions doc if one is recorded
1. If no usable input was provided, ask for the follow-up questions doc path and wait.

## Context Rules

Unlike normal `q-research`, this skill may read the planning review artifact because the review findings are the source of the research agenda.

Read:

- the follow-up questions doc fully
- `[review_dir]/review.md` fully
- relevant prior `[review_dir]/research/*.md` and `[review_dir]/context/research/*` when continuing a review research pass

Do not read the parent plan's `design.md`, `design-product.md`, `outline.md`, or `plan.md` unless the question doc explicitly references a section that must be understood to answer the factual question. If you read parent planning docs, treat them as context for the review finding, not as facts about the codebase.

## Research Process

Follow `q-research` for discovery, locator/analyzer delegation, synthesis, verification, and factual writing, with these overrides:

1. Keep the review finding attached to each research question.
1. Answer only the factual uncertainty that blocked the planning-doc edit.
1. Preserve the classification boundary:
   - If research proves the fix is clear, mark the finding as ready for `q-address-review-research`.
   - If research shows the original finding is invalid, say so with evidence.
   - If research reveals a product/business tradeoff, mark it as `needs_human_judgment` and explain the decision needed.
   - If research reveals another factual gap, write the next neutral research question in `Open Questions`.
1. Do not propose broad solutions or implementation plans. Provide facts that let the next skill update `design.md`, `design-product.md`, `outline.md`, or `plan.md`.

## Output

Write the research artifact under the planning review directory:

```text
[review_dir]/research/YYYY-MM-DD_HH-MM-SS_[topic].md
```

Use the normal `q-research` template, plus this required section before `Open Questions`:

```markdown
## Review Finding Resolution Map

| Review finding | Original classification | Research result | Next action |
|---|---|---|---|
| Finding 1 | `needs_codebase_research` | [resolved / invalid / needs_human_judgment / needs_more_research] | [`q-address-review-research` / none / `/answer` / another research question] |
```

## Response

When this helper completes, emit a fenced XML `<qrspi-result>` block followed by the mandatory concise human summary. Use the exact helper stage ID provided by the runtime prompt, not a generic stage name.

```xml
<qrspi-result>
  <stage>research-for-review-design|research-for-review-outline|research-for-review-plan</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>true</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall plan goal]</plan-goal>
    <stage-completed>[what this helper researched or applied]</stage-completed>
    <key-decisions>[remaining review implication or why returning to review is safe]</key-decisions>
  </summary>
  <artifact>thoughts/.../[research-or-review-artifact].md</artifact>
  <artifacts>
    <artifact role="review">thoughts/.../reviews/.../review.md</artifact>
    <artifact role="questions">thoughts/.../reviews/.../questions/...md</artifact>
  </artifacts>
  <next>
    <step>Read ~/.agents/skills/qrspi-planning/SKILL.md.</step>
    <step>Read ~/.agents/skills/q-address-review-research/SKILL.md.</step>
    <step>Read [review.md].</step>
    <step>Read [research.md].</step>
    <step>Start /q-address-review-research immediately unless blocked by an explicit human/safety gate.</step>
  </next>
</qrspi-result>
```

## Rules

- Use this only for planning-review `needs_codebase_research` findings.
- For implementation-review follow-up plans, use normal `/q-research` because those are full QRSPI loops with their own design/outline/plan.
- Keep research factual. No solutions, pseudocode, or planning-doc edits.
- Every claim needs file:line evidence.
- Preserve review category transitions explicitly in `Review Finding Resolution Map`.
- The next doc-editing step is always `/skill:q-address-review-research`, unless more research or `/answer` is required first.
