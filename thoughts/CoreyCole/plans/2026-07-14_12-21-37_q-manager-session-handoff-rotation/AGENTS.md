---
source: .pi/skills/qrspi-planning/_AGENTS.md
copied_by: /q-question
note: This is a template. The copy in each plan dir is living, curated memory. Keep it short and prune stale items.
---

# Plan Directory

This directory follows the QRSPI planning pipeline. It grows as stages complete and review loops add artifacts.

## Role of this AGENTS.md

The copy of this file inside a specific plan dir is long-term memory for that plan.

Use it to preserve only durable context that future agents should load before reading stage artifacts and code:

- pointers to canonical q-question artifacts: brainstorm/alignment and research agenda
- approved decisions that must not be undone accidentally
- important tradeoffs and rejected paths
- non-obvious invariants, gotchas, or review learnings
- scope boundaries, naming choices, or sequencing changes that define the work
- language/domain ambiguities future agents are likely to misuse
- ADR candidates that q-design must reconsider after research
- pointers to canonical artifacts or code locations for details

This file complements primary artifacts. It does not replace `context/brainstorms/`, `questions/`, `research/`, `design.md`, `design-product.md`, `outline.md`, `plan.md`, `handoffs/`, or `reviews/`.

## Keep It Curated

Do not turn this file into a diary or dump.

Good candidates:

- stable decisions with downstream impact
- nuance that took real effort to learn
- review feedback that changed the accepted approach
- watch-out details easy to miss from happy-path artifacts

Bad candidates:

- raw command output or stack traces
- temporary debugging notes
- status updates already covered by `plan.md` checkboxes or handoffs
- long summaries of artifacts that already exist
- facts likely to go stale

When adding content:

- prefer short bullets
- include exact artifact paths or `file:line` references when useful
- update or delete stale items instead of appending contradictions
- keep the highest-signal items near the top
- if in doubt, leave it out

## How to Orient Yourself

1. Read this file's plan-specific memory first if it has been filled in.
1. Read the pipeline overview: `.pi/skills/qrspi-planning/SKILL.md`.
1. Determine the current stage by checking which artifacts exist.
1. Read the skill for that stage.

## Suggested Sections for Plan-Specific Memory

Keep only sections that earn their place:

- **Current focus** — what loop or checkpoint we are in
- **Canonical context** — pointers to q-question brainstorm/alignment and research agenda artifacts
- **Decisions to preserve** — approved choices, scope boundaries, naming, sequencing
- **Language and ambiguity notes** — canonical terms or soft-normalizations likely to matter later
- **Important tradeoffs / rejected paths** — only when future agents might reopen them
- **ADR candidates for design** — candidates raised before research; q-design decides disposition
- **Invariants / gotchas** — non-obvious rules, edge cases, traps
- **Canonical artifacts** — the few docs future agents should open first

## Stages and Skills

| Artifact | Stage | Skill | Gate |
|----------|-------|-------|------|
| `questions/*.md` | Question | `.pi/skills/q-question/SKILL.md` | Human |
| `research/*.md` | Research | `.pi/skills/q-research/SKILL.md` | Human |
| `design.md` | Design | `.pi/skills/q-design/SKILL.md` | Human |
| `design-product.md` | Product Design | `.pi/skills/q-design-product/SKILL.md` | Optional human gate for product-critical/high-stakes work |
| `outline.md` | Outline | `.pi/skills/q-outline/SKILL.md` | LLM review via `/q-review [outline.md]` |
| `plan.md` | Plan | `.pi/skills/q-plan/SKILL.md` | LLM review via `/q-review [plan.md]` |
| code changes | Implement | `.pi/skills/q-implement/SKILL.md` | LLM code review via `/q-review [handoff.md]` |
| `reviews/*/review.md` | Review | `.pi/skills/q-review/SKILL.md` | Routes to planning or implementation review |

## Review Behavior

Planning review happens before implementation:

- `/q-review [outline.md]` reviews `design.md`, optional `design-product.md`, and `outline.md`.
- `/q-review [plan.md]` reviews `design.md`, optional `design-product.md`, `outline.md`, and `plan.md`.
- Clear planning findings are fixed directly in the parent docs.
- Findings needing codebase facts create research questions under the timestamped planning review directory.
- Run `/skill:q-research-for-review` on those questions so research preserves the review category context.
- After that research, `/skill:q-address-review-research` applies fixes back to the parent `design.md`, `design-product.md`, `outline.md`, and `plan.md`.
- Human judgment questions should be rare and go through `/answer`.

Implementation review happens after code exists:

- Straightforward code findings can be fixed immediately as a final review-fix slice stacked on top of the implementation.
- Deeper findings create a full QRSPI follow-up plan inside the timestamped implementation review directory.
- That implementation review directory owns its own `design.md`, `design-product.md`, `outline.md`, and `plan.md` for follow-up slices.
- Never overwrite the parent plan's planning docs for implementation-review follow-up work.

## Path Convention

Top-level plan directories start with `thoughts/`:

```text
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
```

Review follow-up plan directories live under the parent plan:

```text
thoughts/[git_username]/plans/[timestamp]_[plan-name]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/
```

Before creating a new plan directory or markdown artifact, run `~/dotfiles/spec_metadata.sh` and use its `Git Username`, `Timestamp For Filename`, and frontmatter fields.

Recommended top-level subdirectories:

- `prds/`
- `context/{brainstorms,question,research,design,design-product,outline,plan,implement}/`
- `questions/`
- `research/`
- `adrs/`
- `handoffs/`
- `reviews/`

## Key Constraints

- Use stage-specific read-only discovery and write outputs under `context/[stage]/`; q-question also writes active context under `context/brainstorms/` for q-design.
- q-question's brainstorm artifact is the single structured place for early Language / Domain Model, Alignment, decision branches, interview rationale, and ADR candidates. `AGENTS.md` points to it and preserves only durable highlights.
- q-question should investigate relevant code/docs/past thoughts before asking, then confirm the synthesized understanding with the lead engineer. It aligns goals, scope, design principles, terminology, and tradeoffs; it does not choose the implementation approach.
- q-research reads `AGENTS.md` and the question doc for framing only. Use `AGENTS.md` and the question doc to understand what to look for. Do not treat them as proof of current behavior. Every factual answer must be grounded in current code/docs/tests with file:line references.
- q-design consumes q-question Language / Alignment context and ADR candidates after research, asks only unresolved design-direction questions, and records ADR-candidate disposition.
- QRSPI ADRs use the simplified body format by default: title plus 1-3 sentences covering context, decision, and why; optional sections only when valuable.
- Keep Question and Research in separate, focused contexts.
- Research reads `AGENTS.md` and `questions/*.md` for framing, but stays blind to forward-looking plan docs unless a review follow-up question explicitly references a review artifact.
- Product design is optional. Use it for product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, or irreversible user/data behavior changes; skip it for internal tools, bugfixes, refactors, and low product-risk work.
- The plan is a tactical machine document, but it still gets an LLM review before implementation.
- Planning review edits docs directly; implementation review fixes code only for straightforward findings and uses a review-dir QRSPI plan for deeper work.
- Implementation runs in a fresh filesystem copy named for the plan directory or ticket slug. Never use `git worktree`; use macOS `cp -ac source-dir clean-copy-dir` or Linux `cp -a --reflink=auto source-dir clean-copy-dir`.
- For `cn-agents` QRSPI implementation, the fresh workspace starts from latest `main`, then each tracked edit slice gets a Graphite branch (`gt create ..._slice-N`) and Graphite commit. Do not commit slices directly to `main`; merge the completed implementation stack back with `/cn-agents-merge` after implementation/review.

## Handoffs

Use handoffs for checkpoint status. Promote only durable, high-signal learnings into this AGENTS.md.

- Resume stage work with `.pi/skills/q-resume/SKILL.md`.
- Create handoffs with `.pi/skills/q-handoff/SKILL.md`.
- During implementation, continue with `/q-resume [handoff]` until the final completion handoff points to `/q-review [handoff]`.
- Implementation handoffs should record the fresh implementation directory path when known, or explicitly tell the next agent to create the fresh copy before editing.

# Plan: q-manager session handoff rotation

## Current focus

Workspace prep complete; next is `/q-implement` Slice 1. Implementation order remains proactive child monitoring, manager same-pane rotation, then native-compaction removal and repeated-rotation verification.

## Canonical context

- Final plan review: `reviews/2026-07-16_16-29-36_q-manager-session-handoff-rotation_plan-review/review.md`
- Revised approved design: `design.md`
- Structural outline: `outline.md`
- Merged-baseline validation: `context/outline/2026-07-16_16-02-04_merged-handoff-auto-resume-baseline.md`
- Design reasoning: `context/design/2026-07-14_16-06-42_q-manager-session-handoff-rotation-design-brainstorm.md`
- Research: `research/2026-07-14_15-34-21_q-manager-session-handoff-rotation.md`
- Brainstorm / alignment: `context/brainstorms/2026-07-14_12-21-37_q-manager-session-handoff-rotation.md`
- Research agenda: `questions/2026-07-14_13-10-05_q-manager-session-handoff-rotation.md`
- Implemented prerequisite: `thoughts/CoreyCole/plans/2026-07-16_10-32-28_q-manager-handoff-auto-resume/`
- Superseded compaction work: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/`

## Decisions to preserve

- Merged baseline already owns graph-wide handoff, safe artifact validation, operation locking, fresh same-node q-resume child launch, lineage, wake retry, and predecessor cleanup. Reuse it; do not duplicate it.
- Durable handoff must validate before fresh-session replacement; no native Pi compaction fallback.
- At stable `turn_end`, configurable 75% usage queues one handoff instruction as steering, never follow-up.
- Manager stays in the same pane: persist rotation, send built-in `/new`, then inject exact handoff from fresh `session_start` before wake release. Claim must pass Pi's `event.previousSessionFile` and match it to the persisted source JSONL.
- Child monitor ends at existing `RunChildComplete`; merged auto-resume saves successor, durably notifies, then cleans predecessor. Do not use child `/new`.
- Every ticket-level QRSPI Agent node already accepts same-node `status: handoff`; human-review/done nodes do not.
- Existing per-state operation lock must serialize rotation request/completion/claim with child-complete, continue, and manager-ready.
- Child rotation requests identify child ID + exact JSONL; the locked CLI snapshots current `ActiveChild.Generation`. Do not export delivery generation as a process lease: `mark-child-active` and rebind can increment it without restarting the child.
- Parent rotation binding must cover direct `/q-manager start-next|continue` and conversational q-manager CLI tool results via the stable state marker.
- Slice 2 must temporarily recognize both `replacing` and old `compacting` queue/adoption states so its commit stays green; Slice 3 removes `compacting` and updates `manager_pane_adoption.go` plus tests.
- Persist `/new` delivery as paste/submit phases so retry can submit an already-pasted command without pasting `/new` twice.
- Unknown usage does not trigger; existing provider-exhaustion recovery remains explicit failure path.
- V1 has no aggregate tool-output cap or upstream Pi API change.

## Implementation workspace

- Plan workspace: `/Users/swarm/dotfiles/thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation`
- Implementation workspace: `/Users/swarm/dotfiles/context/vamos-2026-07-14_12-21-37_q-manager-session-handoff-rotation`
- Base: `main` at `7ca824d7960e617861f647fd6314da34b2cff1fc`, matching fetched `origin/main`
- No prior implementation stack exists; first Graphite slice must parent `main`. The copied workspace was normalized to the committed base without touching unrelated tracked changes in the planning checkout.

## Accepted ADRs

- `adrs/2026-07-15_11-06-58_durable-handoff-fresh-session-rotation.md`
- `adrs/2026-07-15_11-06-58_turn-end-steering-at-75-percent.md`
- `adrs/2026-07-15_11-06-58_asymmetric-manager-child-session-replacement.md`
- `adrs/2026-07-15_11-06-58_graph-wide-agent-handoff.md`
