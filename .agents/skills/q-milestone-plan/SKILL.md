---
name: q-milestone-plan
description: Legacy milestone plan skill. Do not use for new milestone planning; use q-milestone-create-tickets after reviewed/human-approved design. Only use to finish old in-flight milestone flows that already have outline.md and require plan.md.
---

# Milestone Plan — Legacy Flow

New milestone planning should not use this skill. The simplified flow is:

```text
/q-milestone-design [research.md]
/q-milestone-review [design.md]
/q-milestone-create-tickets [design.md]
```

Use this legacy skill only to finish old in-flight milestone flows that already have `outline.md` and require `plan.md`.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-plan/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. milestone-plan `AGENTS.md`
1. milestone-plan `outline.md`
1. latest outline review and `review-human.md`
1. milestone `milestone.md`
1. project status/routing artifact named by project `AGENTS.md`
1. Linear defaults/project log named by project `AGENTS.md`

Stop if outline review or human approval is missing.

## Step 2: Keep plan operational

The plan owns:

- Linear ticket creation/update steps
- separate paste-ready ticket description docs
- milestone `milestone.md` updates
- project status/dependency artifact updates
- ticket directory creation after Linear IDs exist
- routing-only ticket `AGENTS.md` files
- rollback/correction steps for mistaken Linear mutations

The plan does not own architecture synthesis or code implementation slices. Architecture-spec inputs must already be in `outline.md`.

## Step 3: Write ticket description docs

Create separate docs under:

```text
milestone-plan/context/plan/linear-ticket-descriptions/
  tkt-01-short-slug.md
  tkt-02-short-slug.md
```

Each description must be concise and Linear-ready, using these sections in this order:

1. Goal
1. User stories
1. Where we are today
1. Gaps we need to fill
1. Expected outcome
1. Testing strategy
   - Unit
   - Integration
   - E2E
1. Dependencies / relations
1. Docs

Use Conventional Commit style for Linear issue titles, e.g. `feat(bonuses): add ordered first-five E-App policy selection` or `test(bonuses): verify E-App debug fast-forward flow`. Keep the title in the Linear issue title, not as a required body heading. Do not include suggested next commands, operator-only creation guards, or internal planning caveats in Linear ticket description docs. Suggested next commands belong in routing-only ticket `AGENTS.md` after the issue exists. If a ticket is conditional, capture that decision point in the milestone `plan.md` execution checklist or preconditions, not in the paste-ready Linear description.

## Step 4: Write `plan.md`

Use `~/dotfiles/spec_metadata.sh` before writing.

Required sections:

1. Goal.
1. Preconditions.
1. Ticket creation table.
1. Ticket description doc index.
1. Linear fields and relations.
1. Status/doc update steps.
1. Ticket directory creation steps after Linear IDs exist.
1. Minimal routing-only ticket `AGENTS.md` template.
1. Execution checklist.
1. Rollback/correction steps.
1. Out of scope.

## Step 5: Post-review execution

After `/q-milestone-review [plan.md]` succeeds and required human approval is recorded if project policy requires it, execute Linear creation. Then create ticket directories using `pro-####-slug/` and routing-only `AGENTS.md` files. Do not add numeric ordering prefixes; ticket order belongs in status/index docs.

## Response

Standard result fields required: `<qrspi-result>`, `<stage>`, `<status>`, `<outcome>`, `<workspace>`, `<policy>`, `<summary>`, `<artifact>`, and `<next>`.
End completed stage responses with standard fenced XML `<qrspi-result>` from `qrspi-planning`, using:

- `<stage>plan</stage>`
- `<artifact>` = `plan.md`
- `<artifacts>` = ticket description docs
- `<next>` = `/q-milestone-review [plan.md]`
