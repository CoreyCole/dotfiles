---
name: q-milestone-create-tickets
description: Create Linear tickets from a reviewed milestone design. Use after milestone design review and human approval. Summarizes each proposed ticket one by one for human refinement, writes Linear-ready ticket descriptions, then creates Linear tickets/status docs only after explicit mutation approval.
---

# Milestone Create Tickets — Turn Reviewed Design Into Linear Issues

Use this after `/q-milestone-review [design.md]` and human design approval. This replaces the old milestone `outline -> review -> plan -> review` flow.

Goal: convert the reviewed milestone design into a small set of well-shaped Linear tickets, with human refinement one ticket at a time. Tickets should preserve vertical delivery: each ticket should either move the named bonus plan/scenario closer to end-to-end verification or be a narrowly scoped enabler for that path. Before drafting individual tickets, align with the human on the overall ticket-set structure and vertical slices/workstreams. After the final ticket is approved, create the Linear tickets immediately; the one-by-one approvals are the mutation approval.

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

## Step 2: Align on ticket-set structure

Before presenting individual Linear drafts, extract the whole proposed set from reviewed `design.md` and present a concise structure overview:

- milestone spine: named bonus plan/scenario/user path this ticket set proves
- vertical slices/workstreams: grouped proposed work, sequence, and what each group proves
- ticket list: tentative titles in order, with each ticket's role in the sequence
- defer map: what belongs to later milestones, especially final E2E / readiness backstops
- risk check: any ticket that looks horizontal/enabling and the vertical path it unlocks

Ask the human to approve or adjust the structure before drafting ticket 1. If the human changes structure, update the candidate list first. Do not start one-by-one ticket refinement until this structure is approved.

## Step 3: Extract candidate tickets

From the approved structure and reviewed `design.md`, summarize each proposed ticket in the standard ticket format:

- title in Conventional Commit style, e.g. `feat(bonuses): add ordered first-five E-App policy selection`
- vertical path: named bonus plan/scenario/user path this ticket advances; do not put process jargon like "Vertical" in ticket or milestone titles
- role in ticket-set structure: what slice/workstream this ticket belongs to and what it unlocks
- goal
- user stories
- where we are today
- gaps we need to fill
- expected outcome
- testing strategy: unit / integration / E2E
- dependencies / relations
- docs

Do not invent implementation details. Ticket-level QRSPI owns exact design and implementation.

## Step 4: Refine tickets one by one

Show exactly one candidate ticket at a time.

For each ticket:

1. Present a concise Linear-ready draft.
1. Ask the human whether to approve or change it.
1. Apply requested edits.
1. Re-show the edited ticket if changes were material.
1. Do not proceed to the next ticket until the current ticket is approved.

Do not include operator-only creation guards or internal planning caveats in ticket descriptions.

## Step 5: Update ticket description docs

After a ticket is approved, update the proposed ticket description docs created earlier from the design/ticket-shaping work. Prefer existing docs in their original location; do not create duplicate approved-description trees unless no docs exist yet. If no docs exist, create them under:

```text
milestone-plan/context/create-tickets/linear-ticket-descriptions/tkt-01-short-slug.md
```

These approved Linear bodies are supporting create-ticket artifacts, so they may live under `context/create-tickets/`. Actual ticket deliverables created later must live at the ticket directory root and be linked from ticket `index.md`.

Ticket description docs must be exactly the Markdown body that goes into Linear: no frontmatter, no metadata-only title heading, no suggested next command, no agent-only notes. The Linear issue title lives outside the body, in the create command/status artifact.

Each description must be concise and Linear-ready, using these sections in this order:

1. Vertical path
1. Role in ticket-set structure
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

## Step 6: Execute and update repo routing

After all ticket drafts are approved one by one:

1. Create Linear tickets directly from the approved description docs in the repo. Do not create separate `/tmp` markdown bodies, hidden transformed copies, or frontmatter-stripped temp files. The approved doc must already be exactly the Linear body.
1. Apply project/milestone/default fields. Created implementation/spec tickets must be assigned to the Linear project milestone and must not be children of the milestone planning ticket.
1. Add relations/blockers.
1. Comment on the milestone planning ticket with markdown links to the created tickets, key relations, and thoughts docs/assets. In Linear comments, bare issue IDs may not auto-expand reliably, so use explicit markdown links for created tickets.
1. Mark the milestone planning ticket `In Review` after its implementation/spec tickets are created; do not mark it `Done` until the human/project owner has reviewed the created ticket set.
1. Update project Linear log.
1. Update milestone planning status artifact.
1. Update milestone `AGENTS.md` and optional `milestone.md`.
1. Create ticket directories only after Linear IDs exist using `pro-####-slug/`; do not add numeric ordering prefixes.
1. Write routing-only ticket `AGENTS.md` files.
1. Write a ticket-root `index.md` that links the Linear issue, approved description doc, canonical docs, and next QRSPI command.
1. Comment on each created ticket with a fenced QRSPI XML result. The XML `<workspace>` must be that ticket directory, `<artifact>` must point to the approved ticket description doc, and `<next>` must be `/q-question [ticket-dir]`.
1. Run `just sync-thoughts` when available.

## Response

Standard result fields required: `<qrspi-result>`, `<stage>`, `<status>`, `<outcome>`, `<workspace>`, `<policy>`, `<summary>`, `<artifact>`, and `<next>`.

Useful outcomes:

- `<status>needs_human</status>` while waiting on structure approval or per-ticket approval.
- `<stage>create-tickets</stage>` when ticket docs/Linear mutations are complete.
- `<artifact>` = primary ticket description doc while refining, or project status/log artifact after execution.
- `<artifacts>` = approved ticket description docs, created Linear issue URLs, and created ticket dirs after execution.
