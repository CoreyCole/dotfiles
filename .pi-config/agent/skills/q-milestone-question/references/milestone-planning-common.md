# Milestone Planning Common Reference

Use this reference for nested QRSPI milestone-planning skills.

## Artifact ownership model

Nested QRSPI separates project planning, milestone planning, and ticket planning.

### Project plan directory

Example: `thoughts/.../plans/2026-05-14_..._v2-domain-end-state-ticket-organization/`

Owns cross-milestone project truth:

- project goal and success criteria
- milestone taxonomy and sequencing, normally vertical by product path/scenario rather than horizontal by system layer/capability; milestone names should use product/domain names, not the word "Vertical"
- current milestone order in status/index docs, not numeric directory prefixes
- canonical milestone-planning status/dependency table
- cross-milestone decisions and approved taxonomy changes
- pointers to canonical PRDs/source docs
- process lessons from nested-QRSPI experiment

Does not own detailed implementation plans for each ticket, copied source requirements, or per-ticket current work status.

### Milestone directory

Example: `milestones/premium-growth-expression-variables/`

Owns local milestone truth:

- milestone goal, scope, non-goals
- Linear milestone link/status
- child planning issue link, e.g. PRO-9210
- list of eventual implementation/spec tickets for this milestone
- local status pointers to milestone-plan artifacts
- root-level `index.md` when the milestone needs a human/agent overview

Does not own full QRSPI stage artifacts, cross-milestone status dashboard, ticket-level implementation decisions, or milestone order in the directory name.

### Milestone-plan directory

Example: `milestones/premium-growth-expression-variables/milestone-plan/`

Owns milestone-level QRSPI:

- research agenda and factual current-state/source-doc research
- milestone design: ownership, user stories, target behavior, current to target direction, architecture-spec inputs, gap map, proposed ticket list
- create-tickets artifacts: per-ticket provider descriptions, approval notes, Linear creation/status-update execution
- create-tickets approval artifacts

Does not own implementation slices for future tickets, detailed code edit instructions, or final project-wide architecture narrative.

### Ticket directory

Example: `milestones/premium-growth-expression-variables/tickets/eng-0000-[slug]/`

Owns ticket-level QRSPI:

- stable identity path using provider issue key + slug, with no numeric ordering prefix
- root-level `index.md` as the ticket deliverable index
- root-level named deliverable docs for specs, strategies, inventories, or product artifacts
- ticket-specific question/research/design/outline/plan
- implementation/spec details for that ticket
- handoffs and implementation review artifacts
- ticket-specific durable decisions

Does not own milestone taxonomy changes, cross-milestone sequencing changes, unrelated milestone requirements, or ticket order in the directory name.

### Architecture spec / system design ticket

Example: PRO-9205.

Owns whole-system architecture synthesis:

- target system explanation
- current implemented system explanation
- critical path and milestone sequencing before detailed milestone planning when needed
- current to target path organized by milestone designs when those designs exist
- cross-cutting technical decisions

May challenge child milestone designs, but must not silently mutate them. Any scope/ticket-shape change routes back to affected milestone-plan design and create-tickets human confirmation.

Architecture/spec deliverables normally live as root-level docs in the owning ticket directory, linked from ticket `index.md`. Do not hide primary deliverables under `context/`; reserve `context/` for supporting research/scratch/evidence.

#### High-level spec before milestone planning

A high-level spec may come before milestone-level QRSPI to align the project on target architecture, critical-path sequence, and known milestone-planning inputs. It is a guide for future milestone planning, not a replacement for it.

Expected shape:

- concise target end state and architecture rules
- current-state facts only where they explain a gap, risk, or sequence decision
- milestone sequence with provider milestone links when available; use the issue-list milestone URL shape from the thoughts root `AGENTS.md` host manifest, not hard-coded URLs
- one proposed-work table per milestone
- table rows as planning inputs with columns like `Proposed work | Critical-path outcome | Notes | Linear`
- deployed E2E/Ranger verification as separate proposed-work rows, not hidden in a column
- final readiness/backstop table only for explicitly named leftover polish or edge-to-edge completeness
- source index linking canonical research, brainstorms, source docs, and Linear comments

Rules:

- Keep final spec text matter-of-fact and concise.
- Put decision reasoning, alternatives, and in-progress debate in `context/brainstorms/` or research docs.
- Do not treat proposed-work rows as final ticket boundaries. Milestone `design.md` and `/skill:q-milestone-create-tickets` decide final ticket count and titles.
- Do not create implementation tickets directly from the high-level spec table.
- Each plan/product milestone should own the deployed E2E/Ranger proof needed for that milestone unless the lead explicitly creates a shared verification milestone.

## Vertical milestone rule

Default to vertical milestone planning. A milestone should usually prove one end-to-end product path: one product path, one demo scenario, one user workflow, or one production-readiness increment. Sequence from simplest credible path to broader variants. Use product/domain milestone names; do not append "Vertical" to milestone names.

Good milestone boundaries:

- deliverable/testable/demoable by themselves
- tied to a named plan/scenario/user outcome
- include only the DB/API/UI/workflow/reporting pieces needed for that path
- expose cross-cutting platform gaps as dependencies, not as broad horizontal milestones by default

Smells requiring human review:

- "all DB", "all API", "all frontend", "all reporting", "all overrides", "all load testing"
- tickets grouped by implementation layer instead of user-visible proof
- no single scenario that can be manually verified at milestone end
- architecture/spec tickets trying to replace vertical scenario learning

## Milestone planning gates

Default milestone path:

```text
/skill:q-milestone-question [milestone-plan-dir]
/skill:q-milestone-research [questions.md]
/skill:q-milestone-design [research.md]
/skill:q-milestone-create-tickets [design.md]
# summarize design, confirm ticket-set structure, refine each ticket one by one, then ask before Linear mutation
```

Human gates:

- question alignment
- ticket-set structure approval during create-tickets
- per-ticket approval during create-tickets
- explicit provider-ticket mutation approval before creating/updating issues

Create-tickets owns the design approval moment: it summarizes the milestone design and proposed ticket set, then waits for human confirmation before drafting or creating provider tickets.

## Output style

Be concise. Sacrifice grammar for concision. Prefer tables and fragments over narrative.

## Required milestone design concepts

- current code/system state with file refs
- source-doc/requirement state with canonical links
- approved product outcomes and user-visible success
- target behavior as concise user stories, including engineer-as-user stories only when outcome/architecture-enabling
- gap map
- architecture-spec inputs, including API/db/type surfaces only when boundary-relevant
- proposed tickets mapped to user stories and gaps, organized as vertical slices where possible
- deferred details for ticket-level QRSPI
- cross-milestone dependencies
- taxonomy change proposals
- open human/product questions

## Source handling

Summaries allowed, but cite canonical source paths. Do not copy full requirements into milestone artifacts. Treat copied summaries as non-authoritative.

## Thoughts vs ticket provider

- `thoughts/` owns durable working memory: specs, designs, research, ADRs, field inventories, verification/load strategies, reviews, handoffs, and detailed plans.
- The ticket provider owns team-visible tracking: concise title, goal, acceptance criteria, status/assignee/priority/milestone, blockers, PR links, and links to canonical `thoughts/` docs.
- Provider issues should link to `thoughts/` rather than duplicate long tables, QRSPI research, or detailed implementation plans.

## Boundaries

Milestone-level QRSPI may inspect code freely for accurate current state. Research should give detailed high-level current-state context for future planners. Design stays concise and human-reviewable: product outcomes, ticket shaping, and architecture-input granularity. Ticket-level QRSPI owns exact implementation plans.

When a horizontal capability is truly required, name the vertical scenario it unlocks and keep the scope to the minimum reusable seam needed for that scenario plus near-term successors.
