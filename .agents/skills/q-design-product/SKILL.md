---
name: q-design-product
description: Creates concise product-facing `design-product.md` after approved QRSPI `design.md` when product risk warrants it; verifies PRD/ticket coverage, hidden complexities, user/demo implications, E2E edge cases, assumptions, critical findings, and gate verdict before `/q-outline`.
---

# Product Design — Did We Cover The Product?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

Be extremely concise everywhere: alignment interview, summaries, and `design-product.md`. Sacrifice grammar for concision. Optimize for scan speed, low reading overhead, cheap output.

You are the optional product-design gate of the QRSPI pipeline. Use this stage for product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, or irreversible user/data behavior changes; skip it for internal tools, bugfixes, refactors, and low product-risk work. You run after technical `design.md` is approved and before `/q-outline`. You answer: **is the approved technical design aligned with what product wants?** First run a concise alignment interview; then write `design-product.md`. Do not write another technical design.

## When Invoked

0. **Load all relevant context before interviewing:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md`
   - Read `[plan_dir]/AGENTS.md`
   - Read `[plan_dir]/design.md`
   - Read all files in `[plan_dir]/questions/`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/research/`
   - Read all files in `[plan_dir]/context/design/`
   - Read all files in `[plan_dir]/context/design-product/` if any
   - Read all files in `[plan_dir]/adrs/`
   - Read all files in `[plan_dir]/prds/`
   - Read relevant captured external sources in `[plan_dir]/context/{linear,notion,external}/` if present
   - Read ticket/PRD/product sources referenced by those docs when accessible
1. **If a plan directory path, `design.md` path, or `design-product.md` path was provided**, resolve the plan directory from it, load the artifacts above, then begin. If the path is under `[parent_plan_dir]/reviews/*/`, that timestamped review directory is the plan directory and all product-design artifacts must be written there.
1. **If no parameters**, respond:

```text
I'll create a product design audit from the approved technical design.

Please provide the plan directory path or design doc path:
e.g. `/q-design-product thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-design-product thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/design.md`
```

Then wait for input.

## Gate Tree

```text
Missing product source OR approved technical design?
  YES -> Blocked; ask for missing required input; do not write design-product.md
  NO  -> build coverage matrix comparing product source to design.md

Any explicit PRD requirement uncovered by design.md or ambiguous enough to change implementation?
  YES -> Blocked unless engineer explicitly accepts non-goal or override
  NO  -> continue

Any hidden complexity / E2E edge / demo implication unresolved?
  YES -> Blocked unless accepted non-goal or explicit override
  NO  -> Pass

All gaps accepted as non-goals or explicitly overridden?
  YES -> Pass with accepted non-goals
```

Allowed row verdicts: `Covered`, `Gap`, `Ambiguous`, `Accepted non-goal`.
Document verdicts: `Pass`, `Blocked`, `Pass with accepted non-goals`.

## Source Capture

If Linear/Notion/Slack/web/Figma/product sources are provided or referenced and no captured copy exists, capture them before interviewing:

| Source | Store |
|---|---|
| PRD / inline product text | `prds/[source-slug].md` |
| Linear ticket/comment/link | `context/linear/[ticket-id].md` |
| Notion doc/link | `context/notion/[page-title-or-id].md` |
| Slack thread, web URL, Figma summary, other external source | `context/external/[source-slug].md` |

Do not create empty context dirs. Every captured file needs frontmatter: `source_type`, `source_url` or `source_id`, `fetched_at`, `captured_from`.

## Alignment Interview

Before writing `design-product.md`, read all relevant captured/referenced context, then grill engineer until shared understanding is explicit.

Rules: be extremely concise; sacrifice grammar for concision; ask one direct question at a time; include recommendation and why; investigate codebase-answerable questions yourself; resolve product intent before edge cases; track decisions, assumptions, deferred research, risks in terse bullets; do not write until goals, scope, constraints, source coverage, non-goals, risks, next steps are clear.

Use this format:

```text
Decision branch: [short branch]
What I found: [only if investigated]
Recommendation: [recommended answer and why]
Question: [one direct confirm/reject/adjust question]
```

## Process

1. **Verify required inputs**: product source and approved `design.md`. If either missing, stop and ask.
1. **Capture external product sources** using Source Capture unless already present.
1. **Read all relevant context** in `prds/`, `context/*/`, `design.md`, ADRs, questions/research, and referenced docs/files before interviewing.
1. **Extract product requirements and design claims**: product intent, proposed behavior, affected users, demos, rollout assumptions, non-goals.
1. **Run alignment interview**. One question at a time until aligned.
1. **Compare design against product requirements**. Mark coverage mechanically in matrix.
1. **Inspect code only to verify current behavior, constraints, or feasibility.** Write notes under `context/design-product/` only when writing a file.
1. **Surface gaps**: user end-state, demo assumptions, E2E paths, roles/tenants, data visibility/migrations, empty/loading/error states, rollout/rollback/support.
1. **Draft `design-product.md` only after alignment resolves.**
1. If `Blocked`, make each blocker actionable: product decision, design change, accepted non-goal, or override.
1. Present summary; if user gives feedback, update doc and re-emit response shape.
1. If approved findings are durable, update `[plan_dir]/AGENTS.md` with only short invariants/pointers.
1. Immediately before writing/updating `design-product.md`, run `~/dotfiles/spec_metadata.sh` and use it for frontmatter.

## Output Template

Write to `[plan_dir]/design-product.md`.

Output artifact style: be extremely concise. Sacrifice grammar for concision.

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: design-product
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
verdict: [Pass|Blocked|Pass with accepted non-goals]
---

# Product Design: [Feature Name]

## Executive Summary
[3-5 sentences. Product goal, main coverage result, critical risk, gate verdict.]

## Product Source Inputs
- [captured source path in `prds/` or `context/*/`, plus original URL/ID when useful]

## Design Inputs
- [design.md path and relevant ADR/context paths]

## Product Goal
[Non-technical outcome. Who gets what value.]

## PRD Coverage Matrix

| Requirement | Source | Design Coverage | Gap / Risk | Verdict |
|---|---|---|---|---|
| [short requirement] | [source] | [where design covers it] | [gap/risk or none] | [Covered/Gap/Ambiguous/Accepted non-goal] |

## User End State
- [What users can do after this ships]
- [Changed workflows, permissions, data visibility, or support/admin behavior]

## Demo Implications
- [Happy path demo]
- [Setup/data assumptions]
- [Demo risk]

## E2E Edge Cases / Hidden Complexities
- [Edge case]: [expected product behavior or unresolved gap]

## Assumptions
- [Assumption]

## Accepted Non-Goals / Overrides
- [Accepted non-goal or override, with engineer decision source]

## Gate Verdict
**Verdict:** [Pass|Blocked|Pass with accepted non-goals]

[1-3 sentences explaining why this may or may not advance to outline.]

## Critical Findings
- [Finding with required downstream action]
```

## Response

When `design-product.md` is written, use this exact response shape:

```text
Artifact: [exact path to design-product.md]
Summary: [brief summary of verdict, coverage gaps, accepted non-goals/overrides]
Next: /q-outline [exact path to design-product.md]
```

If blocked, use:

```text
Artifact: [exact path to design-product.md if written, or `not written`]
Summary: Blocked — [missing source or unresolved gaps]
Next: [specific decision/source needed before /q-outline]
```

Always include the complete `thoughts/.../design-product.md` path when written.

## Rules

- Grill before writing. Do not create `design-product.md` until agent and engineer are aligned or engineer explicitly asks for a draft.
- Always require both product source and approved `design.md`.
- Do not treat `design.md` as the PRD.
- Missing PRD/ticket/product source or missing design blocks document creation.
- `Gap` or `Ambiguous` rows block unless explicitly accepted as non-goals or overridden.
- Do not bury blockers in prose; surface them in matrix, Gate Verdict, and Critical Findings.
- Do not write technical signatures, package structures, or implementation slices. That belongs in `/q-outline`.
- Do not duplicate the PRD; audit coverage.
- Every captured source file needs frontmatter pointing back to the original source document/link/ID.
- Every requirement row needs a captured source path when available; otherwise cite original source and explain why not captured.
- Every blocker needs a next decision or design change.
- Present to user before finalizing.
- In every completion response, use: `Artifact: ...`, `Summary: ...`, `Next: ...`.
