---
name: q-resume
description: Resume work within a QRSPI planning pipeline from a handoff document
---

## QRSPI mode contract

- `autoMode=false`: stop at human gates; still emit valid `<qrspi-result>` and show validated advance button.
- `autoMode=true`: continue through human gates automatically unless `needs_human`, `blocked`, `error`, invalid artifact, disallowed transition, run failure, or XML retry exhaustion.
- `enablePlanReviews=true`: run planning `/q-review` after outline and plan. Do not run `/q-review` immediately after design; design advances to `/q-outline` (or optional `/q-design-product`).
- `enablePlanReviews=false`: skip planning `/q-review`; final implementation `/q-review` always runs.
- Research never has its own human stop. Humans evaluate research in design/outline review.
- Emit the QRSPI XML footer as a fenced `xml` code block at the end of every completed QRSPI stage result so it is syntax highlighted.

## QRSPI XML summary contract

The `<summary>` element is used by humans to understand workflow state before asking follow-up questions or advancing. It must be structured, specific, self-contained, not a generic completion label. Use these child elements inside `<summary>`:

- `<plan-goal>`: overall plan/workflow goal in plain language; not just current stage label.
- `<stage-completed>`: what this stage/session did and how it moves toward the goal. Extremely concise; sacrifice grammar for concision.
- `<key-decisions>`: direction we are headed; significant tradeoffs, risks, open questions, follow-up, or why next step is safe. Use `None.` only when truly none.

Keep each child element short: 1-2 concise lines max.

For review stages, always include both: (1) what the entire implementation/plan now does as a whole, and (2) what this review session checked and changed. Do not write vague summaries like `review complete`, `implementation review result`, `done`, or `summary of findings` without the concrete details a human would need to ask informed questions.

## QRSPI footer instructions

When more than one artifact is relevant, keep `<artifact>` as the primary next-command artifact and also include `<artifacts>` with every important artifact path, including review records, done summaries, handoffs, ADRs, and follow-up questions.

Do not duplicate the same artifact/summary/next information in prose outside the XML. For normal QRSPI stage completion, the final response may be only the fenced `xml` `<qrspi-result>` block; make the XML `<summary>` comprehensive enough for humans.

When resuming implementation, use the runtime node being completed, not a synthetic `resume` stage. Final implementation completion uses `<stage>implement</stage>`, `<status>complete</status>`, `<outcome>complete</outcome>`, and `<next>/q-review [handoff]</next>`. For non-final checkpoints, write a handoff artifact and continue through `/q-resume` in normal chat context; do not emit a completed workflow-node result unless intentionally stopping with `blocked`/`needs_human`.

```xml
<qrspi-result>
  <stage>implement</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <workspace>
[absolute path to the implementation workspace, when known]
  </workspace>
  <workspaceMetadata>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the completed implementation branch]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify]</currentBranch>
  </workspaceMetadata>
  <policy>
    <autoMode>[latest known autoMode]</autoMode>
    <enablePlanReviews>[latest known enablePlanReviews]</enablePlanReviews>
    <invalidResultRetryLimit>[latest known invalidResultRetryLimit or 1]</invalidResultRetryLimit>
  </policy>

  <summary>
    <plan-goal>[Overall plan/workflow goal.]</plan-goal>
    <stage-completed>[Implementation completed and final handoff written.]</stage-completed>
    <key-decisions>[Verification evidence and why implementation review is safe.]</key-decisions>
  </summary>
  <artifact>
[exact path to final implementation-complete handoff.md]
  </artifact>
  <next>
/q-review [exact path to final implementation-complete handoff.md]
  </next>
</qrspi-result>
```

# Resume Pipeline Handoff

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
  <workspaceMetadata>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk, or empty when not applicable]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the just-finished branch/chunk, or empty when not applicable]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify, or current git branch]</currentBranch>
  </workspaceMetadata>
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

`status` is lifecycle. `outcome` selects the graph branch. `<workspaceMetadata>` records branch context for humans and runtime handoff/debugging: `trunkBranch` is usually `main`; `stackBottomBranch` is the lowest Graphite branch above trunk; `parentBranch` is the branch immediately below the chunk of work just completed; `currentBranch` is the branch created/updated for the chunk. Use empty elements when not in a Graphite repo or the value is unknowable. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

You are resuming work within a QRSPI planning pipeline. A previous session created a handoff document with context about where things stand. Your job is to load that context and continue working.

## Process

### 1. Read the handoff

If a path was provided as an argument, read it. If not, ask the user for the path.

The handoff will be at:

```
[plan_dir]/handoffs/YYYY-MM-DD_HH-MM-SS_[stage]-handoff.md
```

### 2. Load context

Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview), then load artifacts based on the stage you're resuming:

| Stage | Load these artifacts |
|-------|---------------------|
| question | `[plan_dir]/AGENTS.md`, existing `questions/*.md`, relevant `context/question/*.md`, `research/*.md`, `design.md`, optional `design-product.md`, `outline.md`, `prds/*` as relevant |
| research | relevant `questions/*.md`, relevant `context/research/*.md` |
| design | `[plan_dir]/AGENTS.md`, `questions/*.md`, `research/*.md`, `adrs/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md` |
| design-product | `[plan_dir]/AGENTS.md`, `questions/*.md`, `research/*.md`, `design.md`, `adrs/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md`, `context/design-product/*.md` |
| outline | `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, optional `design-product.md`, `research/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md`, `context/design-product/*.md`, `context/outline/*.md` |
| plan | `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, optional `design-product.md`, `outline.md`, `research/*.md`, `prds/*`, relevant `context/research/*.md`, `context/design/*.md`, `context/design-product/*.md`, `context/outline/*.md`, `context/plan/*.md` |
| implement | `~/.agents/skills/q-implement/SKILL.md`, `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, optional `design-product.md`, `outline.md`, `plan.md`, `research/*.md`, `prds/*`, relevant `context/design-product/*.md`, `context/plan/*.md`, latest relevant `context/implement/*.md` |

### 3. Continue working

Based on the handoff's **Status** and **Next** sections, continue where the previous session left off.

**Implementation-stage rule:** when resuming an `implement` handoff, stay inside the handoff-driven loop. Complete at most one slice, then create the next implement handoff via `/q-handoff` before stopping. For tracked-edit Graphite slices, implement and verify on the current top branch, run `gt create`/`gt modify` for the slice, then write the handoff on that new/current slice branch and amend it into the same slice so the handoff records final branch metadata. During implementation, the canonical continuation path is always the newly created handoff document, so successful implement responses should point to `/q-resume [new handoff path]` until the final slice hands off to `/q-review`.

**Workspace rule for implementation resumes:** never resume implementation in a `git worktree`. Use the fresh filesystem copy created/repaired by `/q-workspace` and named for the plan directory or ticket slug. If the handoff does not identify an existing implementation workspace, stop and ask the user to run `/q-workspace [plan.md]`; do not create an ad-hoc copy from `/q-resume`. Run `git status --short` in that directory before branch or code changes. The workspace is the isolation boundary; branch creation is repo-specific, not automatic.

- If `status: in_progress` - continue the current stage from where it left off. You are working on the `[stage]` stage.
  - For `stage: implement`, read and follow `~/.agents/skills/q-implement/SKILL.md` before editing. `q-implement` owns implementation branch creation, Graphite commit timing, Conventional Commit subject format, and the QRSPI XML footer requirements.
  - Apply the repository submission model from `q-implement`, `[plan_dir]/AGENTS.md`, and the handoff. In `cn-agents`, use the recorded fresh workspace plus Graphite slice branches and leave final integration to `/cn-agents-merge`.
  - If the next unchecked implementation slice is verification-only (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits), follow `q-implement`'s verification-only/no-branch rule.
- If `status: complete` and `next_stage` is set - the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`; if `next_stage: design-product`, run `/q-design-product`; if `next_stage: review`, run `/q-review`). For `review`, prefer passing the exact implement handoff path you just read. For other stages, pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null - the pipeline is complete. Tell the user.

Apply any **Learnings**, **User Decisions**, and referenced **Context Artifacts** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.

## Response Format

When resuming work produces a user-facing QRSPI completion response, emit only the fenced `xml` `<qrspi-result>` footer described above. Do not duplicate artifact, summary, or next command in prose; encode the primary artifact, comprehensive summary, workspace, workspace branch metadata, and next command in XML. Include `<workspace>` whenever the implementation workspace is known. Include `<workspaceMetadata>` immediately after `<workspace>`; for implementation resumes after Graphite branch creation, populate `trunkBranch`, `stackBottomBranch`, `parentBranch`, and `currentBranch` from the post-commit stack, and otherwise use empty elements for unknown values.

For `implement` resumes, `<artifact>` should normally be the newly created handoff file, not just `plan.md`, because implementation always checkpoints via handoff after each verified slice.

If the handoff indicates the next stage should begin immediately, continue directly rather than stopping to explain the handoff.

During implementation, prefer `/q-resume [new handoff path]` as the next command after each non-final slice. Use `/q-review [handoff path]` only for the final implementation completion handoff.
