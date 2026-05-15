---
name: q-milestone-review
description: Review milestone-level QRSPI design, outline, or plan artifacts for nested project planning. Use when running /q-milestone-review on milestone design.md, outline.md, or plan.md. Checks artifact ownership, user-story traceability, current-state evidence, architecture-spec readiness, ticket boundaries, dependencies, and Linear ticket creation safety.
---

# Milestone Review — Is This Ready for the Next Gate?

Use this as the Review stage for milestone-level QRSPI. It mirrors `/q-review`, but reviews milestone-planning artifacts, not code implementation plans.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-review/SKILL.md`
1. `~/.agents/skills/q-review-plan/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. artifact under review
1. prior milestone-plan artifacts needed to evaluate it
1. milestone-plan `AGENTS.md`
1. milestone `milestone.md`
1. project plan `AGENTS.md` for canonical pointers/invariants

Determine artifact type from filename: `design.md`, `outline.md`, or `plan.md`.

## Step 2: Review by artifact type

### Design review

Check:

- milestone ownership/non-goals clear
- current-state/source-doc evidence sufficient for design
- product outcomes/user-visible success clear and expressed as concise user stories
- architecture-spec inputs identified at design granularity
- cross-milestone dependencies surfaced
- taxonomy changes proposed, not silently applied
- ticket-shaping principles clear
- implementation details not over-specified

Next after clean automated review: human writes `review-human.md`, then `/q-milestone-outline [design.md]`.

### Outline review

Check:

- every proposed ticket maps to approved product outcomes or outcome-enabling user stories and gaps
- outline stays high-level ticket shaping, not normal header-file implementation outline
- current code/system state has evidence
- requirement summaries cite canonical sources
- architecture-spec inputs are sufficient for whole-system architecture ticket, with API/db/type surfaces only when boundary-relevant
- dependencies have owner/status
- deferred details really belong to ticket-level QRSPI
- ticket boundaries are neither too broad nor too narrow
- taxonomy proposals require project/lead approval

Next after clean automated review: human writes `review-human.md`, then `/q-milestone-plan [outline.md]`.

### Plan review

Check:

- preconditions include reviewed and human-approved outline
- plan is operational, not an implementation plan
- ticket description docs exist and are Linear-ready
- Linear fields/relations/status updates are complete
- do-not-create-if guards exist for conditional tickets
- ticket dirs created only after Linear IDs exist
- routing-only ticket `AGENTS.md` template is present
- rollback/correction steps are clear

Next after clean automated review: execute ticket creation/status updates per plan.

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

Use explicit review node IDs:

- `<stage>review-design</stage>` for design
- `<stage>review-outline</stage>` for outline
- `<stage>review-plan</stage>` for plan

Set `<artifact>` to `reviews/.../review.md` and `<next>` to the next milestone command or human approval instruction.
