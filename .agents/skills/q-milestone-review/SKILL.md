---
name: q-milestone-review
description: Review milestone-level QRSPI design artifacts for nested project planning. Use when running /q-milestone-review on milestone design.md before ticket creation. Checks artifact ownership, requirement traceability, current-state evidence, architecture-spec readiness, ticket boundaries, dependencies, and readiness for one-by-one ticket creation.
---

# Milestone Review — Is This Ready for the Next Gate?

Use this as the Review stage for milestone-level QRSPI. It reviews milestone `design.md` before ticket creation. It replaces the old outline/plan review gates for new milestone planning.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-review/SKILL.md`
1. `~/.agents/skills/q-review-plan/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. `design.md` artifact under review
1. prior milestone-plan artifacts needed to evaluate it
1. milestone-plan `AGENTS.md`
1. milestone `AGENTS.md` and optional `milestone.md`
1. project plan `AGENTS.md` for canonical pointers/invariants

For new milestone planning, review `design.md` only. If given legacy `outline.md` or `plan.md`, review it only to finish an in-flight old flow; do not route new work through those gates.

## Step 2: Review design

Check:

- milestone ownership/non-goals clear
- current-state/source-doc evidence sufficient for design
- product outcomes/user-visible success clear and expressed as concise user stories
- gap map identifies user-visible and architecture/spec gaps
- architecture-spec inputs identified at design granularity
- proposed tickets each map to approved outcomes/user stories and gaps
- expected evidence for each ticket is concrete enough to seed Linear descriptions
- dependencies have owner/status and blocking order is clear
- deferred details really belong to ticket-level QRSPI
- ticket boundaries are neither too broad nor too narrow
- cross-milestone dependencies surfaced
- taxonomy changes proposed, not silently applied
- implementation details not over-specified

Next after clean automated review: human writes `review-human.md`, then `/q-milestone-create-tickets [design.md]`.

## Step 3: Write review artifact

Create:

```text
reviews/YYYY-MM-DD_HH-MM-SS_[slug]_[design|outline|plan]-review/review.md
```

Use q-review-plan finding categories when useful:

- `obvious_doc_fix` — edit milestone docs directly
- `needs_codebase_research` — create follow-up research questions in the review dir
- `needs_human_judgment` — ask via `/answer`

For clear doc fixes, update parent milestone-planning docs directly and run `just sync-thoughts` when available/appropriate.

## Step 4: Human approval convention

Do not write `review-human.md` yourself unless the user explicitly gives the approval decision. When approval is given, record it beside `review.md`:

```text
reviews/.../review-human.md
```

Include approver, date, decision, notes, applied/deferred edits, and pointer to reviewed artifact.

## Response

Standard result fields required: `<qrspi-result>`, `<stage>`, `<status>`, `<outcome>`, `<workspace>`, `<policy>`, `<summary>`, `<artifact>`, and `<next>`.
End completed stage responses with standard fenced XML `<qrspi-result>` from `qrspi-planning`.

Use explicit milestone review node ID:

- `<stage>milestone-review</stage>`

Set `<artifact>` to `reviews/.../review.md` and `<next>` to human approval, then `/q-milestone-create-tickets [design.md]`.
