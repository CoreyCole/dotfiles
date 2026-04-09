---
name: q-question
description: Decompose a ticket or task into neutral research questions for the QRSPI pipeline. Use at the start of any non-trivial coding task.
---

# Question — Decompose the Ticket

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the first stage of the QRSPI pipeline. Your job is to turn a vague ticket into 3-7 specific, answerable research questions — and nothing more.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - If a plan directory was provided (2nd pass), load any existing artifacts:
     - `[plan_dir]/questions.md`
     - `[plan_dir]/design.md`
     - `[plan_dir]/outline.md`
     - All files in `[plan_dir]/research/`
1. **If a ticket path, plan directory, or description was provided**, read it fully and begin.
2. **If no parameters**, respond:

```
I'll help decompose a ticket into research questions.

Please provide:
1. The ticket, issue, or feature description (or a file path to one)
2. Any additional context

Tip: `/q-question thoughts/shared/tickets/ENG-1234.md`
2nd pass: `/q-question thoughts/[git_username]/plans/[timestamp]_[plan-name]`
```

Then wait for input.

## Process

1. **Gather metadata** by running `~/dotfiles/spec_metadata.sh`.

2. **Create a new plan directory**:
   ```
   thoughts/[git_username]/plans/[timestamp]_[plan-name]/
   ```
   Always create a new directory, even on a 2nd pass. If revisiting an existing plan, use the same `[plan-name]` with a fresh timestamp. The old plan directory stays intact as history.

3. **Copy `AGENTS.md` into the plan directory** from `~/.agents/skills/qrspi-planning/AGENTS.md`. This orients any agent that lands in the directory later.

4. **Read the ticket** and any linked documents fully. If this is a 2nd pass from an existing plan directory, the prior artifacts loaded in step 0 are your context instead of a ticket.

5. **Explore the relevant codebase** — grep for related files, read existing tests, check git log for recent changes in the area. Understand enough to ask good questions, but do NOT form a solution.

6. **Write 3-7 research questions** to `[plan_dir]/questions.md`. Each question must be:
   - Specific and independently answerable
   - Neutral — no preferred solution embedded
   - Focused on facts about the codebase, not opinions

7. **Include a Codebase References section** listing files and areas the researcher should start from.

## Output Template

Write to `thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: question
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
prev_plan_dir: "[path to previous plan directory, if 2nd pass]"
---

# Research Questions: [Ticket Title]

## Context
[1-3 sentence summary of the ticket/task — what is being asked, not how to solve it]

## Questions
1. [Specific question about current behavior, data flow, or architecture]
2. [Question about existing patterns or conventions in the area]
3. [Question about edge cases, constraints, or dependencies]
4. [Question about test coverage or gaps]
...

## Codebase References
- `path/to/relevant/file.ext` — [why it's relevant]
- `path/to/another/file.ext` — [why it's relevant]
```

## Response

When questions.md is written, respond to the user with the **full file path** (not just the directory) and the next command:

```
Questions written to thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions.md

[brief summary of the questions]

Ready to proceed? Start research with:

/q-research thoughts/[git_username]/plans/[timestamp]_[plan-name]
```

Always include the complete `thoughts/.../questions.md` path. Never abbreviate to just the directory.

**If the user responds with feedback** (additions, corrections, missing areas), ask followup questions if more context would be helpful, update questions.md accordingly, then respond again with the same format above. Repeat until the user is satisfied and moves to the next stage.

## Rules

- Do NOT include your preferred solution in the questions. Frame neutrally so research is unbiased.
- Do NOT propose approaches or write pseudocode.
- Do NOT skip codebase exploration — the quality of your questions determines the quality of all downstream stages.
- Keep this document short. Questions, not essays.
