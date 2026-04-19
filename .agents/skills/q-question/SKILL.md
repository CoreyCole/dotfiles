---
name: q-question
description: Decompose a ticket or task into neutral research questions for the QRSPI pipeline. Start with a brief creative brainstorm, then interview the lead engineer on desired outcomes, goals, design principles, and tradeoffs before finalizing the questions.
---

# Question — Decompose the Ticket

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the first stage of the QRSPI pipeline. Convert an underspecified request into 3-7 specific, answerable research questions.

## Goal

Establish with ~95% confidence what the user actually wants. Start with a brief creative brainstorm of possible question areas, then run a flexible interview with the lead engineer to surface the desired outcome, goals, design principles, and tradeoffs before locking the research agenda. Do not try to resolve every factual uncertainty in this phase — some questions should be intentionally deferred to research.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - If a plan directory was provided (follow-up pass), load existing artifacts:
     - All files in `[plan_dir]/questions/`
     - `[plan_dir]/design.md`
     - `[plan_dir]/outline.md`
     - All files in `[plan_dir]/research/`
     - All files in `[plan_dir]/prds/`
1. **If a ticket path, plan directory, artifact path, or description was provided**, read it fully and begin.
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

1. **Gather metadata** by running `~/dotfiles/spec_metadata.sh`. Use its `Git Username` and `Timestamp For Filename` output for the plan directory, question filename, and frontmatter fields.

2. **Determine the plan directory**:
   - New work: create `thoughts/[git_username]/plans/[timestamp]_[plan-name]/`
   - Follow-up pass: reuse the existing plan directory exactly

3. **Ensure scaffolding exists**:
   - Copy `AGENTS.md` into plan dir from `~/.agents/skills/qrspi-planning/AGENTS.md` if missing
   - Ensure `[plan_dir]/prds/`, `[plan_dir]/questions/`, `[plan_dir]/research/` exist

4. **Read ticket/PRDs and linked docs fully**.

5. **Populate `prds/` when relevant**:
   - Store relevant PRDs, ticket exports, screenshots under `[plan_dir]/prds/`
   - Prefer descriptive filenames and preserve history

6. **Start with a short creative brainstorm before converging**:
   - Sketch a few plausible question areas, tensions, unknowns, or forks in the road
   - Use the brainstorm to expose hidden assumptions and missing context
   - Keep it short and exploratory — this is for discovering better questions, not proposing solutions

7. **Interview the lead engineer before finalizing questions**:
   - Treat the human in chat as the lead engineer / design owner unless told otherwise
   - Keep the interview structure flexible — do not force a rigid checklist
   - Focus on the desired outcome, goals, design principles, and tradeoffs
   - Ask about important constraints, risks, non-goals, and success criteria when they matter
   - Let the engineer explicitly defer open factual or codebase questions to the research phase when appropriate

   If confidence is below ~95%, continue the interview. Do not guess.

8. **Explore the relevant codebase** — grep related files, read tests, check recent git history. Understand enough to ask strong questions, but do NOT form a solution.

9. **Write a concise `Brainstorm Summary`** that will become the first section of the question doc. Capture the important design context surfaced during the brainstorm and interview:
   - desired outcome
   - explicit design details or constraints already established
   - decisions already made
   - tradeoffs, risks, non-goals, or tensions that research should keep in view

10. **Write 3-7 research questions** to a new timestamped file under `[plan_dir]/questions/`. Questions must be:
   - Specific and independently answerable
   - Neutral
   - Fact-focused

11. **Include Codebase References** section with suggested starting points.

## Output Template

Write to `thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/YYYY-MM-DD_HH-MM-SS_topic-name.md`:

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
question_doc: "thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/YYYY-MM-DD_HH-MM-SS_topic-name.md"
prev_question_docs:
  - "thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/..."
---

# Research Questions: [Ticket Title]

## Brainstorm Summary
- [Validated desired outcome from the brainstorm/interview]
- [Important design details, constraints, or non-goals already established]
- [Decisions already made and tradeoffs to preserve during research]
- [Open tensions intentionally deferred to research]

## Context
[1-3 sentence summary of validated user need. No solution proposal.]

## Questions
1. [Specific question about current behavior, data flow, or architecture]
2. [Question about existing patterns or conventions]
3. [Question about edge cases, constraints, or dependencies]
4. [Question about test coverage or gaps]
...

## Codebase References
- `path/to/relevant/file.ext` — [why it's relevant]
- `path/to/another/file.ext` — [why it's relevant]
```

## Response

When the question doc is written, use this exact response shape:

```
Artifact: [exact path to question doc]
Summary: [brief summary of the questions]
Next: /q-research [exact path to question doc]
```

Always include the complete `thoughts/.../questions/YYYY-MM-DD_HH-MM-SS_topic-name.md` path.

## Rules

- Do NOT include preferred solutions in questions.
- Do NOT propose approaches or pseudocode.
- Always start with a short creative brainstorm before converging on the final questions.
- Always ask the lead engineer before proceeding to write the question doc.
- Keep the interview structure flexible — it is not a fixed questionnaire.
- The question phase should focus on the desired outcome, goals, design principles, and tradeoffs.
- The first section of the question doc must be a concise `Brainstorm Summary` so downstream stages inherit the key design context.
- The `Brainstorm Summary` should capture validated human guidance, not speculative agent solutions.
- Some questions may be intentionally deferred to the research phase.
- Do NOT write the question doc until the lead-engineer interview is complete.
- Treat the user's first request as a hypothesis, not a spec.
- Do NOT skip codebase exploration.
- Keep it short: questions, not essays.
- Use: `Artifact: ...`, `Summary: ...`, `Next: ...` in completion responses.
