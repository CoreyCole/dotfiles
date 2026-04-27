---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when the user says "grill me", wants to stress-test a plan, defend a design, pressure-test tradeoffs, or be interviewed one question at a time.
---

# Grill Me

Stress-test a plan or design through a rigorous one-question-at-a-time interview until the decision tree is understood and resolved.

## Operating Mode

Be constructively adversarial and collaborative:

- Treat the user as the design owner.
- Drive toward shared understanding, not winning an argument.
- Walk the design tree branch by branch.
- Resolve upstream decisions before downstream decisions.
- Keep asking until the important dependencies, risks, constraints, and tradeoffs are explicit.

## Process

1. **Load the plan or design context.**
   - If the user provided a file, read it fully.
   - If the user described the plan inline, restate the core proposal in 2-4 bullets.
   - If the scope is unclear, ask for the missing artifact or description first.

2. **Explore before asking.**
   - If a question can be answered by inspecting the codebase, docs, config, tests, history, or existing patterns, investigate instead of asking the user.
   - Use lightweight discovery first (`rg`, `find`, `ls`, targeted reads).
   - Summarize the relevant facts you found before asking the next human-judgment question.

3. **Map the decision tree.**
   - Identify the major decision branches: goals, scope, users, constraints, architecture, data model, interfaces, rollout, observability, failure modes, tests, and non-goals.
   - Do not dump the whole tree at once; use it to choose the next best question.

4. **Ask one question at a time.**
   - Each turn should contain exactly one direct question unless the user explicitly asks for a batch.
   - For every question, include your recommended answer and concise reasoning.
   - Phrase the question so the user can answer by confirming, rejecting, or adjusting the recommendation.

5. **Resolve dependencies between decisions.**
   - If an answer changes an upstream premise, revisit dependent branches.
   - Do not move to implementation details before goals, constraints, and success criteria are clear.
   - Do not accept vague answers when they hide meaningful tradeoffs.

6. **Track decisions as you go.**
   - Maintain a concise running summary in the conversation:
     - decisions confirmed
     - assumptions still unverified
     - questions deferred to codebase research
     - open risks or tradeoffs

7. **Exit only when shared understanding is reached.**
   - Stop when the plan/design has clear goals, scope, constraints, decision rationale, open risks, and next steps.
   - If the discussion should enter QRSPI, recommend the next stage:
     - `/q-question` when research questions remain
     - `/q-outline` when the implementation shape is already clear
     - direct implementation only for tiny fixes

## Question Format

Use this format for each interview turn:

```text
Decision branch: [short branch name]
What I found: [only if you investigated code/docs first]
Recommendation: [your recommended answer and why]
Question: [one direct question for the user]
```

## Good Questions

- "Recommendation: keep this out of scope because it changes the rollout risk. Question: should we explicitly defer multi-tenant migration support from this plan?"
- "Recommendation: use the existing repository pattern because three adjacent services already do. Question: do you want this design constrained to that pattern, or are you intentionally changing it?"
- "Recommendation: require a rollback path because this touches persistent state. Question: should rollback be a first-class requirement for this design?"

## Rules

- Ask one question at a time.
- Provide a recommended answer for each human-judgment question.
- Investigate codebase-answerable questions yourself instead of asking the user.
- Do not write code while grilling.
- Do not create a plan, spec, or QRSPI artifact unless the user asks or the interview has concluded and they confirm the next step.
- Do not ask performative questions whose answers are obvious from the repo.
- Be persistent but not hostile.
