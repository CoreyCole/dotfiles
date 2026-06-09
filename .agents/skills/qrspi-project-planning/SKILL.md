---
name: qrspi-project-planning
description: High-level doctrine for nested QRSPI project and epic planning. Use when planning an epic with milestone-plan directories, splitting a project into milestone planning and future tickets, creating project status artifacts, or deciding how project, milestone, milestone-plan, and ticket QRSPI artifacts relate.
---

# QRSPI Project Planning

Use this doctrine when QRSPI is used above the single-ticket level: project plan directories contain milestone directories; milestone-level QRSPI decides what tickets should exist; ticket-level QRSPI decides how to complete one ticket.

## Mindset

Project planning should uncover hidden complexity early, expose ambiguities before tickets are created, and give product/lead engineers a concise artifact they can sign off on: "yes, we are building in the right direction."

Optimize for:

- vertical milestone slices: one demonstrable product path/bonus plan/scenario at a time
- fastest credible testable/demoable path before generalized capability layering
- product outcomes surfaced early and preserved through ticket shaping
- sequencing/gating before ticket creation
- traceability from source docs and current code to proposed tickets
- concise milestone designs that surface product/architecture risk and proposed ticket boundaries
- detailed high-level current-state research for future planners
- durable context without drowning future agents
- human judgment at question/design approval points and before Linear mutation

Do not optimize for parallelizing human judgment. Agents can research and draft, but lead/product approval owns direction.

## Artifact ownership model

### Project plan directory

Owns cross-milestone truth:

- project goal and success criteria
- milestone taxonomy and sequencing, preferably vertical by bonus plan/scenario/user path rather than horizontal system layer/capability area
- canonical milestone-planning status/dependency artifact
- cross-milestone decisions and approved taxonomy changes
- pointers to canonical PRDs/source docs
- process lessons from nested-QRSPI runs

Does not own detailed ticket implementation plans, copied source requirements, or per-ticket work status.

### Milestone directory

Owns local milestone memory:

- milestone goal, scope, non-goals
- Linear milestone/planning ticket links
- canonical pointers
- durable milestone decisions
- suggested next command

Use `AGENTS.md` for this because it auto-loads. Keep it curated. Do not put live dashboards, long source summaries, or proposed ticket descriptions in milestone `AGENTS.md`.

### Milestone-plan directory

Owns milestone-level QRSPI:

- question/research/design artifacts
- current code/system state research
- source-doc/requirement summaries with citations
- target behavior user stories, including engineer-as-user stories
- gap map and architecture/spec inputs inside `design.md`
- proposed ticket list inside `design.md`
- one-by-one ticket description refinement under `context/create-tickets/`
- automated and human review artifacts

Milestone-level QRSPI answers: **what product outcomes does this milestone own, and what tickets should exist to deliver them?**

### Ticket directory

Owns ticket-level QRSPI:

- ticket-specific question/research/design/outline/plan
- implementation/spec details
- handoffs and implementation review artifacts
- ticket-specific durable decisions

Ticket-level QRSPI answers: **how do we complete this ticket?**

### Architecture/spec synthesis ticket

A project may have a whole-system architecture/spec ticket. It consumes reviewed milestone designs, explains target system and current state, then maps current to target through milestone designs.

It may challenge child milestone designs, but must not silently mutate them. Scope/ticket-shape changes route back to the affected milestone design review and human approval.

## Standard milestone planning flow

Before running a milestone flow, check whether the milestone is vertical. A good milestone should usually deliver or de-risk one end-to-end product path: one bonus plan, one demo scenario, one customer workflow, or one production-readiness increment. Avoid planning a milestone as "all database", "all API", "all frontend", "all reporting", "all overrides", or another horizontal layer unless it is purely enabling and explicitly blocks multiple vertical slices.

```text
/q-milestone-question [milestone-plan-dir]
/q-milestone-research [question.md]
/q-milestone-design [research.md]
/q-milestone-review [design.md]
# human approval: review-human.md beside automated design review
/q-milestone-create-tickets [design.md]
# skill presents/refines each ticket one by one, then asks before Linear mutation
```

Human gates:

- question alignment
- design approval after automated design review
- per-ticket approval during create-tickets
- explicit Linear mutation approval before creating/updating issues

Automated milestone review should improve the design, not just report issues.

## Source of truth rules

- Canonical source docs stay canonical. Summaries are allowed only when concise and cited.
- Project status artifact owns exact paths, gates, and recovery state.
- Linear may mirror high-level team-visible status, but must not replace the repo status artifact.
- Linear comments/descriptions should link back to repo artifacts instead of duplicating full tables.
- `AGENTS.md` files are durable memory, not dashboards.
- `review-human.md` records human approval at gates.

## Milestone design purpose

Milestone `design.md` is the critical sign-off artifact. It is product-outcome ticket shaping, not normal QRSPI implementation design. Keep it high-level enough for product/lead review, but concrete enough to reveal hidden complexity and shape future tickets.

Milestone design must prefer vertical sequencing. Start from the smallest meaningful testable/demoable path and shape tickets around what is required to make that path work end-to-end. Only add horizontal/platform tickets when they are necessary to unlock that path or prevent rework in the next vertical slice.

It must connect:

```text
canonical sources + current code state
  → approved product outcomes / concise user stories
  → gaps / ambiguities / dependencies
  → architecture/spec inputs
  → proposed tickets
```

Product outcomes come first. Engineer enablement can be a user story only when it supports product outcomes or architecture/spec readiness. Keep stories concise; sacrifice grammar for concision.

## Milestone create-tickets purpose

Milestone create-tickets turns a reviewed and human-approved design into Linear-ready ticket descriptions and then Linear issues.

It presents each proposed ticket one by one for human refinement. After all ticket drafts are approved, it asks for explicit mutation approval, creates Linear tickets, applies relations/default fields, updates status docs, and creates routing-only ticket directories after Linear IDs exist. It should not become a code implementation plan or whole-system architecture spec.

## Templates and contracts

Load these references only when creating or reviewing the matching artifact:

- `references/project-status-template.md` — project status/dependency artifact skeleton
- `references/milestone-agents-template.md` — milestone `AGENTS.md` skeleton
- `references/human-review-template.md` — `review-human.md` skeleton
- `references/milestone-outline-contract.md` — legacy validity checklist for old milestone outlines
- `references/milestone-plan-contract.md` — legacy validity checklist for old milestone plans

## Anti-patterns

Avoid:

- horizontal milestone taxonomies such as "DB first, then API, then frontend", "all reporting", "all overrides", or "all load testing" when a vertical bonus-plan/demo path can prove value sooner
- creating implementation/spec tickets directly from the project plan
- forcing normal `/q-outline` or `/q-plan` onto milestone meta-planning
- reviving milestone `outline.md`/`plan.md` as required gates instead of using reviewed design + create-tickets
- hiding live status in `AGENTS.md`
- copying full PRDs/requirements into child dirs
- treating clean LLM review as product/lead approval
- creating temp ticket dirs before Linear IDs exist
- allowing child milestones to silently rename/reorder project taxonomy
- writing milestone plans as code-edit slice plans

## Relationship to other skills

Read `~/.agents/skills/qrspi-planning/SKILL.md` for base QRSPI stage mechanics and XML contract.

Use milestone-specific skills for nested project planning:

- `/q-milestone-question`
- `/q-milestone-research`
- `/q-milestone-design`
- `/q-milestone-review`
- `/q-milestone-create-tickets`

Legacy skills `/q-milestone-outline` and `/q-milestone-plan` may exist for old artifacts, but new milestone planning should not use them.

If a milestone skill does not load this doctrine, treat that as skill maintenance, not normal project-planning work.
