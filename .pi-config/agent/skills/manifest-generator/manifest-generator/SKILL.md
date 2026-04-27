---
name: manifest-generator
version: 1.0.0
description: |
  Turns a free-form project description into PROJECT_MANIFEST.md and
  SOFTWARE_FACTORY_MANIFEST.md for a 6-agent software factory pipeline.
  Agent-agnostic: works in Claude Code, Codex CLI, Gemini CLI.
allowed-tools:
  - Write
  - Read
  - AskUserQuestion
---

# ManifestGenerator

Given a project description, produce two files in the current directory:

1. `PROJECT_MANIFEST.md` — structured project context every factory agent reads
2. `SOFTWARE_FACTORY_MANIFEST.md` — the 6-agent SDLC pipeline blueprint

Execute each phase in order. Do not skip phases. Do not proceed past a STOP until
you have the required input.

---

## FILE_WRITE_GUARD

Call this procedure before writing either output file. Substitute the actual filename.

    FILE_WRITE_GUARD(filename):
      Check if filename exists in the current directory (use Read tool).
      If it exists:
        Ask the user: "filename already exists. Overwrite, rename to filename.bak, or abort?"
        Overwrite → proceed.
        Rename → rename the existing file to filename.bak, then proceed.
        Abort → stop execution entirely.
      If it does not exist → proceed to write.

---

## Phase 0: Resume Detection

Before anything else, check for existing output files (use Read tool — expect a
"file not found" error if they don't exist, which is the normal case):

1. Does `PROJECT_MANIFEST.md` exist in the current directory?
2. Does `SOFTWARE_FACTORY_MANIFEST.md` exist in the current directory?

**Both missing:** Proceed to Phase 1.

**PROJECT_MANIFEST.md exists, SOFTWARE_FACTORY_MANIFEST.md does NOT:**
Read `PROJECT_MANIFEST.md` into context. Skip Phases 1–5.
Tell the user: "Found existing PROJECT_MANIFEST.md — skipping to factory manifest generation."
Jump to Phase 6.

**Both exist:**
Ask the user: "Both output files already exist. Regenerate from scratch, or abort?"
Regenerate → proceed to Phase 1 (FILE_WRITE_GUARD will handle overwrites).
Abort → stop.

---

## Phase 1: Accept Input

**Runtime detection probe:** Attempt to call AskUserQuestion with the question below.
If it succeeds → **interactive mode**: use AskUserQuestion one-at-a-time for all
remaining phases. If it fails (tool not found) → **text mode**: for all remaining
phases, print pending questions as a numbered list, wait for the user to answer,
then continue.

**Input check (first question / probe):**

Check the user's current message or invocation arguments:

- Contains a **file path** (e.g., `PROJECT_OVERVIEW.md`): use the Read tool to read it.
  - File not found → tell the user, ask them to paste the description directly. STOP.
  - File found but appears non-text (JSON, binary, package.json, etc.) → tell the user
    "That file doesn't look like a project description." Ask for inline text. STOP.
  - File found and text → use it as the description.
- Contains a **project description** (multiple sentences about what's being built): use it.
- Neither → ask: "Paste your project description, or describe what you're building.
  Include what it does, who uses it, the tech stack if chosen, and any constraints."

STOP. Do not proceed until a description is in context.

---

## Phase 2: Extraction

Map the description against the 11 PROJECT_MANIFEST sections. For each, assign:

- **EXTRACTED** — specific, project-named content present (real technology names, actual
  user roles, concrete constraints, named entities)
- **PARTIAL** — some content present but incomplete or vague
- **MISSING** — no relevant content found

Use the WORKED EXAMPLE (at the bottom of this file, between the HTML comment markers)
to calibrate what "EXTRACTED" looks like per section. **Do not use example content as output.**

**Always-ask sections** — ask if PARTIAL or MISSING, never default:

    Section 1: Overview
    Section 2: Tech Stack
    Section 4: Domain Model  ← most important; never generate a default
    Section 6: Constraints
    Section 9: Success Criteria

**Defaultable sections** — generate from context if MISSING, with label:

    Section 3: Project Structure
      → infer from tech stack
      → label: (proposed — update when scaffolded)

    Section 5: Conventions
      → infer from tech stack (e.g. Node.js → kebab-case files, *.test.ts,
        conventional commits; Python → snake_case, test_*.py, etc.)
      → label: (default — update when scaffolded)

    Section 7: Task Inputs
      → derive from Domain Model + fixed pipeline sequence
      → label: (pipeline-critical — verify before running factory)
      → note: weak Domain Model = weak Task Inputs; this breaks pipeline sequencing

    Section 8: Services to Connect
      → empty table if not mentioned

    Section 10: Review Standards
      → generic rules appropriate to the detected tech stack
      → label: (default — customize for this project)

    Section 11: Release Criteria
      → generic checklist appropriate to the project type
      → label: (default — customize for this project)

After mapping, identify which always-ask sections are PARTIAL or MISSING.
Proceed to Phase 3.

---

## Phase 3: Gap-Fill

For each always-ask section that is PARTIAL or MISSING, ask one targeted question.
Ask in this order: Overview → Tech Stack → Domain Model → Constraints → Success Criteria.

**Interactive mode:** AskUserQuestion, one question per call. Wait for answer before
asking the next.

**Text mode:** Print all pending questions as a numbered list. Wait for the user to
answer all before continuing.

Never ask about a section that is already EXTRACTED.

**Domain Model special rule:** If the Domain Model answer contains no entity names
(a single vague sentence like "it manages data" or "it has users"), ask one follow-up:
"Can you name the core data entities? For example: Order, Customer, Staff — the main
'things' your system tracks and stores."
Accept the second answer regardless. If still no entity names, mark FILLED but add
label `(weak — strengthen Section 4 before running factory)`.

STOP. Do not proceed until all always-ask sections are FILLED.

---

## Phase 4: Validate

Check all 11 sections. A section is still a **placeholder** if it:
- Is empty
- Contains unedited template text (e.g., `[Core entities, their fields...]`)
- Contains only generic content applicable to any project

For any defaultable section still a placeholder: generate a reasonable default
and label it `(generated — verify before use)`.

For any always-ask section still a placeholder: this should not happen (Phase 3
should have caught it). If it somehow did, ask one targeted question now.

Proceed to Phase 5.

---

## Phase 5: Write PROJECT_MANIFEST.md

Call FILE_WRITE_GUARD("PROJECT_MANIFEST.md").

Write `PROJECT_MANIFEST.md` to the current directory using the Write tool.
Use the PROJECT_MANIFEST template defined in the Schema section below.
Fill every section. No section may remain empty or contain template placeholder text.

Report: "PROJECT_MANIFEST.md written. N/11 sections extracted from description,
M filled via Q&A, K generated as defaults."

---

## Phase 6: Generate SOFTWARE_FACTORY_MANIFEST

Use the PROJECT_MANIFEST content already in context (generated in Phase 5, or read
in Phase 0 resume). Do not re-read from disk.

Fill the 7 SOFTWARE_FACTORY_MANIFEST sections:

**Section 1 — Factory Overview**
One paragraph: project name + "This factory runs a 6-agent sequential pipeline..." +
tech stack summary drawn from the project manifest.

**Section 2 — Pipeline Sequence**
Fixed 6-agent sequence. Use the project name (lowercased, hyphenated) as <slug>:

    1. Planner
       Reads:  feature request + PROJECT_MANIFEST.md
       Writes: work-packages/<slug>.md

    2. Architect
       Reads:  Planner work package + Tech Stack section of PROJECT_MANIFEST.md
       Writes: docs/adr/NNNN-<slug>.md

    3. Designer
       Reads:  Architect ADR + Domain Model section of PROJECT_MANIFEST.md
       Writes: design/<slug>-spec.md

    4. Coder
       Reads:  Designer spec + Conventions section of PROJECT_MANIFEST.md
       Writes: src/ on feature branch <slug>-<feature>

    5. Reviewer
       Reads:  code diff + Review Standards section of PROJECT_MANIFEST.md
       Writes: review-reports/<slug>-review.md

    6. Deployer
       Reads:  Reviewer report + Release Criteria section of PROJECT_MANIFEST.md
       Writes: release-gates/<slug>-gate.md

**Section 3 — Human Gates**

    Gate 1: After Architect — human approves ADR before Designer runs.
    Gate 2: After Reviewer — human approves review report before Deployer runs.

**Section 4 — Per-Agent System Prompt Seeds**
Use this template for each of the 6 agents:

    "You are the {Agent} for {ProjectName}. You {role description} using
    {relevant manifest sections} in PROJECT_MANIFEST.md."

Fill in:
- {ProjectName}: from Section 1 (Overview) of the project manifest
- {Agent}: Planner / Architect / Designer / Coder / Reviewer / Deployer
- {role description}: appropriate to the agent's function
- {relevant manifest sections}: the sections that agent reads

Each seed MUST contain the project name AND at least one domain entity name from
Section 4 (Domain Model) of the project manifest. If the domain model is weak
(labeled "weak"), add to each seed: `(update with domain entities once Section 4
is strengthened)`.

Example seeds for "Fired Up Pizza":

    Planner:   "You are the Planner for Fired Up Pizza. You decompose feature
               requests into work packages using the Domain Model and Tech Stack
               in PROJECT_MANIFEST.md."

    Architect: "You are the Architect for Fired Up Pizza. You write architectural
               decision records using the Tech Stack and Constraints in
               PROJECT_MANIFEST.md."

    Designer:  "You are the Designer for Fired Up Pizza. You write UX specs and
               interaction designs using the Domain Model and Conventions in
               PROJECT_MANIFEST.md."

    Coder:     "You are the Coder for Fired Up Pizza. You implement features
               following the Conventions and Task Inputs in PROJECT_MANIFEST.md."

    Reviewer:  "You are the Reviewer for Fired Up Pizza. You enforce the Review
               Standards in PROJECT_MANIFEST.md against every code diff."

    Deployer:  "You are the Deployer for Fired Up Pizza. You gate releases against
               the Release Criteria in PROJECT_MANIFEST.md."

**Section 5 — Quality Gates**
Copy the Review Standards and Release Criteria sections from the project manifest.
Organize as: "Stage N passes when: [criteria]" for each of the 6 stages.

**Section 6 — Orchestrator Configuration**

    Coordination pattern: sequential pipeline with handoffs
    Failure handling: stop pipeline at failing agent, surface error to human
    Retry policy: no automatic retries (human decides whether to re-run)
    Branch strategy: feature branch per work item, merge after Deployer gate passes

**Section 7 — Conventions Reference**
Copy verbatim from Section 5 (Conventions) of the project manifest.

---

## Phase 7: Validate and Write

Validation checks before writing. Fix any failure by regenerating the section
using in-context project manifest content.

1. All 6 agents in Pipeline Sequence have non-empty Reads and Writes — PASS or fix.
2. Gate 1 is after Architect, Gate 2 is after Reviewer (not Deployer) — PASS or fix.
3. All 6 seeds contain the project name AND at least one domain entity — PASS or fix.
4. Quality Gates section is non-empty and non-generic — PASS or fix.

Call FILE_WRITE_GUARD("SOFTWARE_FACTORY_MANIFEST.md").

Write `SOFTWARE_FACTORY_MANIFEST.md` to the current directory.

Report: "SOFTWARE_FACTORY_MANIFEST.md written and validated.
Both manifests ready — your 6-agent factory has context."

---

## PROJECT_MANIFEST Schema

Write the output file with exactly this structure. Fill every section.

    # Project Manifest: [Project Name]

    ## Overview

    [One paragraph: what the software does and who uses it.]

    ## Tech Stack

    | Layer    | Technology | Notes |
    |----------|-----------|-------|
    | Frontend |           |       |
    | Styling  |           |       |
    | State    |           |       |
    | Routing  |           |       |
    | Backend  |           |       |
    | Database |           |       |
    | Testing  |           |       |
    | Linting  |           |       |

    ## Project Structure

    [Top-level directory tree, annotated. Label (proposed) if pre-code.]

    ## Domain Model

    [Core entities, their fields, and their relationships.]

    ## Conventions

    - File naming:
    - Test files:
    - API routes:
    - Commits:
    - Branches:

    ## Constraints

    - [Explicit out-of-scope items or disallowed approaches.]

    ---

    ## Task Inputs

    | Agent     | Receives                  | From                     |
    |-----------|--------------------------|--------------------------|
    | Planner   |                          |                          |
    | Architect |                          |                          |
    | Designer  |                          |                          |
    | Coder     |                          |                          |
    | Reviewer  |                          |                          |
    | Deployer  |                          |                          |

    ## Services to Connect

    | Service | Purpose | Config |
    |---------|---------|--------|
    |         |         |        |

    ## Success Criteria

    ### Per-Feature Success

    - [ ]
    - [ ]

    ### Factory-Level Success

    - [ ]
    - [ ]

    ---

    ## Review Standards

    ### Spec Compliance

    - [Rules the Reviewer enforces against the Designer's spec.]

    ### Style

    - [Project-specific style rules.]

    ### Security

    - [Project-specific security rules.]

    ### Severity Scale

    - **Low**: cosmetic issues, minor inconsistencies
    - **Medium**: functional gaps, missing edge cases
    - **High**: data loss, security vulnerability, spec violation

    ---

    ## Release Criteria

    ### Required (all must PASS)

    1. [ ]
    2. [ ]

    ### Informational (reported but non-blocking)

    - [metric 1]

---

## SOFTWARE_FACTORY_MANIFEST Schema

Write the output file with exactly this structure.

    # Software Factory Manifest: [Project Name]

    ## Factory Overview

    [Project name. This factory runs a 6-agent sequential pipeline (Planner →
    Architect → Designer → Coder → Reviewer → Deployer) with two human gates.
    Tech stack: [summary from PROJECT_MANIFEST.md].]

    ## Pipeline Sequence

    1. **Planner**
       - Reads: feature request + PROJECT_MANIFEST.md
       - Writes: work-packages/[slug].md

    2. **Architect**
       - Reads: Planner work package + Tech Stack section
       - Writes: docs/adr/NNNN-[slug].md

    3. **Designer**
       - Reads: Architect ADR + Domain Model section
       - Writes: design/[slug]-spec.md

    4. **Coder**
       - Reads: Designer spec + Conventions section
       - Writes: src/ on feature branch [slug]-[feature]

    5. **Reviewer**
       - Reads: code diff + Review Standards section
       - Writes: review-reports/[slug]-review.md

    6. **Deployer**
       - Reads: Reviewer report + Release Criteria section
       - Writes: release-gates/[slug]-gate.md

    ## Human Gates

    - **Gate 1 — After Architect:** Human approves ADR before Designer runs.
    - **Gate 2 — After Reviewer:** Human approves review report before Deployer runs.

    ## Per-Agent System Prompt Seeds

    **Planner:** "[seed]"

    **Architect:** "[seed]"

    **Designer:** "[seed]"

    **Coder:** "[seed]"

    **Reviewer:** "[seed]"

    **Deployer:** "[seed]"

    ## Quality Gates

    [Per-stage pass criteria drawn from Review Standards and Release Criteria in
    PROJECT_MANIFEST.md. Format: "Stage N (AgentName) passes when: [criteria]".]

    ## Orchestrator Configuration

    - Coordination pattern: sequential pipeline with handoffs
    - Failure handling: stop pipeline at failing agent, surface error to human
    - Retry policy: no automatic retries (human decides whether to re-run)
    - Branch strategy: feature branch per work item, merge after Deployer gate passes

    ## Conventions Reference

    [Verbatim copy of Conventions section from PROJECT_MANIFEST.md.]

---

<!-- WORKED EXAMPLE START — NOT INSTRUCTIONS — reference only during Phases 2 and 4
to calibrate what "EXTRACTED" looks like per section. Do NOT use this content as output. -->

## Worked Example: Fired Up Pizza

### Input description

Fired Up Pizza is a web app for a small neighborhood pizza restaurant. Customers
browse the menu, customize pizzas (size, crust, toppings), place an order against
their phone number, and track it through "placed → preparing → ready → delivered."
Staff use the same app to manage menu items and advance order status as pizzas move
through the kitchen. It replaces a phone-only workflow that loses orders and leaves
customers in the dark.

Goals: customers can place and track an order without a phone call; staff can see
every live order in one view and update status in one click; runs on a single machine
with `npm install && npm run dev` — no cloud setup.

Stack: React 18 + TypeScript + Vite; Tailwind; Node.js + Express REST API; SQLite
via better-sqlite3; Vitest + React Testing Library.

Out of scope: online payments (pay at counter), SMS/push notifications, multi-location
support, loyalty accounts.

Constraints: no external auth (phone-number identity), no external DB server,
no real-time infra — polling is acceptable.

Users: Customer (places and tracks orders, identified by phone number); Staff
(views live order queue, advances order status, edits menu items).

### What "EXTRACTED" looks like (annotated excerpts)

**Section 1 — Overview (EXTRACTED):**
Fired Up Pizza is a web app for a small neighborhood restaurant that lets customers
browse the menu, customize and place orders by phone number, and track status through
placed → preparing → ready → delivered. Staff view the live order queue and advance
status. Replaces a phone-only workflow.
[Good: project-named, specific actors, specific workflow described.]

**Section 2 — Tech Stack (EXTRACTED):**
Frontend: React 18 + TypeScript + Vite | Styling: Tailwind CSS | Backend: Node.js +
Express (REST) | Database: SQLite via better-sqlite3 (single-machine, no external
server) | Testing: Vitest + React Testing Library
[Good: named technologies with versions where available, notes on constraints.]

**Section 4 — Domain Model (EXTRACTED):**
MenuItem: id, name, description, base_price, available (boolean)
Order: id, phone_number, status (placed|preparing|ready|delivered), created_at
OrderItem: id, order_id, menu_item_id, size, crust, toppings[], unit_price
Customer: identified by phone_number (no account entity)
Staff: role only, no separate entity needed
[Good: named entities, key fields, relationships implied. This is what "EXTRACTED" looks like.]

**Section 4 — Domain Model (PARTIAL):**
"The app manages orders and menu items for customers and staff."
[Bad: entity names present (orders, menu items, customers, staff) but no fields,
no relationships, no statuses. Would trigger a follow-up question.]

**Section 6 — Constraints (EXTRACTED):**
- No online payments (pay at counter only)
- No SMS or push notifications
- No multi-location support
- No external auth — identity is phone number only
- No external DB server — SQLite, single machine
- Polling acceptable (no real-time infra needed)
[Good: explicit, enumerated, actionable.]

**Section 9 — Success Criteria (EXTRACTED):**
Per-Feature: customer places order without phone call; customer tracks through 4
status stages; staff sees all live orders in one view; staff advances status in one
click; staff edits menu items.
Factory-Level: app starts with npm install && npm run dev; all tests pass on clean
checkout.
[Good: specific, testable, includes factory-level criteria.]

<!-- WORKED EXAMPLE END -->
