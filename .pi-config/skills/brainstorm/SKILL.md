---
name: brainstorm
description: |
  Structured brainstorming that always follows the full execution chain:
  investigate → clarify → explore → validate design → write plan → create todos
  → create feature branch → execute with subagents. No shortcuts.
---

# Brainstorm

A structured brainstorming session for turning ideas into validated designs and executed code.

**Announce at start:** "Starting a brainstorming session. Let me investigate first, then we'll work through this step by step."

---

## MANDATORY: No Skipping Without Permission

**You MUST follow all phases.** Your judgment that something is "simple" or "straightforward" is NOT sufficient to skip steps.

The ONLY exception: The user explicitly says something like:
- "Skip the plan, just implement it"
- "Just do it quickly"
- "No need for the full process"

If the user hasn't said this, you follow the full flow. Period.

**Why this matters:** You will be tempted to rationalize. You'll think "this is just a small form" or "this is obvious, no plan needed." That's exactly when the process matters most — consistency builds trust, and "small" changes have a way of growing.

---

## The Flow

```
Phase 1: Investigate Context
    ↓
Phase 2: Clarify Requirements
    ↓
Phase 3: Explore Approaches
    ↓
Phase 4: Present & Validate Design
    ↓
Phase 5: Write Plan
    ↓
Phase 6: Create Todos
    ↓
Phase 6.5: Create Feature Branch
    ↓
Phase 7: Execute with Subagents (scout first → workers → polished commits)
    ↓
Phase 8: Review
```

---

## STOP — Before Writing Any Code

If you're about to edit or create source files, STOP and check:

1. Did you complete Phase 4 (design validation)?
2. Did you write a plan to `~/.pi/history/<project>/plans/`?
3. Did you create todos?

If any answer is NO and the user didn't explicitly skip → you're cutting corners. Go back.

---

## Phase 1: Investigate Context

Before asking questions, explore what exists:

```bash
# Get the lay of the land
ls -la
find . -type f -name "*.ts" | head -20  # or relevant extension
cat package.json 2>/dev/null | head -30  # or equivalent
```

**Look for:**
- File structure and conventions
- Related existing code
- Tech stack, dependencies
- Patterns already in use

**Why?** Come prepared with informed questions. If 30 seconds of snooping could answer it, don't ask.

**After investigating, share what you found:**
> "Here's what I see in the codebase: [brief summary]. Now let me understand what you're looking to build."

---

## Phase 2: Clarify Requirements

Work through requirements **one topic at a time**:

### Topics to Cover

1. **Purpose** — What problem does this solve? Who's it for?
2. **Scope** — What's in? What's explicitly out?
3. **Constraints** — Performance, compatibility, timeline?
4. **Success criteria** — How do we know it's done?

### How to Ask

- Group related questions, use `/answer` for multiple questions
- Prefer multiple choice when possible (easier to answer)
- Don't overwhelm — if you have many questions, batch them logically

```
[After listing your questions]
execute_command(command="/answer", reason="Opening Q&A for requirements")
```

### Keep Going Until Clear

After each round of answers, either:
- Ask follow-up questions if something is still unclear
- Summarize your understanding and confirm: "So we're building X that does Y for Z. Right?"

**Don't move to Phase 3 until requirements are clear.**

---

## Phase 3: Explore Approaches

Once requirements are understood, propose 2-3 approaches:

> "A few ways we could approach this:
>
> 1. **Simple approach** — [description].
>    - Pros: fast, easy
>    - Cons: less flexible
>
> 2. **Flexible approach** — [description].
>    - Pros: extensible
>    - Cons: more setup
>
> 3. **Hybrid** — [description].
>    - Pros: balanced
>    - Cons: moderate complexity
>
> I'd lean toward #2 because [reason]. What do you think?"

### Key Principles

- **Lead with your recommendation** — don't make them guess
- **Be explicit about tradeoffs** — every choice has costs
- **YAGNI ruthlessly** — remove unnecessary complexity from all options
- **Ask for their take** — they might have context you don't

### After Alignment

Once they've chosen (or you've agreed on) an approach:
> "Got it, we'll go with [approach]. Let me walk you through the design."

---

## Phase 4: Present & Validate Design

Present the design **in sections**, validating each before moving on.

### Why Sectioned?

- A wall of text gets skimmed; sections get read
- Catches misalignment early
- Easier to course-correct than rewrite

### Section by Section

**Keep each section to 200-300 words.**

#### Section 1: Architecture Overview
Present high-level structure, then ask:
> "Does this architecture make sense for what we're building?"

#### Section 2: Components / Modules
Break down the pieces, then ask:
> "These are the main components. Anything missing or unnecessary?"

#### Section 3: Data Flow
How data moves through the system, then ask:
> "Does this flow make sense?"

#### Section 4: Error Handling & Edge Cases
How we handle failures, then ask:
> "Any edge cases I'm missing?"

#### Section 5: Testing Approach
How we'll verify it works, then ask:
> "Does this testing approach give you confidence?"

**Not every project needs all sections** — use judgment based on complexity.

### Incorporating Feedback

If they suggest changes:
1. Acknowledge the feedback
2. Update your understanding
3. Re-present that section if needed
4. Continue to next section

---

## Phase 5: Write Plan

Once the design is validated:

> "Design is solid. Let me write up the plan."

Create the plan in both locations:
- `~/.pi/history/<project>/plans/YYYY-MM-DD-[plan-name].md`
- `~/dotfiles/thoughts/CoreyCole/plans/YYYY-MM-DD_HH-MM-SS_<project>_[plan-name].md`

> `<project>` = basename of the current working directory

### Write the Full Plan

By this point, the design has been explored, validated, and refined through Phases 2–4. **Don't re-ask for approval on every section** — just write the complete plan and present it.

```markdown
# [Plan Name]

**Date:** YYYY-MM-DD
**Status:** Draft
**Directory:** /path/to/project

## Overview

[What we're building and why — 2-3 sentences]

## Goals

- Goal 1
- Goal 2
- Goal 3

## Approach

[High-level technical approach]

### Key Decisions

- Decision 1: [choice] — because [reason]
- Decision 2: [choice] — because [reason]

### Architecture

[Structure, components, how pieces fit together]

## Dependencies

- Libraries needed
- Tools required

## Risks & Open Questions

- Risk 1
- Open question 1
```

After writing, briefly confirm:
> "Plan is written. Ready to create the todos, or anything you want to adjust?"

---

## Phase 6: Create Todos

After the plan is verified, break it into todos.

### Make Todos Bite-Sized

Each todo = **one focused action** (2-5 minutes).

Bad: "Implement authentication system"

Good:
- "Create `src/auth/types.ts` with User and Session types"
- "Write failing test for `validateToken` function"
- "Implement `validateToken` to make test pass"
- "Add token extraction from Authorization header"
- "Commit: 'Add JWT token validation'"

### Why Granular?

- Easier to track progress
- Clearer handoff to sub-agents
- Smaller commits, easier to review/revert
- Each todo completable in one focused session

### Creating Todos

```
todo(action: "create", title: "Task 1: [description]", tags: ["plan-name"], body: "...")
```

**Todo body includes:**
```markdown
Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-plan-name.md

## Task
[What needs to be done]

## Files
- path/to/file.ts (create)
- path/to/other.ts (modify)

## Details
[Specific implementation notes]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Depends On
- Task X must be complete first (if applicable)
```

---

## Phase 6.5: Create Feature Branch

**Always create a feature branch before executing.** Never work directly on `main`.

```bash
# Create and switch to a feature branch
git checkout -b feat/<short-descriptive-name>
```

Branch naming:
- `feat/<name>` for features
- `fix/<name>` for bug fixes
- `refactor/<name>` for refactors

Keep the name short and descriptive (e.g., `feat/jwt-auth`, `fix/null-response`, `refactor/date-utils`).

---

## Phase 7: Execute with Subagents

**Always start with a scout, then run workers sequentially.** The scout gathers context about all relevant files upfront so workers spend less time on discovery and more time on implementation.

### The Pattern

1. **Run scout first** — gathers context about all files relevant to the plan, writes `context.md`
2. **Run worker for each todo** — one at a time, each referencing the scout's context
3. **Check results** — verify files were created/modified correctly
4. **Handle failures** — if a worker fails, diagnose and retry or fix manually
5. **Run reviewer last** — only after all todos are complete

### Why Scout First?

Workers are expensive. Every minute a worker spends grepping and reading files to orient itself is wasted. The scout (codex-mini-latest) is fast and cheap — it maps out the codebase, identifies key files, notes patterns and conventions, and hands that context to each worker. Workers still do their own targeted discovery (reading specific functions, checking types), but they start with a strong baseline instead of from scratch.

### Example

```typescript
// Step 1: Scout gathers context for the entire plan
{ agent: "scout", task: "Gather context for implementing [feature]. Key areas: [list from plan]. Read the plan at ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md and identify all files that will be created or modified. Map out existing patterns, types, imports, and conventions that workers will need." }

// Step 2: Workers execute todos sequentially — each gets the scout's context
{ agent: "worker", task: "Implement TODO-xxxx. Use the commit skill to write a polished, descriptive commit message. Mark the todo as done. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md\n\nScout context (use as your starting baseline — you can still look around but this covers the key files):\n{read context.md from .pi/context.md}" }

// After all todos complete, review the feature branch against main
{ agent: "reviewer", task: "Review the feature branch against main. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md" }
```

### Handling Reviewer Findings

When the reviewer returns with issues, **act on the important ones**:

1. **Triage the findings:**
   - **P0 (Drop everything)** — Must fix now: real bugs, security holes, data loss — provable, not hypothetical
   - **P1 (Foot gun)** — Should fix: genuine traps that will bite someone, real maintenance dangers
   - **P2 (Worth mentioning)** — Fix if quick, otherwise note for later
   - **P3 (Almost irrelevant)** — Skip. Don't waste time on these.

2. **Create todos for P1s and important P2s:**
   ```typescript
   todo({ action: "create", title: "Fix: [issue from reviewer]", body: "..." })
   ```

3. **Kick off workers to fix them:**
   ```typescript
   { agent: "worker", task: "Fix TODO-xxxx (from review). Use the commit skill to write a polished, descriptive commit message. Mark the todo as done. Plan: ~/.pi/history/<project>/plans/..." }
   ```

4. **Don't re-review minor fixes** — only run reviewer again if fixes were substantial

---

### MANDATORY: Always Run Reviewer

**After all workers complete, you MUST run the reviewer.** No exceptions. Don't get distracted by worker output or results — the workflow is not complete until the reviewer has run.

```typescript
// This is NOT optional. Always end with:
{ agent: "reviewer", task: "Review the feature branch against main. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md" }
```

### Why Not Chains?

- Chains fail silently or cryptically when any step errors
- No opportunity to inspect intermediate results
- Can't adapt if something goes wrong
- Manual sequential calls give you control and visibility

### Avoid Parallel Workers in Git Repos

**Do NOT use parallel workers when they share a git repository.**

Even if todos are "independent" (different files), workers that commit to the same repo will conflict:
- Worker A commits → succeeds
- Worker B tries to commit → fails (repo state changed)
- Worker C tries to commit → fails

**The fix: Always run workers sequentially.** It's slightly slower but reliable.

**When parallel IS safe:**
- Workers operate on completely separate git repos
- Workers don't commit (rare — most workers should commit their work)
- Read-only tasks (e.g., multiple scouts gathering info)

### Alternative: Same Session

If the user prefers hands-on work:

> "Would you rather I work through these myself while you review?"

Then work through todos sequentially:
1. Claim the todo
2. Implement
3. Verify
4. Commit using the `commit` skill (polished, descriptive message)
5. Close the todo
6. Move to next

### STOP — Before Reporting Completion

Check:
1. All worker todos are closed?
2. **Every completed todo has a polished commit** (using the `commit` skill)?
3. **Reviewer has run?** ← If no, run it now
4. Reviewer findings triaged and addressed?

**Do NOT tell the user the work is done until all four are true.**

**Do NOT squash merge or merge the feature branch into main.** The feature branch stays as-is with its individual, well-crafted commits.

---

## Commit Strategy

**Do NOT squash merge or merge feature branches back into main.** Every completed todo gets its own polished, descriptive commit on the feature branch using the `commit` skill — always, no exceptions.

### What Makes a Good Commit

Each commit should tell the story of what changed and why. Load the `commit` skill every time. A reader of `git log` should be able to understand the change without looking at the diff.

- **Subject line:** Conventional Commits format, <= 72 chars
- **Body:** Describe what was done, why, and any key decisions. Be thorough and descriptive — not just "implement X" but explain the approach, the rationale, and notable details.

Example:
```
feat(auth): add JWT token validation with RS256 signature verification

Implement token validation against RS256 public keys with configurable
expiry windows. Tokens are parsed and verified in a single pass to avoid
double-deserialization. Invalid tokens return structured error responses
with specific failure reasons (expired, malformed, bad signature) to aid
client-side debugging. Expiry tolerance is set to 30s by default to
account for clock skew between services.
```

---

## Working with Todos During Implementation

### Claiming
```
todo(action: "claim", id: "TODO-xxxx")
```
Claim when you start working. Don't claim if sub-agents will pick it up.

### Progress Notes
```
todo(action: "append", id: "TODO-xxxx", body: "Implemented the validation logic...")
```

### Closing
```
todo(action: "update", id: "TODO-xxxx", status: "closed")
```

### Viewing
- `/todos` — visual todo manager
- `todo(action: "list")` — open and assigned
- `todo(action: "get", id: "TODO-xxxx")` — full details

---

## Tips for Good Brainstorming

### Don't Rush Big Problems

Not everything fits in one brainstorming session. When the scope is large — a full product, a multi-system feature, a complex architecture — **slow down and propose splitting the conversation**.

Signs it's too big for one pass:
- Multiple independent subsystems or domains
- More than ~10 todos would come out of it
- Tradeoffs that deserve dedicated discussion (e.g., data model, auth strategy, API design)
- Something that would take more than a day or two to build

**What to do:** Suggest breaking into focused sub-sessions. Each sub-topic gets focused, deep discussion, then synthesize everything into a unified plan.

### Read the Room
- If they have a clear vision → validate rather than over-question
- If they're eager to start → move faster through phases (but still hit all phases)
- If they're uncertain → spend more time exploring

### Stay Conversational
- This is a dialogue, not an interrogation
- Phases can be quick depending on complexity, but don't skip them
- Don't be robotic about following steps

### Be Opinionated
- Share your perspective, don't just ask questions
- "I'd suggest X because Y" is more helpful than "What do you want?"
- It's okay to push back if something seems off

### Keep It Focused
- One topic at a time
- Don't let scope creep in during brainstorming
- Parking lot items for later: "Good thought — let's note that for v2"
