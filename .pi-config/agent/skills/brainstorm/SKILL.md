---
name: brainstorm
description: |
  Free-form ideation that investigates context, clarifies goals, explores approaches,
  validates direction, then routes into QRSPI (`/q-question` or `/q-outline`).
  Use when the user wants open-ended brainstorming before entering the staged workflow.
---

# Brainstorm

A structured brainstorming session for turning a fuzzy request into a clear next step in the QRSPI workflow.

**Announce at start:** "Starting a brainstorming session. Let me investigate first, then we'll work through this step by step."

## Purpose

Use this skill when the user wants exploratory thinking before committing to a staged implementation workflow.

This skill is for:
- understanding the problem
- clarifying the desired outcome
- exploring tradeoffs
- choosing the right QRSPI entry point

This skill is **not** for:
- writing production code
- creating ad hoc execution chains
- bypassing QRSPI for substantial work

## The Flow

```text
Phase 1: Investigate Context
    ↓
Phase 2: Clarify Requirements
    ↓
Phase 3: Explore Approaches
    ↓
Phase 4: Present & Validate Direction
    ↓
Phase 5: Route into QRSPI
```

## STOP — Before Writing Any Code

If you're about to edit or create source files, stop and check:

1. Did you validate the direction with the user?
2. Did you decide whether this should start at `/q-question` or `/q-outline`?

If not, you're cutting corners.

## Phase 1: Investigate Context

Before asking questions, explore what exists with lightweight codebase checks:

```bash
ls -la
find . -type f | head -40
rg "keyword-from-request" .
```

Look for:
- file structure and conventions
- related existing code
- tech stack and dependencies
- existing patterns already in use

After investigating, share a short summary of what you found before moving on.

## Phase 2: Clarify Requirements

Work through requirements one topic at a time.

Focus on:
1. **Purpose** — What problem does this solve? Who is it for?
2. **Scope** — What's in? What's explicitly out?
3. **Constraints** — Performance, compatibility, sequencing, deadlines?
4. **Success criteria** — How will we know the work is done?

Guidelines:
- group related questions
- use `/answer` when you have multiple questions
- prefer multiple choice when it makes answering easier
- do not move on until the request is actually clear

## Phase 3: Explore Approaches

Once requirements are understood, propose 2–3 approaches.

For each approach:
- describe the shape of the solution
- state the tradeoffs clearly
- remove unnecessary complexity
- recommend one and explain why

Keep this conversational and decision-oriented, not like a formal spec.

## Phase 4: Present & Validate Direction

Present the direction in sections and validate it with the user.

Good topics:
- architecture overview
- major components or modules
- data flow
- risks and tradeoffs
- what to defer or explicitly avoid

Do not dump a wall of text. Validate the direction before routing into execution.

## Phase 5: Route into QRSPI

Once the direction is clear, choose the right QRSPI entry point.

### Default: `/q-question`

Use `/q-question` when:
- the request still has ambiguity
- research questions need to be written down explicitly
- the current behavior or constraints need investigation before design
- multiple interpretations are still plausible

### Fast Path: `/q-outline`

Use `/q-outline` when:
- the task is small and straightforward
- the implementation shape is already obvious
- there is little or no product/design ambiguity
- one or two vertical slices should cover the work cleanly

### Tiny Fixes

If the task is truly tiny, you can recommend skipping QRSPI entirely and just implementing it directly.

## Expected Output

End the brainstorming session with:
- a concise summary of the agreed direction
- the recommended next command
- a short reason for that routing choice

Example endings:

```text
Summary: We clarified the goal, narrowed scope, and identified a few open factual questions about the current implementation.
Next: /q-question [ticket-or-description]
```

```text
Summary: The task is straightforward, the implementation shape is already obvious, and we do not need a separate research pass.
Next: /q-outline [task-or-plan-dir]
```

## Rules

- Do not write production code in this skill.
- Do not create ad hoc implementation chains from this skill.
- Do not create todos, feature branches, or commit plans here.
- Use this skill to align on direction, then route into QRSPI.
- Prefer `/q-question` unless the task is clearly a good fit for the `/q-outline` fast path.
- Keep the conversation grounded in the actual codebase, not just abstract ideas.
