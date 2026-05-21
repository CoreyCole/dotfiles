---
name: q-outline
description: Create a structured outline (~2 pages) from approved `design.md` and optional `design-product.md` — signatures, types, vertical slices, test checkpoints. Fifth stage of QRSPI pipeline. `/q-review` is the formal LLM planning review gate before `/q-plan`.
---

# Structured Outline — How Do We Get There?

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

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

You are the fifth stage of the QRSPI pipeline. You answer the question **"how do we get there?"** in a structured outline that is the "C header file" for the implementation — signatures, types, phases, and test checkpoints. No full implementations. Standard mode starts from approved `design.md`; load `design-product.md` when present. After the outline is written, `/q-review` is the formal LLM planning review gate before `/q-plan`.

**Design vs. Outline vs. Plan:** The design says *what* we're building and *why*. The outline says *how* — type definitions, package structures, interface signatures, database schemas, API surfaces, vertical slices with test checkpoints. The plan expands the outline into full implementation code. If the design is the architecture review, the outline is the sprint planning. The plan is the coding agent's instructions.

## When Invoked

This skill supports two modes.

### Mode 1: Standard QRSPI outline

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read `[plan_dir]/AGENTS.md`
   - Read all files in `[plan_dir]/questions/`
   - Read `[plan_dir]/design.md`
   - Read `[plan_dir]/design-product.md` if present
   - Read ADR files listed in `design.md` frontmatter `related_adrs` (or all files in `[plan_dir]/adrs/` if the frontmatter is missing/empty)
   - Read brainstorm docs listed in `design.md` frontmatter `brainstorm_docs` if not already loaded
   - Read all files in `[plan_dir]/research/`
   - Read all files in `[plan_dir]/context/research/`
   - Read all files in `[plan_dir]/context/design/`
   - Read all files in `[plan_dir]/context/design-product/` if any
   - Read all files in `[plan_dir]/context/outline/` if any
   - Read all files in `[plan_dir]/prds/`
1. **If a plan directory path, design doc path, or product-design doc path was provided**, resolve the plan directory from it, load the artifacts above, then begin. If the path is under `[parent_plan_dir]/reviews/*/`, that timestamped review directory is the plan directory and all outline artifacts must be written there.

### Mode 2: Direct outline mode (simple tasks)

Use this mode when the user has a clear, bounded task and wants to skip earlier QRSPI stages.

1. **If no plan directory path was provided, but the user gave a concrete task/ticket/description or referenced files**, do NOT stop and ask for prior QRSPI artifacts.
1. Run `~/dotfiles/spec_metadata.sh` and use it as the source of truth for:
   - git username
   - `Timestamp For Filename` for the plan directory and any timestamped filenames
   - frontmatter fields (`date`, `researcher`, `git_commit`, `branch`, `repository`)
1. Create a new plan directory under:
   - `thoughts/[git_username]/plans/[timestamp]_[plan-slug]/`
1. Copy `AGENTS.md` into the plan dir from `~/.agents/skills/qrspi-planning/_AGENTS.md` if missing.
1. Ensure `context/{question,research,design,design-product,outline,plan,implement}/` exists in the new plan directory.
1. Treat user-provided task + referenced files as source material.
1. Read all referenced files fully.
1. Read relevant codebase files needed to produce an accurate outline. If current-state discovery is still needed, run `codebase-locator` and, if needed, `codebase-analyzer`, then write timestamped artifact(s) under `[plan_dir]/context/outline/`.
1. Write `outline.md` in the new plan directory.
1. If helpful, you may add lightweight supporting artifacts (`research/`, `design.md`) for your own structure, but this is optional.

### If no useful input was provided

If there is neither a plan directory/design path nor a concrete task/ticket/description, respond:

```
I'll create a structured outline.

Please provide either:
1. A QRSPI plan directory path or design doc path
   e.g. `/q-outline thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
   or `/q-outline thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/design.md`
2. Or a well-defined task/ticket/description
   e.g. `/q-outline Add per-agent timeout configuration in pkg/agents`
```

Then wait for input.

## Process

### Standard mode

1. **Verify artifacts are loaded**: `[plan_dir]/AGENTS.md`, all `questions/*.md`, `design.md`, ADRs from `design.md` frontmatter `related_adrs` (or `[plan_dir]/adrs/` fallback), optional `design-product.md`, all `research/*.md`, brainstorm docs from `design.md` frontmatter `brainstorm_docs`, relevant context artifacts in `context/research/`, `context/design/`, optional `context/design-product/`, and `context/outline/`, and any relevant files in `prds/`.
   - Missing `design-product.md` is not a blocker for internal tools, bugfixes, refactors, or other low product-risk work.
   - Stop if `design-product.md` exists and has verdict `Blocked`, unless the user explicitly accepts the blocker/override.
   - If `design-product.md` is missing but product/PRD coverage is clearly needed, ask whether to run `/q-design-product [design.md]` first; otherwise proceed from `design.md`.
   - For review-directory follow-up plans, preserve the parent plan as historical context only. Do not overwrite or append to the parent plan's `outline.md`; write the follow-up outline to `[parent_plan_dir]/reviews/*/outline.md`.
1. **If current-state validation is still needed, run `codebase-locator`** with a narrow task and, if needed, `codebase-analyzer` on the surfaced files or flows. Write the resulting timestamped artifact(s) under `[plan_dir]/context/outline/`.
1. **Define the structural foundation** — types, interfaces, schemas, package structures.
1. **Break the approved approach into vertical slices.** Each slice must be independently testable.
1. **For each slice, define:**
   - Files to create or modify
   - Key signatures and types (what, not how)
   - Test checkpoint — how to verify this slice works
1. **Present the outline to the user** for review.
1. **Iterate** until approved.
1. **If the approved outline locked in durable slice boundaries, sequencing changes, or non-obvious implementation constraints, update `[plan_dir]/AGENTS.md`.**
   - Keep it short and curated.
   - Point back to `outline.md` or other canonical artifacts instead of duplicating them.
1. **Immediately before writing or updating `outline.md`, gather metadata** with `~/dotfiles/spec_metadata.sh`, use it to populate the frontmatter fields, and then write the final outline.

### Direct-outline mode

1. Derive the structure from the concrete task + codebase reality.
1. Build sensible vertical slices in delivery order.
1. Include signatures/types and explicit test checkpoints.
1. Present to user for review and iterate until approved.
1. Immediately before writing or updating `outline.md`, run `~/dotfiles/spec_metadata.sh`, use it to populate the frontmatter fields, and then write the final outline.

## Output Template

Write to `[plan_dir]/outline.md`.

Output artifact style: be extremely concise. Sacrifice grammar for the sake of concision.

````markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: outline
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# Outline: [Feature Name]

## Overview
[2-3 sentences. What we're building, the approved technical approach from design.md, and the product gate verdict from design-product.md if present (or note product design was not used because scope is internal/low product-risk; or direct-task context in direct mode).]

## Type Definitions
Use fenced code blocks for structural content so it gets syntax highlighting.
Prefer `go` blocks for types, interfaces, and signatures instead of long bullet lists.

```go
type ExampleInput struct {
    TenantID int32
}

type ExampleResult struct {
    ID string
}

func DoThing(ctx context.Context, input ExampleInput) (ExampleResult, error)
```

## Database Schema (if applicable)

Use fenced `sql` blocks for schema, indexes, and query-shape notes.

```sql
create table example_records (
    id bigserial primary key,
    tenant_id integer not null
);
```

## Package / File Structure

Use normal markdown for file/package layouts. Prefer short path lists or compact bullets.

- `pkg/example/`
- `api/internal/example/`
- `db/queries/example.sql`

## API Surface (if applicable)

Use fenced `go`, `proto`, or `text` blocks depending on the surface being described.

```go
func (s Service) CreateExample(...) (*connect.Response[v1.CreateExampleResponse], error)
```

## Slices

### Slice 1: [Name]

**Files:**

- `path/to/file.ext` (new)
- `path/to/other.ext` (modify)

```go
func FunctionName(param Type) (ReturnType, error)

type NewStruct struct { ... }
```

**Test checkpoint:** [How to verify this slice works — specific command or assertion]

### Slice 2: [Name]

[Use the same block-based format]

### Slice N: [Name]

...

## Out of Scope

Use normal markdown bullets for explicit exclusions.

- [Things explicitly not included in this implementation]

````

## Response

When `outline.md` is written, emit this fenced XML result, followed by the mandatory concise human summary.

Post-XML natural summary format for this stage: as concise as possible; one line per slice/part. Caveman speak. Few words. Most important words only. Use:

```text
Outline:
- [part]: [work]
- [part]: [work]
```

```xml
<qrspi-result>
  <stage>outline</stage>
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
  <artifact>thoughts/.../outline.md</artifact>
  <next>/q-review thoughts/.../outline.md</next>
</qrspi-result>
```

Always include the complete `thoughts/.../outline.md` path.

## Rules

- This is the structural backbone — longer than the design, shorter than the plan. Include type definitions, schemas, API surfaces, and package structures that the design deliberately omits.
- For review follow-up work, `outline.md` means `reviews/*/outline.md` in the timestamped review directory. Never fold implementation-review follow-up structure into the parent plan's original `outline.md` unless the user explicitly asks for a parent-plan revision.
- **Vertical slices, not horizontal layers.** Each slice ships a working piece end-to-end. If your slices are "all models", "all routes", "all tests" — you're doing it wrong.
- Show signatures and types, NOT full function bodies. The plan stage fills in the implementation.
- Prefer fenced code blocks over bullet lists for structural content where syntax highlighting helps:
  - `go` for types, interfaces, and function signatures
  - `sql` for schema/query shapes
  - `proto` for RPCs/messages when relevant
- Do not put labels like `Signatures:` inside a `go` fence. The fence itself implies the content type.
- Use normal markdown, not fenced `text` blocks, for file lists, checkpoints, and out-of-scope notes.
- Do not cram type definitions into inline bullets unless the content is very short. The outline should read like a header file, not meeting notes.
- Every slice must have a test checkpoint. If you can't describe how to test it, the slice is too big or too vague.
- Output artifact style: be extremely concise. Sacrifice grammar for the sake of concision.
- Standard mode must preserve `design-product.md` Critical Findings in slices, test checkpoints, or Out of Scope when `design-product.md` exists.
- Present to the user BEFORE writing the final file. This is the last human review gate before LLM planning review.
- Completion responses must be the fenced XML `<qrspi-result>` block required by the runtime contract, followed by the mandatory concise human summary.
- Post-XML summary for outline stage: one concise line per slice/part. Caveman clear. No implementation detail dump.
