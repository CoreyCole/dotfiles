---
name: qrspi-project-planning
description: High-level doctrine for nested QRSPI project and epic planning. Use when planning an epic with milestone-plan directories, splitting a project into milestone planning and future tickets, creating project status artifacts, or deciding how project, milestone, milestone-plan, and ticket QRSPI artifacts relate.
---

# QRSPI Project Planning

Use this doctrine when QRSPI is used above the single-ticket level: project plan directories contain milestone directories; milestone-level QRSPI decides what tickets should exist; ticket-level QRSPI decides how to complete one ticket.

## Mindset

Project planning should uncover hidden complexity early, expose ambiguities before tickets are created, and give product/lead engineers a concise artifact they can sign off on: "yes, we are building in the right direction."

Optimize for:

- sequencing/gating before ticket creation
- traceability from source docs and current code to proposed tickets
- concise high-level outlines that surface product/architecture risk
- durable context without drowning future agents
- human judgment at question/design/outline approval points

Do not optimize for parallelizing human judgment. Agents can research and draft, but lead/product approval owns direction.

## Artifact ownership model

### Project plan directory

Owns cross-milestone truth:

- project goal and success criteria
- milestone taxonomy and sequencing
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

- question/research/design/outline/plan artifacts
- current code/system state research
- source-doc/requirement summaries with citations
- target behavior user stories, including engineer-as-user stories
- gap map and architecture/spec inputs
- proposed ticket list and ticket creation plan
- automated and human review artifacts

Milestone-level QRSPI answers: **what tickets should exist for this milestone?**

### Ticket directory

Owns ticket-level QRSPI:

- ticket-specific question/research/design/outline/plan
- implementation/spec details
- handoffs and implementation review artifacts
- ticket-specific durable decisions

Ticket-level QRSPI answers: **how do we complete this ticket?**

### Architecture/spec synthesis ticket

A project may have a whole-system architecture/spec ticket. It consumes reviewed milestone outlines, explains target system and current state, then maps current to target through milestone outlines.

It may challenge child milestone outlines, but must not silently mutate them. Scope/ticket-shape changes route back to the affected milestone outline review and human approval.

## Standard milestone planning flow

```text
/q-question-milestone [milestone-plan-dir]
/q-research-milestone [question.md]
/q-design-milestone [research.md]
/q-review-milestone [design.md]
# human approval: review-human.md beside automated design review
/q-outline-milestone [design.md]
/q-review-milestone [outline.md]
# human approval: review-human.md beside automated outline review
/q-plan-milestone [outline.md]
/q-review-milestone [plan.md]
# execute ticket creation/status updates after reviewed plan
```

Human gates:

- question alignment
- design approval after automated design review
- outline approval after automated outline review
- Linear mutation approval when project policy requires it

Automated milestone review should improve artifacts, not just report issues.

## Source of truth rules

- Canonical source docs stay canonical. Summaries are allowed only when concise and cited.
- Project status artifact owns exact paths, gates, and recovery state.
- Linear may mirror high-level team-visible status, but must not replace the repo status artifact.
- Linear comments/descriptions should link back to repo artifacts instead of duplicating full tables.
- `AGENTS.md` files are durable memory, not dashboards.
- `review-human.md` records human approval at gates.

## Milestone outline purpose

Milestone `outline.md` is the critical sign-off artifact. It should be high-level enough for product/lead review, but concrete enough to reveal hidden complexity and shape future tickets.

It must connect:

```text
canonical sources + current code state
  → concise user stories
  → gaps / ambiguities / dependencies
  → architecture/spec inputs
  → proposed tickets
```

Engineer enablement can be a user story. Keep stories concise; sacrifice grammar for concision.

## Milestone plan purpose

Milestone `plan.md` is operational. It turns an approved/reviewed outline into ticket creation and status/routing updates.

It should include Linear-ready ticket description docs, dependency/relations, status updates, and ticket directory creation steps after Linear IDs exist. It should not become a code implementation plan or whole-system architecture spec.

## Templates and contracts

Load these references only when creating or reviewing the matching artifact:

- `references/project-status-template.md` — project status/dependency artifact skeleton
- `references/milestone-agents-template.md` — milestone `AGENTS.md` skeleton
- `references/human-review-template.md` — `review-human.md` skeleton
- `references/milestone-outline-contract.md` — validity checklist for milestone outlines
- `references/milestone-plan-contract.md` — validity checklist for milestone plans

## Anti-patterns

Avoid:

- creating implementation/spec tickets directly from the project plan
- forcing normal `/q-outline` or `/q-plan` onto milestone meta-planning
- hiding live status in `AGENTS.md`
- copying full PRDs/requirements into child dirs
- treating clean LLM review as product/lead approval
- creating temp ticket dirs before Linear IDs exist
- allowing child milestones to silently rename/reorder project taxonomy
- writing milestone plans as code-edit slice plans

## Relationship to other skills

Read `~/.agents/skills/qrspi-planning/SKILL.md` for base QRSPI stage mechanics and XML contract.

Use milestone-specific skills for nested project planning:

- `/q-question-milestone`
- `/q-research-milestone`
- `/q-design-milestone`
- `/q-outline-milestone`
- `/q-plan-milestone`
- `/q-review-milestone`

If a milestone skill does not load this doctrine, treat that as skill maintenance, not normal project-planning work.
