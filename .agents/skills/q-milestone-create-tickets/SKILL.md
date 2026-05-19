---
name: q-milestone-create-tickets
description: Create Linear tickets from a reviewed milestone design. Use after milestone design review and human approval. Summarizes each proposed ticket one by one for human refinement, writes Linear-ready ticket descriptions, then creates Linear tickets/status docs only after explicit mutation approval.
---

# Milestone Create Tickets — Turn Reviewed Design Into Linear Issues

Use this after `/q-milestone-review [design.md]` and human design approval. This replaces the old milestone `outline -> review -> plan -> review` flow.

Goal: convert the reviewed milestone design into a small set of well-shaped Linear tickets, with human refinement one ticket at a time. After the final ticket is approved, create the Linear tickets immediately; the one-by-one approvals are the mutation approval.

## Step 1: Load baseline workflow

Read:

1. `~/.agents/skills/qrspi-planning/SKILL.md`
1. `~/.agents/skills/qrspi-project-planning/SKILL.md`
1. `~/.agents/skills/q-milestone-question/references/milestone-planning-common.md`
1. milestone-plan `AGENTS.md`
1. milestone-plan `design.md`
1. latest design review and `review-human.md`
1. milestone `AGENTS.md` and optional `milestone.md`
1. project status/routing artifact named by project `AGENTS.md`
1. Linear defaults/project log named by project `AGENTS.md`

Stop if design review or human approval is missing.

## Step 2: Extract candidate tickets

From reviewed `design.md`, identify each proposed ticket and summarize in the standard ticket format:

- title in Conventional Commit style, e.g. `feat(bonuses): add ordered first-five E-App policy selection`
- goal
- user stories
- where we are today
- gaps we need to fill
- expected outcome
- testing strategy: unit / integration / E2E
- dependencies / relations
- docs

Do not invent implementation details. Ticket-level QRSPI owns exact design and implementation.

## Step 3: Refine tickets one by one

Show exactly one candidate ticket at a time.

For each ticket:

1. Present a concise Linear-ready draft.
1. Ask the human whether to approve or change it.
1. Apply requested edits.
1. Re-show the edited ticket if changes were material.
1. Do not proceed to the next ticket until the current ticket is approved.

Do not include operator-only creation guards or internal planning caveats in ticket descriptions.

## Step 4: Update ticket description docs

After a ticket is approved, update the proposed ticket description docs created earlier from the design/ticket-shaping work. Prefer existing docs in their original location; do not create duplicate approved-description trees unless no docs exist yet. If no docs exist, create them under:

```text
milestone-plan/context/create-tickets/linear-ticket-descriptions/tkt-01-short-slug.md
```

Ticket description docs must be exactly the Markdown body that goes into Linear: no frontmatter, no metadata-only title heading, no suggested next command, no agent-only notes. The Linear issue title lives outside the body, in the create command/status artifact.

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

Use Conventional Commit style for Linear issue titles, e.g. `feat(bonuses): add ordered first-five E-App policy selection` or `test(bonuses): verify E-App debug fast-forward flow`.

Record each ticket title, description doc path, created Linear ID, URL, and routing dir in `milestone-plan/AGENTS.md`. Do not create a separate ticket manifest unless the milestone memory becomes too large.

Use markdown links for docs/assets in Linear descriptions: `[relative/path/from/plan-dir.md](https://chestnut-agents-internal.ngrok-free.dev/thoughts/relative/path/from/plan-dir.md)`. Prefer repo-local asset paths under the milestone-plan directory; do not link to local absolute screenshot paths.

Keep the title in the Linear issue title, not as a body heading. Do not include suggested next commands in the Linear description body; those belong in routing-only ticket `AGENTS.md` after the issue exists.

## Step 5: Execute and update repo routing

After all ticket drafts are approved one by one:

1. Create Linear tickets directly from the approved description docs in the repo. Do not create separate `/tmp` markdown bodies, hidden transformed copies, or frontmatter-stripped temp files. The approved doc must already be exactly the Linear body.
1. Apply project/milestone/default fields. Created implementation/spec tickets must be assigned to the Linear project milestone and must not be children of the milestone planning ticket.
1. Add relations/blockers.
1. Comment on the milestone planning ticket with markdown links to the created tickets, key relations, and thoughts docs/assets. In Linear comments, bare issue IDs may not auto-expand reliably, so use explicit markdown links for created tickets.
1. Mark the milestone planning ticket `In Review` after its implementation/spec tickets are created; do not mark it `Done` until the human/project owner has reviewed the created ticket set.
1. Update project Linear log.
1. Update milestone planning status artifact.
1. Update milestone `AGENTS.md` and optional `milestone.md`.
1. Create ticket directories only after Linear IDs exist using `NN-pro-####-slug/`.
1. Write routing-only ticket `AGENTS.md` files.
1. Comment on each created ticket with a fenced QRSPI XML result. The XML `<workspace>` must be that ticket directory, `<artifact>` must point to the approved ticket description doc, and `<next>` must be `/q-question [ticket-dir]`.
1. Run `just sync-thoughts` when available.

## Response

Standard result fields required: `<qrspi-result>`, `<stage>`, `<status>`, `<outcome>`, `<workspace>`, `<policy>`, `<summary>`, `<artifact>`, and `<next>`.

Useful outcomes:

- `<status>needs_human</status>` while waiting on per-ticket approval.
- `<stage>create-tickets</stage>` when ticket docs/Linear mutations are complete.
- `<artifact>` = primary ticket description doc while refining, or project status/log artifact after execution.
- `<artifacts>` = approved ticket description docs, created Linear issue URLs, and created ticket dirs after execution.
