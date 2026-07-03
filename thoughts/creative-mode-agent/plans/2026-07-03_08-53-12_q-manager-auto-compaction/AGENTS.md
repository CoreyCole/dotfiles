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

## Current focus

Design q-manager parent auto-compaction after child launch. Live test showed current CLI did not compact/handoff because compaction only runs when explicit `--manager-usage-*` is passed.

## Canonical context

- Brainstorm / alignment: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md`
- Research agenda: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/questions/2026-07-03_08-53-12_q-manager-auto-compaction.md`

## Decisions to preserve

- Approved design: parent Pi q-manager wrapper/command measures fresh `ctx.getContextUsage()` each manager turn, runs normal CLI `start-next` / `continue`, then calls native `ctx.compact()` only after q-manager marks delivery `compacting` and fresh usage is >=90%. See `design.md`, `adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md`, and `adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md`.
- Child must launch and active child refs must persist before parent manager compaction starts.
- Quick child result/human gate while parent compacts queues in q-manager `QueuedWake`, not generic parent paste; compacted manager runs `manager-ready` to flush one current-generation wake; stale queued wakes are suppressed after steer/rebind. See `adrs/2026-07-03_09-56-09_queue-wakes-before-native-compact.md`.
- No-wake reliability is in scope: test child Pi extension -> `qrspi child-complete` -> session JSONL validation -> delivery queue/deliver -> parent pane wake. Recovery should use `inspect --sessions --latest`, `validate-latest --apply-rebind`, or `recover-manual --mode latest-session --continue`, never hand-edit durable artifacts. See `adrs/2026-07-03_10-15-24_wake-chain-reliability.md`.
- Keep q-manager child sessions visible/interruptible in tmux.

## Invariants / gotchas

- Current q-manager CLI only starts manager compaction from explicit usage flags; parent wrapper should feed those flags from fresh Pi `ctx.getContextUsage()` in the parent manager process, not from scanning Pi JSONL. Persist last usage in local state for diagnostics only; never compact from stale stored usage.
- Pi extension context exposes `getContextUsage()` and non-awaiting `compact()` only in the parent Pi process; child extension/CLI cannot call them directly.
- Native `ctx.compact()` must not fire unless CLI already saved delivery `compacting`; otherwise quick child wake can race parent availability.
- Parent wrapper/native compaction must preserve/improve missed-wake diagnostics, not hide whether child extension, `child-complete`, validation, delivery, or parent paste failed.
- Child `/compact` is only for actual child context-limit/context-exhaustion evidence; no-wake or missing result without context-limit evidence should use inspect/validate/rebind/steer/relaunch paths.
- Do not put local manager state refs in durable `qrspi_result` YAML.

## Canonical artifacts

- Research: `research/2026-07-03_09-21-09_q-manager-auto-compaction.md`
- Design: `design.md`
- Design brainstorm: `context/design/2026-07-03_09-29-00_q-manager-auto-compaction-design-brainstorm.md`
- ADR: `adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md`
- ADR: `adrs/2026-07-03_09-56-09_queue-wakes-before-native-compact.md`
- ADR: `adrs/2026-07-03_10-15-24_wake-chain-reliability.md`
- ADR: `adrs/2026-07-03_10-55-37_child-context-exhaustion-recovery.md`
- ADR: `adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md`

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
