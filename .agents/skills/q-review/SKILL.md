---
name: q-review
description: Router for QRSPI LLM reviews. Use for reviewing design, product design, outline, plan, or completed implementation artifacts; loads q-review-plan before code exists and q-review-implementation after code has been written.
---

# QRSPI Review Router

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

`/q-review` is the stable entry point for QRSPI LLM review. It does not contain the review workflow itself. It resolves whether code has been written, then loads exactly one focused review skill:

- `~/.agents/skills/q-review-plan/SKILL.md` for pre-implementation planning review of `design.md`, optional `design-product.md`, `outline.md`, and `plan.md` when present.
- `~/.agents/skills/q-review-implementation/SKILL.md` for post-implementation code review after `/q-implement` completes.

## When Invoked

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Resolve the input:
   - `outline.md`, `design.md`, `design-product.md`, or `plan.md` path → planning review.
   - Implement-complete handoff path under `[plan_dir]/handoffs/` → implementation review.
   - Plan directory path → inspect artifacts to choose mode.
   - Canonical review artifact path under `[plan_dir]/reviews/*/review.md` → use the `review_mode` frontmatter if present.
1. If no input was provided, respond:

```text
I'll run a QRSPI review and route it based on whether implementation code exists.

Please provide one of:
- a product design or outline path, e.g. `/q-review thoughts/[git_username]/plans/.../design-product.md` or `/q-review thoughts/[git_username]/plans/.../outline.md`
- a plan path, e.g. `/q-review thoughts/[git_username]/plans/.../plan.md`
- an implement-complete handoff path, e.g. `/q-review thoughts/[git_username]/plans/.../handoffs/YYYY-MM-DD_HH-MM-SS_implement-handoff.md`
- or a plan directory path, e.g. `/q-review thoughts/[git_username]/plans/YYYY-MM-DD_HH-MM-SS_plan-name`
```

Then wait for input.

## Mode Resolution

### Planning review

Choose planning review when:

- the input is `design.md`, `design-product.md`, `outline.md`, or `plan.md`
- the user asks to review the design, product design, outline, plan, or planning docs
- the input is a plan directory that has no implement-complete handoff
- the input is a plan directory with `plan.md` but implementation is not complete

After resolving planning review, read and follow:

```text
~/.agents/skills/q-review-plan/SKILL.md
```

### Implementation review

Choose implementation review when:

- the input is an implement-complete handoff
- the input is a plan directory with a complete implement handoff in `[plan_dir]/handoffs/`
- the user explicitly asks to review completed code or implementation

A complete implement handoff is the final `/q-implement` handoff that points to `/q-review`, has `next_stage: review`, or otherwise states implementation is complete.

If both modes could apply for a plan directory, prefer implementation review only when a complete implement handoff is unambiguous. Otherwise run planning review.

After resolving implementation review, read and follow:

```text
~/.agents/skills/q-review-implementation/SKILL.md
```

## Rules

- Do not run both review modes in one invocation.
- Do not keep using this router after mode selection; load the focused skill and follow it.
- Planning review edits planning documents directly when findings are clear, including `design-product.md` when present. After a successful `plan.md` review, the next stage is `/q-workspace [plan.md]`, not `/q-implement`.
- Implementation review reviews code, applies only straightforward code fixes directly, and creates a review-directory QRSPI plan for deeper follow-up work.
- The focused review must summarize the current design/implementation and its alignment with PRDs, tickets, brainstormed requirements, and approved QRSPI constraints in both `review.md` and the user response.
- Always return the canonical review artifact path produced by the focused skill.
