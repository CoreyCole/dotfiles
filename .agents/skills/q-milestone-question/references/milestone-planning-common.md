# Milestone Planning Common Reference

Use this reference for nested QRSPI milestone-planning skills.

## Artifact ownership model

Nested QRSPI separates project planning, milestone planning, and ticket planning.

### Project plan directory

Example: `thoughts/.../plans/2026-05-14_..._v2-bonuses-end-state-linear-organization/`

Owns cross-milestone project truth:

- project goal and success criteria
- milestone taxonomy and sequencing
- canonical milestone-planning status/dependency table
- cross-milestone decisions and approved taxonomy changes
- pointers to canonical PRDs/source docs
- process lessons from nested-QRSPI experiment

Does not own detailed implementation plans for each ticket, copied source requirements, or per-ticket current work status.

### Milestone directory

Example: `milestones/02-premium-growth-expression-variables/`

Owns local milestone truth:

- milestone goal, scope, non-goals
- Linear milestone link/status
- child planning issue link, e.g. PRO-9210
- list of eventual implementation/spec tickets for this milestone
- local status pointers to milestone-plan artifacts

Does not own full QRSPI stage artifacts, cross-milestone status dashboard, or ticket-level implementation decisions.

### Milestone-plan directory

Example: `milestones/02-premium-growth-expression-variables/milestone-plan/`

Owns milestone-level QRSPI:

- research agenda and factual current-state/source-doc research
- milestone design: ownership, user stories, target behavior, current to target direction, architecture-spec inputs, gap map, proposed ticket list
- create-tickets artifacts: per-ticket Linear descriptions, approval notes, Linear creation/status-update execution
- automated and human review artifacts

Does not own implementation slices for future tickets, detailed code edit instructions, or final project-wide architecture narrative.

### Ticket directory

Example: `milestones/02-premium-growth-expression-variables/tickets/01-pro-####-[slug]/`

Owns ticket-level QRSPI:

- ticket-specific question/research/design/outline/plan
- implementation/spec details for that ticket
- handoffs and implementation review artifacts
- ticket-specific durable decisions

Does not own milestone taxonomy changes, cross-milestone sequencing changes, or unrelated milestone requirements.

### Architecture spec / system design ticket

Example: PRO-9205.

Owns whole-system architecture synthesis:

- target system explanation
- current implemented system explanation
- current to target path organized by reviewed milestone designs
- cross-cutting technical decisions

May challenge child milestone designs, but must not silently mutate them. Any scope/ticket-shape change routes back to affected milestone-plan design, automated review, and human approval.

## Milestone planning gates

Default milestone path:

```text
/q-milestone-question [milestone-plan-dir]
/q-milestone-research [questions.md]
/q-milestone-design [research.md]
/q-milestone-review [design.md]
# human writes review-human.md in design review dir
/q-milestone-create-tickets [design.md]
# refine each ticket one by one, then ask before Linear mutation
```

Human gates:

- question alignment
- design after automated design review
- per-ticket approval during create-tickets
- explicit Linear mutation approval before creating/updating issues

Planning reviews are agent-driven. Human approval gets recorded as `review-human.md` in the automated review directory.

## Output style

Be concise. Sacrifice grammar for concision. Prefer tables and fragments over narrative.

## Required milestone design concepts

- current code/system state with file refs
- source-doc/requirement state with canonical links
- approved product outcomes and user-visible success
- target behavior as concise user stories, including engineer-as-user stories only when outcome/architecture-enabling
- gap map
- architecture-spec inputs, including API/db/type surfaces only when boundary-relevant
- proposed tickets mapped to user stories and gaps
- deferred details for ticket-level QRSPI
- cross-milestone dependencies
- taxonomy change proposals
- open human/product questions

## Source handling

Summaries allowed, but cite canonical source paths. Do not copy full requirements into milestone artifacts. Treat copied summaries as non-authoritative.

## Boundaries

Milestone-level QRSPI may inspect code freely for accurate current state. Research should give detailed high-level current-state context for future planners. Design stays concise and human-reviewable: product outcomes, ticket shaping, and architecture-input granularity. Ticket-level QRSPI owns exact implementation plans.
