---
name: q-research-for-review
description: Research QRSPI planning-review follow-up questions. Use when q-review-plan creates needs_codebase_research findings; follows q-research but preserves review context and routes results to q-address-review-research.
---

# Research for Planning Review

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`
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

When the research doc is written, use this exact response shape:

```text
Artifact: [exact path to research doc]
Summary: [brief summary of findings and which review findings are ready to address]
Next: /skill:q-address-review-research [exact path to review.md] [exact path to research doc]
```

If another factual research pass is required before the docs can be addressed:

```text
Artifact: [exact path to research doc]
Summary: review research found additional factual gaps.
Next: /skill:q-research-for-review [exact path to new questions doc]
```

If human judgment is required before the docs can be addressed, write the research doc, then ask through `/answer` with a self-contained question tied to the review finding.

## Rules

- Use this only for planning-review `needs_codebase_research` findings.
- For implementation-review follow-up plans, use normal `/q-research` because those are full QRSPI loops with their own design/outline/plan.
- Keep research factual. No solutions, pseudocode, or planning-doc edits.
- Every claim needs file:line evidence.
- Preserve review category transitions explicitly in `Review Finding Resolution Map`.
- The next doc-editing step is always `/skill:q-address-review-research`, unless more research or `/answer` is required first.
