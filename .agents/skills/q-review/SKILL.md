---
name: q-review
description: Review a completed QRSPI implementation from an implement handoff or plan dir. Writes the canonical review artifact to `[plan_dir]/reviews/`.
---

# Review — Post-Implementation Code Review

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`
> **Review rubric:** `~/.pi/agent/skills/review-rubric/SKILL.md`

You are the post-implementation review step of the QRSPI pipeline. Review the actual code and verification evidence, not just the plan, and write the canonical review artifact inside the plan directory.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md`
   - Read `~/.pi/agent/skills/review-rubric/SKILL.md`
1. **If an implement handoff path was provided**, read it and resolve `plan_dir` from the frontmatter.
2. **If a plan directory path was provided**, use it and load the newest implement handoff from `[plan_dir]/handoffs/`.
3. **If no parameter was provided**, respond:

```text
I'll review the completed implementation and write the review artifact into the plan directory.

Please provide either:
- the implement handoff path, e.g. `/q-review thoughts/[git_username]/plans/.../handoffs/YYYY-MM-DD_HH-MM-SS_implement-handoff.md`
- or the plan directory path, e.g. `/q-review thoughts/[git_username]/plans/YYYY-MM-DD_HH-MM-SS_plan-name`
```

Then wait for input.

## Canonical Review Artifact Location

Create the review at:

```text
[plan_dir]/reviews/YYYY-MM-DD_HH-MM-SS_[plan-name]_review.md
```

This is the canonical `/q-review` output location.

- Reviews for QRSPI do **not** live in `thoughts/[git_username]/reviews/`
- The review artifact belongs in the specific plan directory under `reviews/`
- Always return the exact path to that file in the final response

## Load Context

After resolving `plan_dir`, load:

- `[plan_dir]/AGENTS.md`
- the implement-complete handoff you were given, or the newest implement handoff in `[plan_dir]/handoffs/`
- `[plan_dir]/plan.md`
- the files explicitly called out by the handoff's **Context Artifacts** and **Next** sections
- the actual changed code you are reviewing

Use `design.md`, `outline.md`, `questions/*.md`, `research/*.md`, and `context/implement/*.md` only as needed to clarify intent. The primary review target is the code plus the implement handoff.

## Optional Parallel Review Lanes

For small, localized changes, review directly in the main session.

For broader changes, you may spawn parallel focused `reviewer` sub-agents to inspect different aspects of the implementation. Typical lanes:
- correctness / regressions
- security / invariants / data integrity
- tests / verification / plan adherence
- maintainability / architecture drift (optional, for larger changes)

When using parallel review lanes:
- set `output: false` on every delegated `reviewer` run to avoid file collisions
- keep each lane narrowly scoped
- treat subagent findings as advisory until you verify them yourself
- write exactly one canonical review artifact from the main session

If a candidate finding is ambiguous, use `codebase-analyzer` to trace the exact path before deciding whether it belongs in the review.

## Process

1. Run `~/dotfiles/spec_metadata.sh` and use it for the review filename timestamp and frontmatter metadata.
2. Read the implement handoff carefully. Use it to understand:
   - what changed
   - which files to inspect first
   - which verification already passed
   - which local companion changes matter
3. Inspect the actual implementation:
   - review the current code in the changed files
   - use `git show`, `git diff`, or `git status` as needed to identify what was introduced
   - read the code before judging it
4. Estimate review scope.
   - If the diff is small and localized, continue directly.
   - If the review spans multiple subsystems, a wider verification surface, or multiple classes of risk, spawn focused parallel `reviewer` lanes and wait for all of them to complete.
5. Verify the candidate findings.
   - Re-read the implicated files yourself.
   - Use `codebase-analyzer` when you need an exact implementation trace.
   - Discard speculative or duplicate findings.
6. Re-run the relevant verification commands when practical. Do not claim a check passed unless you ran it or the handoff clearly marks it as prior evidence.
7. Apply the review rubric:
   - flag only real, actionable issues introduced by the implementation
   - keep findings concise, specific, and evidence-based
   - prefer a short review over invented findings
8. If the review surfaces durable learnings that future agents should remember first, update `[plan_dir]/AGENTS.md`.
9. Write the review artifact to `[plan_dir]/reviews/`.

## Review Template

Use this structure:

```markdown
---
date: [ISO datetime with timezone]
reviewer: [your name]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
implementation_reviewed: [exact implement handoff path]
plan_dir: [exact plan dir path]
status: complete
type: implementation_review
verdict: [correct|needs_attention]
---

# Implementation Review: [plan name]

### Summary
[Short overall assessment.]

### Findings
[Numbered findings with priority tags and file references. If none, say the code looks good.]

### What's Good
[Short list of strengths worth preserving.]

### Verification
[List the commands you ran and the outcome.]

### Recommended Next Steps
[Concrete follow-up actions. If there are no findings, say the implementation is ready.]
```

## Response Format

End with this exact three-line shape:

If the verdict is `correct`:

```text
Artifact: [exact path to review file]
Summary: review complete. verdict: correct.
Next: pipeline complete
```

If the verdict is `needs_attention`:

```text
Artifact: [exact path to review file]
Summary: review complete. verdict: needs attention.
Next: address findings, then /q-review [same handoff path or plan dir path]
```

Do not abbreviate paths.

## Rules

- Write exactly one canonical review artifact in `[plan_dir]/reviews/`.
- Subagent review lanes are optional and advisory; the main session owns synthesis and final judgment.
- Always verify high-signal findings yourself before including them.
- Prefer a short accurate review over a long speculative one.
