---
name: q-milestone-plan
description: Create milestone-level QRSPI execution plan for Linear ticket creation. Use after reviewed and human-approved milestone outline or when running /q-milestone-plan. Produces an operational plan, separate Linear ticket description documents, status/doc update steps, and routing for ticket-level QRSPI.
---

# Milestone Plan — How Do We Create the Tickets?

Use this as the Plan stage for milestone-level QRSPI. It plans ticket creation and status/doc updates from an approved milestone outline. It is not an engineering implementation plan.

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

Each description must be concise and Linear-ready:

- title
- goal
- user stories / gaps covered
- source artifacts
- expected output/evidence
- dependencies / blocked-by / blocks
- suggested next command after ticket exists
- do-not-create-if guard when conditional

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

After `/q-milestone-review [plan.md]` succeeds and required human approval is recorded if project policy requires it, execute Linear creation. Then create ticket directories using `NN-pro-####-slug/` and routing-only `AGENTS.md` files.

## Response

End completed stage responses with standard fenced XML `<qrspi-result>` from `qrspi-planning`, using:

- `<stage>plan</stage>`
- `<artifact>` = `plan.md`
- `<artifacts>` = ticket description docs
- `<next>` = `/q-milestone-review [plan.md]`
