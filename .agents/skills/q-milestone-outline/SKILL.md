---
name: q-milestone-outline
description: Legacy milestone outline skill. Do not use for new milestone planning; use reviewed milestone design then q-milestone-create-tickets. Only use to finish old in-flight milestone flows that already have outline.md as their next required artifact.
---

# Milestone Outline — Legacy Flow

New milestone planning should not use this skill. The simplified flow is:

```text
/q-milestone-design [research.md]
/q-milestone-review [design.md]
/q-milestone-create-tickets [design.md]
```

Use this legacy skill only to finish old in-flight milestone flows that already require `outline.md`.

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
