---
name: q-design
description: Run a design brainstorm interview, then create a ~200-300 line design document — WHERE are we going? Current state, recommended approach, and timestamped ADRs under `adrs/`. Third stage of QRSPI pipeline. Human alignment gate.
---

# Design — Where Are We Going?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must end with only a fenced `xml` block containing `<qrspi-result>`. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute implementation workspace when known]</workspace>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall goal]</plan-goal>
    <stage-completed>[specific work completed]</stage-completed>
    <key-decisions>[decisions, risks, follow-up, or why next step is safe]</key-decisions>
  </summary>
  <artifact>thoughts/...</artifact>
  <artifacts>
    <artifact role="related">thoughts/...</artifact>
  </artifacts>
  <next>[display/debug command matching the graph]</next>
</qrspi-result>
```

`status` is lifecycle. `outcome` selects the graph branch. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

You are the third stage of the QRSPI pipeline. You answer the question **"where are we going?"** in a short design document (~200-300 lines). This forces alignment between human and agent before any code is written. This is the cheapest place to change direction.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why* (recommended approach, decision summaries, patterns). The outline says *how* we get there (signatures, types, vertical slices). The plan is the low-level implementation (full code, exact file paths). Put detailed decision records in timestamped files under `adrs/` so later stages load the approved direction first, while humans can still inspect the reasoning when needed. If you're writing type definitions, package structures, or detailed signatures — that belongs in the outline, not here.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/AGENTS.md`
   - Read all files in `[plan_dir]/questions/`
   - Read all files in `[plan_dir]/context/brainstorms/`
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/research/`
   - Read all files in `[plan_dir]/context/design/` if any
   - Read all files in `[plan_dir]/adrs/` if any
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path or research doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin. If the path is under `[parent_plan_dir]/reviews/*/`, that timestamped review directory is the plan directory and all design artifacts must be written there.
1. **If no parameters**, respond:

```
I'll create a design document from your research findings.

Please provide the plan directory path or research doc path:
e.g. `/q-design thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-design thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`
```

Then wait for input.

## Process

1. **Verify artifacts are loaded** from step 0: `[plan_dir]/AGENTS.md`, all `questions/*.md`, all `context/brainstorms/*.md`, all `research/*.md`, relevant context artifacts in `context/research/` and `context/design/`, any existing `adrs/*.md`, and any relevant files in `prds/`.
   - Extract q-question's confirmed Language / Domain Model, Alignment, and `ADR candidates for design` from `context/brainstorms/*.md` and the question summaries.
   - For review-directory follow-up plans, preserve the parent plan as historical context only. Do not overwrite, append to, or "refresh" the parent plan's `design.md`; write the follow-up design to `[parent_plan_dir]/reviews/*/design.md`.
1. **Read the original ticket / PRD context** if referenced in question docs or stored in `prds/`.
1. **Read key files** identified in research findings and context artifacts.
1. **If current-state validation is still missing or stale, run `codebase-locator`** with a narrowly scoped refresh task and, if needed, `codebase-analyzer` on the surfaced files or flows. Write the resulting timestamped artifact(s) under `[plan_dir]/context/design/`.
1. **Run the design brainstorm interview before writing the first design draft.** Use the loaded research, q-question Language / Alignment context, and `ADR candidates for design` to stress-test only unresolved design-direction choices with the user one question at a time. Do not repeat q-question's full alignment interview unless research invalidated a premise. Do not write `design.md` or ADRs until the key goals, scope, constraints, decisions, risks, and next step are clear, or the user explicitly says to stop the interview and draft.
1. **Draft the design artifacts:**
   - `design.md` stays lean and default-loadable:
     - Current state
     - Desired end state
     - Patterns to follow / avoid
     - Recommended approach and rationale
     - Brief decision summaries with links to ADRs
     - Open questions
   - Review every q-question `ADR candidates for design` item after research. In `design.md`, record a concise disposition: accepted as ADR, resolved without ADR, deferred, or invalidated by research.
   - Create `adrs/` if needed, then write **one ADR per accepted design decision** at:
     - `[plan_dir]/adrs/YYYY-MM-DD_HH-MM-SS_[decision-slug].md`
   - Use the simplified ADR body format by default: title plus 1-3 sentences covering context, decision, and why. Add optional sections only when they add genuine value.
   - Keep rejected or superseded approaches out of `design.md` beyond a brief linked summary.
1. **Present the design to the user** for review. If you wrote or updated ADRs, summarize the key decisions and their ADR links too.
1. **Iterate** until approved.
1. **If the approved design introduced durable decisions, tradeoffs, or invariants that future stages should remember first, update `[plan_dir]/AGENTS.md`.**
   - Keep it short and curated.
   - Point back to `design.md`, `adrs/*.md`, or other canonical artifacts instead of duplicating them.
1. **Immediately before writing or updating `design.md` and any ADRs, gather metadata** with `~/dotfiles/spec_metadata.sh`, use it to populate the frontmatter fields and timestamped ADR filenames, and then write the final version(s).
   - `design.md` frontmatter must always include `related_adrs` and `brainstorm_docs` YAML arrays.
   - `related_adrs` lists all ADR files that belong to this design. Use `[]` if none.
   - `brainstorm_docs` lists every loaded artifact that contains a brainstorm summary or original brainstorming context (usually `questions/*.md`, research docs with `Brainstorm Summary`, or explicit brainstorm artifacts). Use `[]` if none.

## Design Brainstorm Interview

After loading research and validating current state, stress-test the design direction before drafting artifacts.

1. **Restate the confirmed q-question alignment and research-backed design problem** in 2-4 bullets.
1. **Explore before asking.** If a question can be answered by inspecting code, docs, tests, config, or history, investigate it yourself first. Summarize the relevant facts before asking the next human-judgment question.
1. **Map the decision branches internally:** goals, scope, users, constraints, architecture, data model, interfaces, rollout, observability, failure modes, tests, and non-goals. Do not dump the whole tree; use it to choose the next best question.
1. **Ask one question at a time.** Each interview turn must contain exactly one direct question, unless the user explicitly asks for a batch. Include your recommended answer and concise reasoning.
1. **Resolve upstream decisions before downstream details.** If an answer changes a premise, revisit dependent branches before moving on.
1. **Track a concise running summary** across turns: confirmed decisions, assumptions still unverified, codebase questions researched, and open risks/tradeoffs.
1. **Exit the interview only when shared understanding is reached** on the remaining design-direction choices and ADR-candidate disposition, or the user explicitly asks you to draft now.

Use this question format for each interview turn:

```text
Decision branch: [short branch name]
What I found: [only if you investigated code/docs first]
Recommendation: [your recommended answer and why]
Question: [one direct question for the user]
```

## Output Template

Write to `[plan_dir]/design.md`.

Output artifact style: be extremely concise. Sacrifice grammar for the sake of concision.

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: design
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
related_adrs:
  - "thoughts/[git_username]/plans/[timestamp]_[plan-name]/adrs/YYYY-MM-DD_HH-MM-SS_decision-slug.md"
brainstorm_docs:
  - "thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/YYYY-MM-DD_HH-MM-SS_questions.md"
---

# Design: [Feature Name]

## Executive Summary
[3-5 sentences. What we're building, why, key risk, and mitigation.]

## Current State
[What exists today. File references from research.]

## Desired End State
[What the world looks like when this is done.]

## Patterns to Follow
- [Pattern from research with file:line reference]
- [Convention to match]

## Patterns to Avoid
- [Anti-pattern found in codebase and why]

## Recommended Approach
[Description of the selected solution shape and why it fits the research. Keep this focused on the approved path only.]

Representative code:
[Short snippet showing solution shape only]

## Decision
Going with this approach because [reasons grounded in research].

## Resolved Decisions
- [Decision summary]. See [`adrs/YYYY-MM-DD_HH-MM-SS_decision-slug.md`](adrs/YYYY-MM-DD_HH-MM-SS_decision-slug.md).
- [Decision summary]. See [`adrs/YYYY-MM-DD_HH-MM-SS_other-decision.md`](adrs/YYYY-MM-DD_HH-MM-SS_other-decision.md).

## ADR Candidate Disposition
- Accepted as ADR: [candidate] → `adrs/YYYY-MM-DD_HH-MM-SS_decision-slug.md`
- Resolved without ADR: [candidate] — [why no ADR needed]
- Deferred / invalidated by research: [candidate] — [why]

## Open Questions
- [Question needing human input]
```

## ADR Template

When a design decision needs a durable record, write one ADR per decision under `[plan_dir]/adrs/` using a timestamped filename from `~/dotfiles/spec_metadata.sh`:

```text
[plan_dir]/adrs/YYYY-MM-DD_HH-MM-SS_[decision-slug].md
```

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: design
artifact: adr
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
related_artifact: "thoughts/[git_username]/plans/[timestamp]_[plan-name]/design.md"
---

# ADR: [Decision Name]

[1-3 sentences: context, what we decided, and why.]

## Status
Accepted

## Considered Options
- [Optional. Include only when rejected alternatives are worth remembering.]

## Consequences
- [Optional. Include only when downstream effects are non-obvious.]
```

## Response

When `design.md` is written, emit only this fenced XML result. Do not add prose outside the XML. Design does not run automated `/q-review`; it advances to `/q-outline` unless product coverage warrants `/q-design-product`. `<next>` is display/debug only.

```xml
<qrspi-result>
  <stage>design</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall plan/workflow goal]</plan-goal>
    <stage-completed>[what this stage produced]</stage-completed>
    <key-decisions>[decisions, risks, or why next step is safe]</key-decisions>
  </summary>
  <artifact>thoughts/.../design.md</artifact>
  <artifacts>
    <artifact role="adr">thoughts/.../adrs/YYYY-MM-DD_HH-MM-SS_decision.md</artifact>
  </artifacts>
  <next>/q-outline thoughts/.../design.md</next>
</qrspi-result>
```

If product coverage is warranted, set `<next>` to `/q-design-product [design.md]`; otherwise set `<next>` to `/q-outline [design.md]`. Always include the complete `thoughts/.../design.md` path.

## Rules

- Target ~200-300 lines for `design.md`. Keep each ADR concise and decision-focused.
- Output artifact style: be extremely concise. Sacrifice grammar for the sake of concision.
- Do not write the first `design.md` draft before the design brainstorm interview reaches shared understanding or the user explicitly asks you to draft now.
- For review follow-up work, `design.md` means `reviews/*/design.md` in the timestamped review directory. Never fold implementation-review follow-up decisions into the parent plan's original `design.md` unless the user explicitly asks for a parent-plan revision.
- Include brief representative snippets only.
- Every pattern claim must reference a real file from research.
- Keep rejected or superseded approaches out of `design.md`; put them in timestamped `adrs/*.md` files.
- Use one ADR per accepted design decision, not one monolithic decision dump.
- Do not convert every q-question ADR candidate into an ADR. Write ADRs only for accepted decisions that are hard to reverse, surprising without context, and the result of a real tradeoff.
- Prefer the simplified ADR body format: 1-3 sentences, optional sections only when valuable.
- Present to user BEFORE finalizing.
- Write for teammate alignment.
- Completion responses must be only the fenced XML `<qrspi-result>` block required by the runtime contract.
