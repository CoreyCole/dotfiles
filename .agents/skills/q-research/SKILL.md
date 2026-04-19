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

2. **Extract the important brainstorm/design context from the relevant question doc(s)** and carry it forward into the top of the research doc.
   - Summarize the key desired outcome, design details, explicit decisions, constraints, and tradeoffs surfaced during `q-question`
   - Preserve human-confirmed context; do not invent new decisions here

3. **Phase 1 — locator wave. For each question, spawn parallel locator sub-agents first**:
   - Always use:
     - codebase-locator
   - When the question explicitly asks about prior decisions, existing research, historical context, or documents in `thoughts/`, also use:
     - thoughts-locator
   - Ask locators for concrete paths, likely entry points, and the smallest useful set of files/documents to inspect next.

4. **Wait for all locator results before continuing**.

5. **Phase 2 — analysis/pattern wave. Use the locator results to drive the next parallel sub-agents**:
   - Use `codebase-analyzer` on the most relevant code files or entry points surfaced by `codebase-locator`.
   - Use `codebase-pattern-finder` to find similar implementations and examples based on what `codebase-locator` surfaced.
   - If `thoughts-locator` found directly relevant documents worth deeper inspection, use `thoughts-analyzer` on those specific documents.
   - Do not send the second-wave agents only the original broad question; give them the concrete files/documents found in phase 1.

6. **Wait for all analysis/pattern results**.

7. **Read identified files yourself** in main context to verify findings.
   - Verify code claims against source files directly.
   - Only read thoughts documents when the question explicitly calls for that context.

8. **Answer each question** with:
   - concrete facts and file:line references
   - direct quotes where helpful
   - `I could not determine this` when not answerable

9. **Note surprises** — unexpected findings or assumptions contradicted by code.

10. **Gather metadata** with `~/dotfiles/spec_metadata.sh`. Use its `Timestamp For Filename` output for the research filename and its other fields for the frontmatter.

11. **Write findings** to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`.

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

## Brainstorm Summary
- [Desired outcome carried forward from the relevant question doc(s)]
- [Important design details, constraints, or non-goals already established]
- [Decisions already made and tradeoffs to preserve during research]
- [Open tensions intentionally deferred to research]

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
- The first section of the research doc must be a concise `Brainstorm Summary` carried forward from `q-question` so downstream stages retain the key design context.
- The `Brainstorm Summary` must preserve validated human decisions and tradeoffs from the question docs; do not invent new decisions in research.
- Do NOT read the ticket, `design.md`, `outline.md`, `prds/`, or other forward-looking documents that reveal what is being built. Only read relevant files in `questions/`, code surfaced during research, and `thoughts/` documents when the question explicitly asks for historical context, prior decisions, or existing documentation.
- Every claim must have a file:line reference.
- If a question can't be answered from code, say so clearly.
- Keep answers factual and concise.
- Multiple research docs are expected; each invocation produces one file.
- Use `Artifact: ...`, `Summary: ...`, `Next: ...` in completion responses.
