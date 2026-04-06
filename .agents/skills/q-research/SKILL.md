---
name: q-research
description: Answer research questions by exploring the codebase with pure facts — no opinions, no solutions. Second stage of QRSPI pipeline.
---

# Research — Answer the Questions

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the second stage of the QRSPI pipeline. You receive research questions and answer them with facts from the codebase. You have NO knowledge of what is being built — only the questions.

## When Invoked

1. **If a plan directory path was provided**, read `[plan_dir]/questions.md` fully and begin.
2. **If no parameters**, respond:

```
I'll research the codebase to answer your questions.

Please provide the plan directory path containing questions.md:
e.g. `/q-research thoughts/[git_username]/plans/2026-03-29_12-26-32_feature-name`
```

Then wait for input.

## Process

1. **Read `[plan_dir]/questions.md` fully.** This is your ONLY input. Do not read the ticket. Do not ask what is being built.

2. **For each question**, spawn parallel sub-agents to research:
   - Use **codebase-locator** to find relevant files
   - Use **codebase-analyzer** to understand implementations
   - Use **codebase-pattern-finder** to find similar patterns and examples

3. **Wait for ALL sub-agents to complete.**

4. **Read the files sub-agents identified** — read them yourself in the main context to verify findings.

5. **Answer each question** with:
   - Concrete facts and code references (`file.ext:line`)
   - Direct quotes from the code where helpful
   - "I could not determine this" if a question isn't answerable from the codebase

6. **Note any surprises** — things that were unexpected or that contradict assumptions in the questions.

7. **Gather metadata** by running `~/dotfiles/spec_metadata.sh` to get the timestamp.

8. **Write findings** to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md` where the topic is a kebab-case summary of what was researched (e.g. `endpoint-routing`, `auth-middleware`, `spline-reticulation`).

## Output Template

Write to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
stage: research
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
- [Constraints or patterns that weren't asked about but are relevant]

## Code References
- `path/to/file.ext:123` — [what's there]
- `path/to/file.ext:45-67` — [what this block does]
```

## Response

When the research doc is written, respond to the user with the exact artifact path and the next command:

```
Research written to [exact path to research doc].

[brief summary of findings and any surprises]

Ready to proceed? Start design with:

/q-design [exact path to plan_dir]

Need more research? Run /q-research again with additional questions.
```

**If the user responds with feedback** (follow-up questions, areas to dig deeper, corrections), ask followup questions if more context would be helpful, do the additional research, update or write a new research doc, then respond again with the same format above. Repeat until the user is satisfied and moves to the next stage.

## Rules

- This is research, not design. Do NOT propose solutions. Do NOT write pseudocode. Just answer the questions.
- Do NOT read the ticket or any document that reveals what is being built. Only read `questions.md`.
- Every claim must have a file:line reference. No hand-waving.
- If a question can't be answered from the codebase, say so clearly — don't speculate.
- Keep answers factual and concise. Code references over prose.
- Multiple research docs are expected. Each invocation produces one file. The user may run `/q-research` multiple times for different topics.
