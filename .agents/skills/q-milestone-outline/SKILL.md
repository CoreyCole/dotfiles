---
name: q-milestone-outline
description: Create milestone-level QRSPI outline for nested project planning. Use after approved milestone design or when running /q-milestone-outline. Produces concise user-story-backed gap maps, architecture-spec inputs, proposed ticket lists, dependencies, and deferred ticket-level decisions.
---

# Milestone Outline — What Tickets Should Exist?

Use this as the Outline stage for milestone-level QRSPI. It converts approved milestone design into a reviewed product-outcome ticket-shaping outline and architecture-spec input artifact. This is not normal QRSPI header-file outline; include API/db/type/function surfaces only when needed to make ticket boundaries or architecture inputs obvious.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-outline/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. milestone-plan `AGENTS.md`
1. milestone-plan `design.md`
1. relevant ADRs
1. milestone-plan research docs only as needed to verify references
1. latest design review and `review-human.md` if present
1. milestone `milestone.md`

## Step 2: Build traceable outline

Every proposed ticket must map to at least one approved product outcome or outcome-enabling user story and one gap/dependency/taxonomy reason. Engineer-as-user stories are valid only when they support product outcomes or architecture/spec readiness.

Use compact IDs:

- `US-#` user stories
- `GAP-#` gaps
- `DEP-#` dependencies
- `TKT-#` proposed tickets

## Step 3: Write `outline.md`

Use `~/dotfiles/spec_metadata.sh` before writing.

Required sections:

1. Milestone purpose.
1. Scope / non-scope.
1. Approved product outcomes.
1. Current code/system state.
1. Source-doc / requirement state.
1. Target behavior user stories.
1. Gap map.
1. Architecture-spec inputs, including API/db/type/function surfaces only when boundary-relevant.
1. Proposed ticket list.
1. Ticket traceability table: ticket → user stories → gaps → dependencies → expected evidence.
1. Deferred to ticket-level QRSPI.
1. Cross-milestone dependencies.
1. Taxonomy change proposals.
1. Open human/product questions.

Keep concise and high-level. Sacrifice grammar for concision. Link canonical docs; do not copy full requirements. Do not drift into exact implementation signatures/schema unless required for ticket boundary clarity.

## Step 4: Gate expectations

After `/q-milestone-review [outline.md]`, human approval is required before `/q-milestone-plan`.

Record human approval as `review-human.md` in the automated outline review directory.

## Response


Standard result fields required: `<qrspi-result>`, `<stage>`, `<status>`, `<outcome>`, `<workspace>`, `<policy>`, `<summary>`, `<artifact>`, and `<next>`.
End completed stage responses with standard fenced XML `<qrspi-result>` from `qrspi-planning`, using:

- `<stage>outline</stage>`
- `<artifact>` = `outline.md`
- `<next>` = `/q-milestone-review [outline.md]`
