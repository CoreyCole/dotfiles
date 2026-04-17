---
name: q-research
description: Answer research questions by exploring the codebase with pure facts — no opinions, no solutions. Second stage of QRSPI pipeline.
---

# Research — Answer the Questions

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the second stage of the QRSPI pipeline. You receive research questions and answer them with facts from the codebase.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - Read all files in `[plan_dir]/questions/`
   - Do NOT load design.md, outline.md, `prds/`, or the ticket.
1. **If a plan directory path or question doc path was provided**, resolve the plan directory from it, read relevant question doc(s) in `[plan_dir]/questions/` fully, and begin.
2. **If no parameters**, respond:

```
I'll research the codebase to answer your questions.

Please provide the plan directory path or question doc path:
e.g. `/q-research thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
or `/q-research thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name/questions/YYYY-MM-DD_HH-MM-SS_topic-name.md`
```

Then wait for input.

## Process

1. **Read relevant question doc(s) in `[plan_dir]/questions/` fully.**
   - If a specific question doc path was provided, treat it as primary.
   - Otherwise prefer the newest timestamped question doc unless user says otherwise.

2. **For each question, spawn parallel sub-agents**:
   - codebase-locator
   - codebase-analyzer
   - codebase-pattern-finder

3. **Wait for all sub-agents**.

4. **Read identified files yourself** in main context to verify findings.

5. **Answer each question** with:
   - concrete facts and file:line references
   - direct quotes where helpful
   - `I could not determine this` when not answerable

6. **Note surprises** — unexpected findings or assumptions contradicted by code.

7. **Gather metadata** with `~/dotfiles/spec_metadata.sh`.

8. **Write findings** to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`.

## Output Template

Write to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: research
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# Research: [Topic Name]

## Answers

### 1. [Restate question]
[Facts with file:line references. No opinions. No proposals.]

### 2. [Restate question]
[Facts with file:line references.]

...

## Surprises
- [Anything unexpected discovered during research]
- [Constraints or patterns not asked about but relevant]

## Code References
- `path/to/file.ext:123` — [what's there]
- `path/to/file.ext:45-67` — [what this block does]
```

## Response

When the research doc is written, use this exact response shape:

```
Artifact: [exact path to research doc]
Summary: [brief summary of findings and any surprises]
Next: /q-design [exact path to research doc]
```

If the user wants more research, tell them to run `/q-research [exact path to plan_dir]` with additional questions.

## Rules

- This is research, not design. No solutions, no pseudocode.
- Do NOT read the ticket or documents that reveal what is being built. Only read relevant files in `questions/`.
- Every claim must have a file:line reference.
- If a question can't be answered from code, say so clearly.
- Keep answers factual and concise.
- Multiple research docs are expected; each invocation produces one file.
- Use `Artifact: ...`, `Summary: ...`, `Next: ...` in completion responses.
