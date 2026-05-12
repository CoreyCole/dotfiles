---
name: q-resume
description: Resume work within a QRSPI planning pipeline from a handoff document
---

## QRSPI mode contract

- `autoMode=false`: stop at human gates; still emit valid `<qrspi-result>` and show validated advance button.
- `autoMode=true`: continue through human gates automatically unless `needs_human`, `blocked`, `error`, invalid artifact, disallowed transition, run failure, or XML retry exhaustion.
- `enablePlanReviews=true`: run planning `/q-review` after design, outline, and plan.
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

When resuming implementation, intermediate handoffs use `<stage>resume</stage>`, `<status>handoff</status>`, and `<next>/q-resume [handoff]</next>`. Final implementation completion uses `<status>complete</status>` and `<next>/q-review [handoff]</next>`. For stage completion, emit only a fenced `xml` QRSPI footer; do not duplicate Artifact/Summary/Next in prose.

```xml
<qrspi-result>
  <stage>resume</stage>
  <status>[handoff or complete]</status>
  <workspace>
[absolute path to the implementation workspace, when known]
  </workspace>
  <policy>
    <autoMode>[latest known autoMode]</autoMode>
    <enablePlanReviews>[latest known enablePlanReviews]</enablePlanReviews>
    <invalidResultRetryLimit>[latest known invalidResultRetryLimit or 1]</invalidResultRetryLimit>
  </policy>

  <summary>
    <plan-goal>[Overall plan/workflow goal.]</plan-goal>
    <stage-completed>[What this stage/session did; how it moves toward the goal.]</stage-completed>
    <key-decisions>[Direction, tradeoffs, risks, open questions, follow-up, or why next step is safe.]</key-decisions>
  </summary>
  <artifact>
[exact path to handoff.md]
  </artifact>
  <next>
[/q-resume or /q-review] [exact path to handoff.md]
  </next>
</qrspi-result>
```

# Resume Pipeline Handoff

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

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
| implement | `[plan_dir]/AGENTS.md`, `questions/*.md`, `design.md`, optional `design-product.md`, `outline.md`, `plan.md`, `research/*.md`, `prds/*`, relevant `context/design-product/*.md`, `context/plan/*.md`, latest relevant `context/implement/*.md` |

### 3. Continue working

Based on the handoff's **Status** and **Next** sections, continue where the previous session left off.

**Implementation-stage rule:** when resuming an `implement` handoff, stay inside the handoff-driven loop. Complete at most one slice, then create the next implement handoff via `/q-handoff` before stopping. During implementation, the canonical continuation path is always the newly created handoff document, so successful implement responses should point to `/q-resume [new handoff path]` until the final slice hands off to `/q-review`.

**Fresh-directory rule for implementation resumes:** never resume implementation in a `git worktree`. Use the fresh filesystem copy named `[repo-name]_[plan-dir-basename]`, where `[plan-dir-basename]` is the final directory name of the active QRSPI plan directory. If the handoff does not identify an existing fresh implementation directory, create one next to the source checkout before editing: macOS `cp -ac source-dir clean-copy-dir`; Linux `cp -a --reflink=auto source-dir clean-copy-dir`. Run `git status --short` in that directory before branch or code changes. The fresh workspace is the isolation boundary; branch creation is repo-specific, not automatic.

- If `status: in_progress` - continue the current stage from where it left off. You are working on the `[stage]` stage.
  - For `stage: implement`, first apply the repository's submission model from `AGENTS.md`/the handoff. In `cn-agents`, use the recorded fresh workspace plus Graphite slice branches: create a new stacked branch only when the first unchecked slice has planned tracked source/test/doc edits, commit with Graphite, and leave final integration to `/cn-agents-merge`. In other Graphite repos, create a new stacked Graphite branch only when the first unchecked slice has planned tracked source/test/doc edits.
  - Graphite repos only: before editing, compare the first unchecked slice in `plan.md` with `git branch --show-current` / the handoff `branch`. If the current branch is still the previous slice branch and the next slice has planned tracked edits, run `gt create <linear-slug>_slice-N` from that branch before editing.
  - If the next unchecked implementation slice is verification-only (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits), do not create a branch. Run verification in the current implementation workspace/current top branch, mark the slice complete if it passes, and hand off to `/q-review` if implementation is complete. Empty branches do not get PRs.
- If `status: complete` and `next_stage` is set - the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`; if `next_stage: design-product`, run `/q-design-product`; if `next_stage: review`, run `/q-review`). For `review`, prefer passing the exact implement handoff path you just read. For other stages, pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null - the pipeline is complete. Tell the user.

Apply any **Learnings**, **User Decisions**, and referenced **Context Artifacts** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.

## Response Format

When resuming work produces a user-facing QRSPI completion response, emit only the fenced `xml` `<qrspi-result>` footer described above. Do not duplicate artifact, summary, or next command in prose; encode the primary artifact, comprehensive summary, workspace, and next command in XML. Include `<workspace>` whenever the implementation workspace is known.

For `implement` resumes, `<artifact>` should normally be the newly created handoff file, not just `plan.md`, because implementation always checkpoints via handoff after each verified slice.

If the handoff indicates the next stage should begin immediately, continue directly rather than stopping to explain the handoff.

During implementation, prefer `/q-resume [new handoff path]` as the next command after each non-final slice. Use `/q-review [handoff path]` only for the final implementation completion handoff.
