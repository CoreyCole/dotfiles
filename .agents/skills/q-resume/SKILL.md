---
name: q-resume
description: Resume work within a QRSPI planning pipeline from a handoff document
---

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

**Fresh-directory rule for implementation resumes:** never resume implementation in a `git worktree`. Use the fresh filesystem copy named for the plan directory or ticket slug. If the handoff does not identify an existing fresh implementation directory, create one next to the source checkout before editing: macOS `cp -ac source-dir clean-copy-dir`; Linux `cp -a --reflink=auto source-dir clean-copy-dir`. Run `git status --short` in that directory before branch or code changes.

- If `status: in_progress` - continue the current stage from where it left off. You are working on the `[stage]` stage.
  - For `stage: implement`, create a new stacked Graphite branch only when the first unchecked slice has planned tracked source/test/doc edits. Before editing, compare the first unchecked slice in `plan.md` with `git branch --show-current` / the handoff `branch`. If the current branch is still the previous slice branch and the next slice has planned tracked edits, run `gt create <linear-slug>_slice-N` from that branch before editing.
  - If the next unchecked implementation slice is verification-only (`Files: no additional source files expected`, final validation, grep/build-only, or no planned edits), do not create a branch. Run verification on the current top implementation branch, mark the slice complete if it passes, and hand off to `/q-review` if implementation is complete. Empty branches do not get PRs.
- If `status: complete` and `next_stage` is set - the previous stage is done. Start the next stage by running the corresponding `/q-*` skill (e.g. if `next_stage: design`, run `/q-design`; if `next_stage: design-product`, run `/q-design-product`; if `next_stage: review`, run `/q-review`). For `review`, prefer passing the exact implement handoff path you just read. For other stages, pass the `plan_dir` from the handoff frontmatter.
- If `status: complete` and `next_stage` is null - the pipeline is complete. Tell the user.

Apply any **Learnings**, **User Decisions**, and referenced **Context Artifacts** from the handoff as you work.

Do not present an analysis or ask for confirmation. Just continue working.

## Response Format

When resuming work produces a user-facing completion response, use the same three-line shape:

For `implement` resumes, the `Artifact:` should normally be the newly created handoff file, not just `plan.md`, because implementation always checkpoints via handoff after each verified slice.

```text
Artifact: [exact path to the primary artifact file that was created or updated]
Summary: [brief result]
Next: [next command, or `pipeline complete`]
```

If the handoff indicates the next stage should begin immediately, continue directly rather than stopping to explain the handoff.

During implementation, prefer `/q-resume [new handoff path]` as the next command after each non-final slice. Use `/q-review [handoff path]` only for the final implementation completion handoff.
