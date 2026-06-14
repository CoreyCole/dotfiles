---
name: qrspi-project-planning
description: High-level doctrine for nested QRSPI project and epic planning. Use when planning an epic with milestone-plan directories, splitting a project into milestone planning and future tickets, creating project status artifacts, or deciding how project, milestone, milestone-plan, and ticket QRSPI artifacts relate.
---

# QRSPI Project Planning

Use this doctrine when QRSPI is used above the single-ticket level: project plan directories contain milestone directories; milestone-level QRSPI decides what tickets should exist; ticket-level QRSPI decides how to complete one ticket.

## Mindset

Project planning should uncover hidden complexity early, expose ambiguities before tickets are created, and give product/lead engineers a concise artifact they can sign off on: "yes, we are building in the right direction."

Project-planning work is normally **thoughts-only**: it creates and updates durable artifacts under `thoughts/` and syncs them with `just sync-thoughts`. It does not need `/q-workspace`, copied implementation directories, Graphite slice branches, or code-implementation handoffs unless a later ticket explicitly transitions into source-code changes.

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

- `index.md` as the human/agent entrypoint and executive overview
- project goal and success criteria
- milestone taxonomy and sequencing, preferably vertical by bonus plan/scenario/user path rather than horizontal system layer/capability area; milestone names should use product/domain names, not the word "Vertical"
- current milestone order in a status/index doc, not in directory names
- canonical milestone-planning status/dependency artifact
- cross-milestone decisions and approved taxonomy changes
- pointers to canonical PRDs/source docs
- process lessons from nested-QRSPI runs

Does not own detailed ticket implementation plans, copied source requirements, per-ticket work status, or milestone/ticket ordering in path names.

### Milestone directory

Owns local milestone memory:

- stable identity path under `milestones/[milestone-slug]/`; do not prefix with sequence numbers because milestones are often reordered
- `index.md` as the milestone entrypoint and overview
- milestone goal, scope, non-goals
- Linear milestone/planning ticket links
- canonical pointers
- durable milestone decisions
- suggested next command

Use `AGENTS.md` for auto-loaded durable memory. Keep it curated. Do not put live dashboards, long source summaries, proposed ticket descriptions, or hidden deliverables in milestone `AGENTS.md`.

### Milestone-plan directory

Owns milestone-level QRSPI:

- `index.md` as the milestone-planning entrypoint when the directory has more than stage artifacts
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

- stable identity path under `tickets/pro-####-slug/`; do not prefix with sequence numbers because ticket order changes and Linear IDs are stable
- `index.md` as the ticket deliverable index and high-level overview
- root-level named deliverable docs such as `architecture.md`, `verification-strategy.md`, `load-e2e-stress-strategy.md`, or field inventories
- ticket-specific question/research/design/outline/plan
- implementation/spec details
- handoffs and implementation review artifacts
- ticket-specific durable decisions

Ticket-level QRSPI answers: **how do we complete this ticket?**

Important ticket deliverables live at the ticket root next to `index.md`; do not bury them in `context/`.

### Architecture/spec synthesis ticket

A project may have a whole-system architecture/spec ticket. It can run before detailed milestone planning when the team needs a concise high-level spec to align on the target system, critical path, milestone sequencing, and known cross-milestone seams.

It may challenge child milestone designs, but must not silently mutate them. Scope/ticket-shape changes route back to the affected milestone design review and human approval.

Architecture/spec synthesis tickets are thoughts-only unless their approved plan edits production source files. If the output is a living spec, project status doc, Linear/ticket memory, milestone map, or other `thoughts/` artifact, the plan must say `execution_mode: thoughts-only`, omit `Implementation Workspace Prep`, and route after plan review directly to thoughts-only `/q-implement` in the current checkout. The implement stage edits `thoughts/...`, runs verification and `just sync-thoughts`, and does not create a copied workspace or Graphite slice branches.

Whole-system architecture/spec deliverables normally live as root-level docs in the owning ticket directory, with `index.md` linking them. Only put the deliverable at project root when it is truly project-owned rather than ticket-owned.

#### High-level spec before milestone planning

A pre-milestone high-level spec is not a milestone design and not a ticket manifest. It should give enough direction for future milestone QRSPI to start from aligned facts without pretending ticket boundaries are final.

Good high-level spec shape:

- concise purpose/audience and target end state
- current-state facts only where they affect target gaps or sequencing
- domain model and non-negotiable architecture rules
- milestone sequence with links to Linear issue-list milestone views when milestones already exist; use `https://linear.app/chestnut/project/[project-slug]/issues#milestone-[milestone-id]`, not `/overview#milestone-...`
- one section/table per future milestone, using rows as milestone-planning inputs
- row columns such as `Proposed work | Critical-path outcome | Notes | Linear`
- separate rows for deployed E2E/Ranger proof when that work is expected to become a ticket
- a final readiness/backstop section only for explicitly identified leftover polish or edge-to-edge completeness
- source index linking canonical research, brainstorms, Linear comments, and source docs

Rules for this spec:

- Keep the spec matter-of-fact: final decisions and accepted direction only.
- Put reasoning, alternatives, user quotes, and unresolved debate in `context/brainstorms/` or research docs, then link them from the source index.
- Rows are planning inputs, not final Linear ticket boundaries. A row can become zero, one, or many tickets after milestone design/review/human approval.
- Do not create implementation/spec tickets directly from this table. `/q-milestone-create-tickets` owns final ticket creation after the milestone design is reviewed and human-approved.
- Each plan/product milestone owns its own deployed E2E/Ranger verification unless a human explicitly defines a separate shared verification milestone.
- Do not invent generic final-readiness scope. The final readiness milestone should contain only named leftover requirements or lead-approved polish/backstop work.

## Standard milestone planning flow

Before running a milestone flow, check whether the milestone is vertical. A good milestone should usually deliver or de-risk one end-to-end product path: one bonus plan, one demo scenario, one customer workflow, or one production-readiness increment. Avoid planning a milestone as "all database", "all API", "all frontend", "all reporting", "all overrides", or another horizontal layer unless it is purely enabling and explicitly blocks multiple vertical slices. Use product/domain milestone names; do not append "Vertical" to milestone names.

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
- Important deliverables live at the project/milestone/ticket root with clear names and are linked from `index.md`.
- `context/` is supporting material only: research notes, scratch analysis, generated evidence, and intermediate context. Do not hide primary deliverables there.
- Paths encode stable identity, not ordering. Milestone and ticket order belongs in `index.md`, status docs, or ticket lists.
- Project status artifact owns exact paths, gates, and recovery state.
- Linear owns team-visible tracking: concise title, goal, acceptance criteria, status/assignee/priority/milestone, blockers, PR links, and links to canonical `thoughts/` docs.
- `thoughts/` owns durable working memory: specs, designs, research, ADRs, field inventories, verification/load strategies, reviews, handoffs, and detailed plans.
- Linear comments/descriptions should link back to repo artifacts instead of duplicating full tables or long designs.
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

- sending project-planning/spec-only work through `/q-workspace`; if all planned edits live under `thoughts/`, continue in the current checkout and sync thoughts
- adding copied workspace/Graphite boilerplate to plans whose only outputs are project-planning docs, Linear comments, milestone maps, or living specs
- horizontal milestone taxonomies such as "DB first, then API, then frontend", "all reporting", "all overrides", or "all load testing" when a vertical bonus-plan/demo path can prove value sooner
- milestone names that expose process jargon such as "Vertical" instead of product/domain names
- creating implementation/spec tickets directly from the project plan
- forcing normal `/q-outline` or `/q-plan` onto milestone meta-planning
- reviving milestone `outline.md`/`plan.md` as required gates instead of using reviewed design + create-tickets
- hiding live status in `AGENTS.md`
- copying full PRDs/requirements into child dirs
- treating clean LLM review as product/lead approval
- creating temp ticket dirs before Linear IDs exist
- using numeric ordering prefixes like `01-` or `02-` in milestone or ticket directory names
- hiding important deliverables under `context/` instead of root-level docs linked from `index.md`
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
