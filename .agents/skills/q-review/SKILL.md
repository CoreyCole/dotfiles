---
name: q-review
description: Review a QRSPI outline/design pair or a completed implementation. In outline mode, edit `design.md`/`outline.md` toward a reviewed-ready state. In implementation mode, write the canonical review artifact, put non-straightforward findings into a follow-up questions doc, then use `/answer` to confirm each straightforward fix before applying it.
---

# Review — Outline or Implementation

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`
> **Review rubric:** `~/.pi/agent/skills/review-rubric/SKILL.md`

You are the review checkpoint of the QRSPI pipeline. This skill has two modes:

- **Outline review** — review `outline.md` against `design.md`, research, and codebase reality before `/q-plan`
- **Implementation review** — review the actual code and verification evidence after `/q-implement`

Be constructively adversarial. Stress-test the work, verify claims against the codebase, and flag only real, actionable issues.

## Primary Goal by Mode

### Outline review

The goal is **not** to leave behind a passive report. The goal is to get the design/outline pair into a reviewed, aligned state.

- Review `design.md` and `outline.md`
- Edit `design.md` and/or `outline.md` when the fixes are clear
- Use `/answer` only for genuine human decisions that block finalizing those docs
- End with updated docs that are ready for `/q-plan`, or clearly state the remaining decision(s)

### Implementation review

The goal is to produce a verified implementation review, then choose the right follow-up path with the engineer.

- Review the code and verification evidence
- Write the canonical implementation review artifact
- If the implementation is correct, the pipeline is complete
- If findings are clear and straightforward, use `/answer` to confirm the intended action for each straightforward item before fixing it in the review context window
- If findings require design tradeoffs, additional research, unclear scope, or multi-slice work, write them into a follow-up questions document instead of trying to solve them in review
- After `/answer` returns, apply only the confirmed straightforward fixes, rerun relevant verification, and update the same review artifact
- If non-straightforward findings exist, keep the same `plan_dir`, write a new questions document under `[plan_dir]/questions/`, then fix the confirmed straightforward items in the current review context

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md`
   - Read `~/.pi/agent/skills/review-rubric/SKILL.md`
1. **Resolve the review mode:**
   - **Outline mode** if the user passed an `outline.md` path, explicitly asked to review the outline/design, or passed a plan directory that has `outline.md` but no implement-complete handoff.
   - **Implementation mode** if the user passed an implement handoff path, or passed a plan directory with an implement-complete handoff in `[plan_dir]/handoffs/`.
   - If both could apply for a plan directory, prefer **implementation mode** only when you can resolve a complete implement handoff. Otherwise review the outline.
2. **If an implement handoff path was provided**, read it and resolve `plan_dir` from the frontmatter.
3. **If an outline path was provided**, resolve `plan_dir` from the parent directory.
4. **If a plan directory path was provided**, resolve the mode using rule 1.
5. **If no parameter was provided**, respond:

```text
I'll review either the outline/design pair or the completed implementation and write the canonical review artifact into the plan directory.

Please provide one of:
- an outline path, e.g. `/q-review thoughts/[git_username]/plans/.../outline.md`
- an implement handoff path, e.g. `/q-review thoughts/[git_username]/plans/.../handoffs/YYYY-MM-DD_HH-MM-SS_implement-handoff.md`
- or a plan directory path, e.g. `/q-review thoughts/[git_username]/plans/YYYY-MM-DD_HH-MM-SS_plan-name`
```

Then wait for input.

## Canonical Review Artifact Location

Create the review at:

- **Outline review:**
  ```text
  [plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_outline-review.md
  ```
- **Implementation review:**
  ```text
  [plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review.md
  ```

This is the canonical `/q-review` output location.

- Reviews for QRSPI do **not** live in `thoughts/[git_username]/reviews/`
- The review artifact belongs in the specific plan directory under `reviews/`
- Always return the exact path to that file in the final response

## Implementation Follow-up Questions Doc

If implementation review findings require question/research/planning, **reuse the same `plan_dir`**. Do not create a new QRSPI plan directory for review follow-ups.

Write one questions document for the non-straightforward review findings under:

```text
[plan_dir]/questions/YYYY-MM-DD_HH-MM-SS_[plan-name]_review-followup-questions.md
```

The questions document must link to the canonical implementation review artifact in `[plan_dir]/reviews/` and turn each `needs_question_research` finding into neutral research/design questions with file references and context from the review. If the questions are clear and complete, the next step is:

```text
/skill:q-research [exact path to questions doc]
```

## Load Context

After resolving `plan_dir` and mode, load:

### Outline review

- `[plan_dir]/AGENTS.md`
- `[plan_dir]/outline.md`
- `[plan_dir]/design.md` when it exists — this is part of the primary review target, not just background
- relevant files in `[plan_dir]/questions/`
- relevant files in `[plan_dir]/research/`
- relevant files in `[plan_dir]/context/design/`
- relevant files in `[plan_dir]/context/outline/`
- relevant files in `[plan_dir]/prds/`
- the code/files explicitly referenced by the design or outline, plus any code you need to verify claims

If `design.md` is missing because the outline came from direct-outline mode, review the outline against the available task context and codebase reality. Only flag the missing design doc if it materially weakens alignment or decision traceability.

### Implementation review

- `[plan_dir]/AGENTS.md`
- the implement-complete handoff you were given, or the newest implement-complete handoff in `[plan_dir]/handoffs/`
- `[plan_dir]/plan.md`
- the files explicitly called out by the handoff's **Context Artifacts** and **Next** sections
- the actual changed code you are reviewing

Use `design.md`, `outline.md`, `questions/*.md`, `research/*.md`, and `context/implement/*.md` only as needed to clarify intent. The primary review target is the code plus the implement handoff.

## Focused Review Subagents

For tiny, localized changes, review directly in the main session.

For anything broader than a tiny change, delegate focused review lanes using the private lane prompts in `agents/` next to this skill. Select lanes based on the planned, outlined, or implemented changes rather than always running every lane.

These lane prompts intentionally live under `skills/q-review/agents/`, not the root Pi agent directory, so they do **not** become globally discoverable subagents. `/q-review` loads them only when this skill is invoked, then runs the generic `reviewer` subagent with the selected lane prompt included in the task.

### Review Agent Catalog

All focused review lane prompts live in `agents/` relative to this `SKILL.md`. Run them through the generic `reviewer` subagent, which is configured in the root Pi agent directory as `model: gpt-5.5` with `thinking: medium`.

| Lane prompt | Type | Dispatch when the planned/outlined/implemented change touches |
|---|---|---|
| `q-review-intent-fit` | Cross-cutting | design fidelity, requirement coverage, scope drift, and plan/implementation adherence |
| `q-review-correctness` | Cross-cutting | behavioral correctness, regressions, edge cases, state transitions, and broken contracts |
| `q-review-security-invariants` | Cross-cutting | auth/authz, trust boundaries, validation, privacy, data integrity, and invariants |
| `q-review-tests-verification` | Cross-cutting | slice checkpoints, test coverage, verification evidence, CI risk, and acceptance proof |
| `q-review-integration-ops` | Cross-cutting | integrations, migrations, rollout/rollback, configuration, observability, and operational risk |
| `q-review-maintainability` | Cross-cutting | architecture fit, complexity, conventions, readability, and long-term maintainability |
| `q-review-go` | Domain | Go code, Go tests, package interfaces, generated Go code, concurrency, context/error handling |
| `q-review-temporal` | Domain | Temporal workflows, activities, workers, workflow-start/signal/query API code, retries, replay, payload history |
| `q-review-sql` | Domain | PostgreSQL/sqlc queries, migrations, indexes, generated query code, data integrity, RisingWave/materialized views |
| `q-review-snowflake` | Domain | Snowflake SQL, `snow` CLI scripts, schemas/databases/roles/grants, analytics warehouse operations |
| `q-review-frontend-ui` | Domain | frontend UI, React/TSX, `.templ`, Datastar, browser behavior, UX/accessibility, Figma/Ranger expectations |
| `q-review-data-tables` | Domain | data tables, filters/sorts/pagination/export/saved views, Twisp/OpenSearch/SQL table backends |
| `q-review-identity-fields` | Domain | identity-bearing fields, normalization, lookup/matching/dedupe/upsert semantics, unique indexes, historical data |
| `q-review-data-ingestion-quality` | Domain | CSV/TSV/source data, ETL/import quality, migration input validation, cross-file integrity, ingestion readiness |
| `q-review-ci-workflows` | Domain | GitHub Actions, CI/CD workflows, build scripts, sourced shell config, ports/env wiring, removal safety |
| `q-review-api-auth` | Domain | API authentication, DodgyAuth, API keys, base62 client IDs, secret hashing, tenant scoping, auth errors |
| `q-review-error-visibility` | Domain | workflow/ingestion error surfaces, error queues, issue pages, status tooltips, integration UI failures |
| `q-review-local-best-practices` | Catch-all | any domain with project-local `.agents/skills`, `.agents/rules`, `.cursor/rules`, or `.claude/skills` guidance but no dedicated domain reviewer |

Domain agents must first read project-local best-practice docs when present (for example `.agents/skills/go/*.md`, `.agents/skills/temporal-workflows/SKILL.md`, `.agents/skills/writing-sql-queries/SKILL.md`, `.agents/skills/building-tables/SKILL.md`, `.agents/skills/identity-field-hardening/SKILL.md`, `.cursor/rules/*.mdc`, or package-local instructions). These best-practice docs are part of the review source of truth for that lane. Use `q-review-local-best-practices` as the catch-all for "etc." domains with their own local guidance.

Default lane selection:

- **Outline review:** usually run `q-review-intent-fit`, `q-review-tests-verification`, and then add `q-review-integration-ops`, `q-review-security-invariants`, or `q-review-maintainability` when the outline touches those risks.
- **Implementation review:** usually run `q-review-correctness`, `q-review-tests-verification`, and then add `q-review-intent-fit`, `q-review-security-invariants`, `q-review-integration-ops`, or `q-review-maintainability` based on the changed code.
- **Domain dispatch:** add every catalog agent whose trigger matches the reviewed artifacts or changed files. Examples: `.go`/`go.mod`/`_test.go` → `q-review-go`; Temporal workflow/activity/worker/API orchestration → `q-review-temporal`; `.sql`/migrations/sqlc/generated query code/materialized views → `q-review-sql`; `.tsx`/`.templ`/Datastar/Ranger/Figma → `q-review-frontend-ui`; table filter/sort/export work → `q-review-data-tables`; identity normalization/import matching → `q-review-identity-fields`; `.github/**` → `q-review-ci-workflows`.
- If a change touches security-sensitive code, persistence, migrations, external calls, auth, payments, PII, secrets, concurrency, or deployment/runtime behavior, include the corresponding focused lane.

Run selected lanes in parallel with the `subagent` tool. Prefer a `chain` with one `parallel` step so every lane can set `output: false` and avoid file collisions. Keep each prompt narrow.

Before launching lanes:

1. Read each selected lane prompt from `agents/[lane].md` relative to this skill directory.
2. Paste the full selected lane prompt into that lane's delegated task.
3. Run the generic `reviewer` subagent for each lane with `output: false`. Do not set a per-task model unless deliberately overriding the root `reviewer` agent config.

Use this shape:

```json
{
  "chain": [
    {
      "parallel": [
        {
          "agent": "reviewer",
          "task": "Use this focused lane prompt exactly:\n\n[contents of agents/q-review-correctness.md]\n\nReview only this lane for [mode] review. plan_dir=[path]. reviewed_artifact=[path]. changed_files=[paths]. Do not edit files.",
          "output": false
        },
        {
          "agent": "reviewer",
          "task": "Use this focused lane prompt exactly:\n\n[contents of agents/q-review-tests-verification.md]\n\nReview only this lane for [mode] review. plan_dir=[path]. reviewed_artifact=[path]. changed_files=[paths]. Do not edit files.",
          "output": false
        },
        {
          "agent": "reviewer",
          "task": "Use this focused lane prompt exactly:\n\n[contents of agents/q-review-go.md]\n\nReview only this lane for [mode] review. plan_dir=[path]. reviewed_artifact=[path]. changed_files=[paths]. Do not edit files.",
          "output": false
        }
      ]
    }
  ],
  "clarify": false
}
```

Each subagent report is advisory. The main `/q-review` agent must:

- read every lane report before writing the canonical review artifact
- independently verify any candidate finding before including it
- discard speculative, duplicate, stale, or out-of-scope findings
- synthesize the surviving findings into one canonical review artifact
- never let subagents write or replace the canonical review artifact

If a candidate finding is ambiguous, use `codebase-analyzer` to trace the exact path before deciding whether it belongs in the review.

## Process

1. Run `~/dotfiles/spec_metadata.sh` and use it for the review filename timestamp and frontmatter metadata.
2. Resolve the review mode, the exact reviewed artifact path, and `plan_dir`.
3. Build independent understanding before judging.
   - **Outline review:** before reading `outline.md` closely, first locate the related implementation files, tests, configuration, similar existing patterns, adjacent docs/artifacts, and any recent changes in the touched paths. Use targeted discovery/analyzer tools or focused subagents if helpful. Answer: what components this touches, what patterns already exist, what adjacent systems could break, and what prior context already exists.
   - **Implementation review:** read the implement handoff carefully to understand what changed, what passed, and which files to inspect first.
4. Inspect the actual target.
   - **Outline review:** read `design.md` and `outline.md` fully, then review the structure, slice boundaries, sequencing, interfaces, migrations, and test checkpoints.
   - **Outline review claim verification:** if the design/outline says "we already have X," verify X exists; if it says "this is similar to Y," read Y; if it references a file, function, interface, dependency, or system behavior, inspect it yourself. Check recent history in touched paths when it matters.
   - **Implementation review:** review the current code in the changed files and use `git show`, `git diff`, or `git status` as needed to identify what was introduced.
5. Estimate review scope and choose focused lanes.
   - If the scope is tiny and localized, continue directly.
   - Otherwise select the focused `agents/q-review-*.md` lane prompts whose lanes match the planned/outlined/implemented change, read those prompts, and run them in parallel through the generic `reviewer` subagent with `output: false`.
   - Always consider both cross-cutting lanes and domain lanes. Domain lanes are triggered by file types, frameworks, or risks described in `design.md`, `outline.md`, `plan.md`, the implement handoff, or the diff.
   - Include the mode, `plan_dir`, reviewed artifact path, key context artifacts, changed files or suspected touched areas, local best-practice docs to read, and the lane boundary in each delegated task.
   - Wait for all lane reports before drafting the canonical review.
6. Synthesize lane reports.
   - Read every focused lane report.
   - Cluster duplicate candidate findings across lanes.
   - Treat every subagent finding as advisory until verified in the main session.
7. Verify candidate findings yourself.
   - Re-read the implicated files.
   - Use `codebase-analyzer` when you need an exact implementation trace.
   - Discard speculative, duplicate, stale, out-of-scope, or low-signal findings.
8. Apply the correct review lens.

### Outline review lens

Prioritize issues that materially improve plan quality before code is written.

**Core checks**
- does the outline faithfully implement the approved design, or does it quietly drift?
- are the slices truly vertical, independently testable, and sequenced to reduce risk?
- are migrations, rollout/rollback, error handling, observability, security, and invariants covered where they matter?
- are there hand-waved dependencies, missing integration details, or unjustified assumptions?
- do the test checkpoints actually prove each slice works?

**Review dimensions**
- **Scope & requirements** — missing requirements, ambiguous language, edge cases, failure modes, and clear out-of-scope boundaries
- **Technical feasibility** — dependencies, integration points, migrations/state changes, and performance/resource assumptions
- **Operational readiness** — observability, rollout/rollback, feature flags, and on-call impact
- **Security & invariants** — auth/authz, data sensitivity, input validation, trust boundaries, and correctness constraints
- **Timeline & risk** — unknowns, external dependencies, phasing, and reversibility

**Planner blind spots / red flags**
- happy-path-only slices or checkpoints
- hand-wave language like "this should be straightforward," "similar to X," or "we'll figure that out later"
- hidden dependencies on other teams/systems or undocumented contracts
- glossed-over migration, rollback, retry, or data consistency concerns
- scope creep or unrelated "while we're here" additions

### Implementation review lens

Apply the normal code review rubric:
- flag only real, actionable issues introduced by the implementation
- re-run relevant verification commands when practical
- do not claim a check passed unless you ran it or the handoff clearly marks it as prior evidence
- prefer a short accurate review over invented findings

9. Write the review artifact to `[plan_dir]/reviews/`.

10. **If this is outline review, treat it as an editing pass:**
   - If the fixes are clear and do not require new human decisions, edit `design.md` and/or `outline.md` now.
   - Re-read the updated docs and ensure the review artifact reflects the post-edit state, not just the pre-edit findings.
   - If real human decisions are still needed, ask them in a dedicated `Questions for /answer` section, invoke `/answer` in interactive mode, and use the answers to finish updating the docs.
   - The desired end state is: updated `design.md`/`outline.md` ready for `/q-plan`, or a short list of explicitly unresolved human decisions.

11. **If this is implementation review, classify findings and use `/answer` item-by-item for straightforward fixes:**
   - If the verdict is `correct`, the pipeline is complete.
   - If the verdict is `needs_attention`, classify each finding before asking the engineer:
     - `straightforward_fix` — the issue, fix, and verification are clear; it is safe to patch in the current review context window after engineer confirmation.
     - `needs_question_research` — the issue requires product/design judgment, more codebase research, tradeoff analysis, broad refactoring, multiple slices, or unclear ownership.
   - Write the review artifact before creating follow-up docs or asking the engineer so decisions are grounded in a durable artifact.
   - If any `needs_question_research` findings exist, write the follow-up questions document under `[plan_dir]/questions/`. Do **not** create a new QRSPI plan directory.
   - Do **not** ask the engineer whether to send non-straightforward findings to QRSPI; add all `needs_question_research` findings to the follow-up questions document automatically.
   - For every `straightforward_fix` finding, ask a separate `/answer` question confirming what to do with that item. Each question must include the finding summary, exact file refs, suggested fix, and verification command, and allow the engineer to answer `apply`, `skip`, or provide a different instruction. The question text itself must start with the finding title/summary before asking whether to apply the fix, so the engineer can see the problem without opening the review artifact.
   - After `/answer` returns, patch only the straightforward items the engineer confirmed, rerun relevant verification, and update the same review artifact with the fixes, skipped items, follow-up questions doc path, and final status.
   - The follow-up next step for `needs_question_research` findings is `/skill:q-research [exact path to questions doc]`.
   - Do not use in-session fixing for ambiguous, broad, or design-sensitive findings just because the code edit looks small.

12. If the review surfaces durable learnings that future agents should remember first, update `[plan_dir]/AGENTS.md`.
13. Always summarize the review doc findings in the user-facing response.

## Review Template

Use this structure:

```markdown
---
date: [ISO datetime with timezone]
reviewer: [your name]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
plan_dir: [exact plan dir path]
review_mode: [outline|implementation]
reviewed_artifact: [exact outline.md path or implement handoff path]
design_reviewed: [exact design.md path or `none`]
status: complete
type: [outline_review|implementation_review]
verdict: [correct|needs_attention]
---

# [Outline|Implementation] Review: [plan name]

### Summary
[Short overall assessment.]

### Findings Summary
- [Short bullet for each finding. If none, say the work looks good.]

### Findings
[Numbered findings with priority tags and file references. If none, say the work looks good. Each finding must include either `Suggested fix:` for `straightforward_fix` findings or `Questions before fix:` for `needs_question_research` findings. Do not include a finding that has neither a suggested fix nor concrete questions needed before proposing a fix.]

### Focused Review Lanes
- `[agent-name]` — verdict: [pass|concerns|fail]; included findings: [count]; notes: [short synthesis]

If no subagents were used, say `Not used; review was small/localized.`

### Questions / Decisions Needed
This section must come after `Findings Summary` and `Findings`. Use answer-tool-compatible formatting when user input is needed. For implementation `straightforward_fix` decisions, prefix each question with the finding title/summary before the suggested action:

1. Finding 1 — [finding title/summary]. Should I apply the recommended straightforward fix?
   Context: Finding: [what is broken and exact file refs]. Suggested fix: [what should change]. Verification: [command]. Answer `apply`, `skip`, or provide alternate instructions.
2. Finding 2 — [finding title/summary]. Should I apply the recommended straightforward fix?
   Context: Finding: [what is broken and exact file refs]. Suggested fix: [what should change]. Verification: [command]. Answer `apply`, `skip`, or provide alternate instructions.

If none, say `None.`

### Implementation Follow-up Decision
[For implementation reviews with findings: summarize each straightforward item decision from `/answer` (`apply`, `skip`, or custom instruction) and whether a non-straightforward questions doc was created. For outline reviews or no findings, say `not_applicable.`]

### Finding Classification
- `straightforward_fix` — [finding numbers]
- `needs_question_research` — [finding numbers]

If no findings, say `None.`

### Applied Edits
- `path/to/design.md` — [what changed]
- `path/to/outline.md` — [what changed]

If no docs were edited, say `None.`

### Applied Implementation Fixes
- `path/to/file` — [what was fixed after `/answer`, plus verification]

If no implementation code was fixed in-session, say `None.`

### Follow-up Plan Dir
[Exact `plan_dir` reused for implementation-review follow-up questions, or `None.`. Never create a separate review-followup plan dir.]

### Follow-up Questions Doc
[Exact path to the `[plan_dir]/questions/*.md` doc for non-straightforward implementation findings, or `None.`]

### What's Good
[Short list of strengths worth preserving.]

### Verification
[List the commands you ran and the outcome.]

### Recommended Next Steps
[Concrete follow-up actions. If there are no findings, say the work is ready for the next stage.]
```

## Response Format

End with this exact five-line shape. Always include a `Changes:` line summarizing the edits made during the review. If no files were edited and no in-session fixes were applied, say `Changes: none.` Always summarize findings before any `Questions for /answer` section; the `Findings:` line is the required pre-question summary.

If the verdict is `correct` for an **outline review**:

```text
Artifact: [exact path to review file]
Summary: outline review complete. design/outline updated as needed. verdict: correct.
Changes: [short summary of the design.md / outline.md / AGENTS.md / ADR edits made during review]
Findings: none.
Next: /q-plan [exact path to outline.md]
```

If the verdict is `needs_attention` for an **outline review**:

```text
Artifact: [exact path to review file]
Summary: outline review needs decisions before design/outline can be finalized.
Changes: [short summary of edits already made during review, or none.]
Findings: [short summary of the remaining review doc findings]
Next: /q-review [exact path to outline.md]
```

If user decisions are needed for outline review, add a **Questions for /answer** section after the five-line response shape using this exact shape, then immediately invoke `/answer` with `execute_command` in interactive mode:

```text
Questions for /answer
1. [Direct question?]
   Context: [brief context tied to the finding]
2. [Direct question?]
   Context: [brief context tied to the finding]
```

Do not put any other question marks outside that section unless you intentionally want `/answer` to extract them too.

If the verdict is `correct` for an **implementation review**:

```text
Artifact: [exact path to review file]
Summary: implementation review complete. verdict: correct.
Changes: [short summary of any applied implementation fixes or review-time doc updates, or none.]
Findings: none.
Next: pipeline complete
```

If the verdict is `needs_attention` for an **implementation review**, first write the review artifact. If there are any `needs_question_research` findings, create the follow-up questions doc in the same `plan_dir` before asking about straightforward fixes.

If there are `straightforward_fix` findings, then ask the engineer to confirm each straightforward fix:

```text
Artifact: [exact path to review file]
Summary: implementation review complete. verdict: needs_attention. non-straightforward findings copied to questions doc as needed; awaiting engineer confirmation for straightforward fixes.
Changes: [short summary of review-time edits already made, or none yet.]
Findings: [short summary of the review doc findings, including straightforward vs needs-question/research classification]
Next: awaiting /answer decisions for straightforward fixes
```

Add a **Questions for /answer** section after the five-line response shape using this exact shape, then immediately invoke `/answer` with `execute_command` in interactive mode:

```text
Questions for /answer
1. Finding 1 — [finding title/summary]. Should I apply the recommended straightforward fix?
   Context: Finding: [what is broken and exact file refs]. Suggested fix: [what should change]. Verification: [command]. Answer `apply`, `skip`, or provide alternate instructions.
2. Finding 2 — [finding title/summary]. Should I apply the recommended straightforward fix?
   Context: Finding: [what is broken and exact file refs]. Suggested fix: [what should change]. Verification: [command]. Answer `apply`, `skip`, or provide alternate instructions.
```

Do not ask `/answer` whether to create a questions doc for `needs_question_research` findings. Add those findings to the same-plan follow-up questions doc automatically before fixing straightforward items.

If there are no `straightforward_fix` findings and there are `needs_question_research` findings, do not invoke `/answer`; create the follow-up questions doc and end with:

```text
Artifact: [exact path to review file]
Summary: implementation review complete. follow-up questions doc created for non-straightforward findings.
Changes: [short summary of review-time edits already made, or none.]
Findings: [short summary of the non-straightforward findings]
Next: /skill:q-research [exact path to questions doc]
```

After `/answer` returns:

- Apply only straightforward fixes that the engineer confirmed with `apply` or concrete alternate instructions.
- Do not apply skipped or ambiguous items.
- Rerun relevant verification.
- Update the same review artifact with `/answer` decisions, applied fixes, skipped fixes, verification, and remaining findings.
- If `needs_question_research` findings exist, write the questions doc under `[plan_dir]/questions/` and end with:
  ```text
  Artifact: [exact path to review file]
  Summary: implementation review straightforward findings handled; follow-up questions doc created for non-straightforward findings.
  Changes: [short summary of applied straightforward fixes plus any review-time doc updates.]
  Findings: [short summary of remaining non-straightforward findings]
  Next: /skill:q-research [exact path to questions doc]
  ```
- If no `needs_question_research` findings remain and all confirmed straightforward fixes pass verification, end with:
  ```text
  Artifact: [exact path to review file]
  Summary: implementation review straightforward findings handled in-session. verdict: correct.
  Changes: [short summary of the applied straightforward fixes.]
  Findings: none.
  Next: pipeline complete
  ```
- If straightforward findings were skipped or still fail verification, end with:
  ```text
  Artifact: [exact path to review file]
  Summary: implementation review complete. some straightforward findings remain after /answer decisions or verification.
  Changes: [short summary of applied and skipped straightforward fixes.]
  Findings: [short summary of remaining findings]
  Next: /q-review [exact implementation review artifact path]
  ```

## Rules

- Write exactly one canonical review artifact in `[plan_dir]/reviews/`.
- Outline review must review `design.md` and `outline.md` together when `design.md` exists.
- In outline review mode, the primary goal is to improve `design.md` and `outline.md`, not to leave only a report.
- In outline review mode, verify named references and major assumptions directly in the codebase or supporting docs instead of trusting the outline's framing.
- Implementation review must review the actual code and verification evidence, not just the plan.
- In implementation review mode, write the review artifact before making any follow-up decision or code fix.
- In implementation review mode, use `/answer` to confirm each `straightforward_fix` item before modifying implementation code.
- In implementation review mode, only modify implementation code for `straightforward_fix` findings confirmed by the engineer through `/answer`.
- In implementation review mode, do not ask whether to send `needs_question_research` findings to QRSPI; add them to a follow-up questions doc in the same `plan_dir` automatically.
- When implementation review needs question/research follow-up, write the questions doc under `[plan_dir]/questions/` and hand off to `/skill:q-research [exact path to questions doc]` when questions are clear. Never create a separate review-followup plan dir.
- Focused subagent review lanes are optional for tiny/localized reviews and expected for broader reviews; the main session owns synthesis and final judgment.
- Domain subagents must be selected from the planned/outlined/implemented change signals, not run blindly.
- Always verify high-signal subagent findings yourself before including them.
- Always summarize the review artifact findings to the user.
- Always include a `Changes:` line in the user-facing response summarizing review-time edits, or `Changes: none.` when nothing was changed.
- Do not abbreviate artifact or next-step paths in the response.
- Use `/answer` for real human decisions that block finalizing `design.md`/`outline.md`, and for implementation-review confirmation of each `straightforward_fix` item.
- Format user-decision prompts to be compatible with `~/.pi/agent/extensions/answer.ts`: one direct question per item, each ending with `?`, followed by an optional `Context:` line. For implementation-review straightforward-fix prompts, the direct question must begin with `Finding N — [finding title/summary].` before asking whether to apply the fix, and the `Context:` line must separate `Finding:`, `Suggested fix:`, and `Verification:` so the problem is clear before the proposed action.
- Prefer a short accurate review over a long speculative one.
