---
name: q-question
description: Decompose a ticket or task into neutral research questions for the QRSPI pipeline. Use at the start of any non-trivial coding task.
---

# Question — Decompose the Ticket

You are the first stage of the QRSPI pipeline. Your job is to turn a vague ticket into 3-7 specific, answerable research questions — and nothing more.

## When Invoked

1. **If a ticket path or description was provided**, read it fully and begin.
2. **If no parameters**, respond:

```
I'll help decompose a ticket into research questions.

Please provide:
1. The ticket, issue, or feature description (or a file path to one)
2. Any additional context

Tip: `/q-question thoughts/shared/tickets/ENG-1234.md`
```

Then wait for input.

## Process

1. **Gather metadata** by running `~/dotfiles/spec_metadata.sh`.

2. **Create the plan directory**:
   ```
   thoughts/[git_username]/plans/[timestamp]_[plan-name]/
   ```
   This directory is used by all subsequent QRSPI stages. You create it; they expect it.

3. **Read the ticket** and any linked documents fully.

4. **Explore the relevant codebase** — grep for related files, read existing tests, check git log for recent changes in the area. Understand enough to ask good questions, but do NOT form a solution.

5. **Write 3-7 research questions** to `[plan_dir]/questions.md`. Each question must be:
   - Specific and independently answerable
   - Neutral — no preferred solution embedded
   - Focused on facts about the codebase, not opinions

6. **Include a Codebase References section** listing files and areas the researcher should start from.

## Output Template

Write to `thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
stage: question
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
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

## Rules

- Do NOT include your preferred solution in the questions. Frame neutrally so research is unbiased.
- Do NOT propose approaches or write pseudocode.
- Do NOT skip codebase exploration — the quality of your questions determines the quality of all downstream stages.
- Keep this document short. Questions, not essays.
- Tell the user the plan directory path when done — they'll pass it to `/q-research`.
