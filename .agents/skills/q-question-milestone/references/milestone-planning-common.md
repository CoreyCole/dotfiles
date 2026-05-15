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
- milestone design: ownership, user stories, target behavior, current to target direction
- milestone outline: architecture-spec inputs, gap map, proposed ticket list
- milestone plan: Linear ticket creation/status-update execution
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
- current to target path organized by reviewed milestone outlines
- cross-cutting technical decisions

May challenge child milestone outlines, but must not silently mutate them. Any scope/ticket-shape change routes back to affected milestone-plan outline, automated review, and human approval.

## Milestone planning gates

Default milestone path:

```text
/q-question-milestone [milestone-plan-dir]
/q-research-milestone [questions.md]
/q-design-milestone [research.md]
/q-review-milestone [design.md]
# human writes review-human.md in design review dir
/q-outline-milestone [design.md]
/q-review-milestone [outline.md]
# human writes review-human.md in outline review dir
/q-plan-milestone [outline.md]
/q-review-milestone [plan.md]
# execute Linear ticket creation and status updates
```

Human gates:

- question alignment
- design after automated design review
- outline after automated outline review
- Linear mutation after reviewed plan when project policy requires it

Planning reviews are agent-driven. Human approval gets recorded as `review-human.md` in the automated review directory.

## Output style

Be concise. Sacrifice grammar for concision. Prefer tables and fragments over narrative.

## Required milestone outline concepts

- current code/system state with file refs
- source-doc/requirement state with canonical links
- target behavior as concise user stories, including engineer-as-user stories
- gap map
- architecture-spec inputs
- proposed tickets mapped to user stories and gaps
- deferred details for ticket-level QRSPI
- cross-milestone dependencies
- taxonomy change proposals
- open human/product questions

## Source handling

Summaries allowed, but cite canonical source paths. Do not copy full requirements into milestone artifacts. Treat copied summaries as non-authoritative.

## Boundaries

Milestone-level QRSPI may inspect code freely for accurate current state. Its outputs stay at ticket-shaping and architecture-input granularity. Ticket-level QRSPI owns exact implementation plans.
