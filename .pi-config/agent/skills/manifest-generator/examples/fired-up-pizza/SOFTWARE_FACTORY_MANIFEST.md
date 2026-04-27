# Software Factory Manifest: Fired Up Pizza

## Factory Overview

Fired Up Pizza is an online pizza ordering platform with real-time order tracking for customers and a live kitchen queue for staff. This factory runs a 6-agent sequential pipeline (Planner → Architect → Designer → Coder → Reviewer → Deployer) with two human gates. Tech stack: React + TypeScript + Vite frontend, Node.js + Express REST API, PostgreSQL + Redis, Socket.io for real-time updates, Stripe payments, hosted on Railway (backend) and Vercel (frontend).

## Pipeline Sequence

1. **Planner**
   - Reads: feature request + PROJECT_MANIFEST.md
   - Writes: work-packages/fired-up-pizza.md

2. **Architect**
   - Reads: Planner work package + Tech Stack section of PROJECT_MANIFEST.md
   - Writes: docs/adr/NNNN-fired-up-pizza.md

3. **Designer**
   - Reads: Architect ADR + Domain Model section of PROJECT_MANIFEST.md
   - Writes: design/fired-up-pizza-spec.md

4. **Coder**
   - Reads: Designer spec + Conventions section of PROJECT_MANIFEST.md
   - Writes: src/ on feature branch fired-up-pizza-\<feature\>

5. **Reviewer**
   - Reads: code diff + Review Standards section of PROJECT_MANIFEST.md
   - Writes: review-reports/fired-up-pizza-review.md

6. **Deployer**
   - Reads: Reviewer report + Release Criteria section of PROJECT_MANIFEST.md
   - Writes: release-gates/fired-up-pizza-gate.md

## Human Gates

- **Gate 1 — After Architect:** Human approves ADR before Designer runs.
- **Gate 2 — After Reviewer:** Human approves review report before Deployer runs.

## Per-Agent System Prompt Seeds

**Planner:** "You are the Planner for Fired Up Pizza. You decompose feature requests into work packages using the Domain Model (Customer, Order, OrderItem, MenuItem, Store, Staff) and Tech Stack sections in PROJECT_MANIFEST.md."

**Architect:** "You are the Architect for Fired Up Pizza. You write architectural decision records for features involving Order, OrderItem, and real-time state, using the Tech Stack and Constraints sections in PROJECT_MANIFEST.md."

**Designer:** "You are the Designer for Fired Up Pizza. You write UX specs and interaction designs for flows involving Customer checkout, OrderItem status progression, and Staff kitchen queue, using the Domain Model and Conventions sections in PROJECT_MANIFEST.md."

**Coder:** "You are the Coder for Fired Up Pizza. You implement features touching Order, OrderItem, MenuItem, and Customer entities following the Conventions and Task Inputs sections in PROJECT_MANIFEST.md."

**Reviewer:** "You are the Reviewer for Fired Up Pizza. You enforce the Review Standards in PROJECT_MANIFEST.md against every code diff, with special attention to Order idempotency, JWT validation, and Stripe webhook signature verification."

**Deployer:** "You are the Deployer for Fired Up Pizza. You gate releases against the Release Criteria in PROJECT_MANIFEST.md, verifying Stripe test-mode webhook events, Lighthouse performance targets, and migration safety before approving deploy."

## Quality Gates

**Stage 1 (Planner) passes when:**
- Work package names the affected entities (Order, OrderItem, MenuItem, Customer, Store, or Staff)
- Scope is a single deliverable feature, not a multi-feature bundle
- Acceptance criteria are listed and testable

**Stage 2 (Architect) passes when:**
- ADR references the relevant Tech Stack layers (e.g., Socket.io for real-time, Stripe for payment flows)
- Decision addresses the Constraints (single-location MVP, no third-party delivery, 2-year data retention)
- Tradeoffs documented; alternatives considered
- Human Gate 1 approved by reviewer

**Stage 3 (Designer) passes when:**
- Spec covers all OrderItem status transitions (`received → in-progress → ready`)
- API response shapes defined (field names, types, nullability)
- WebSocket event names and payload shapes defined
- Kitchen display layout specified for 10-inch tablet landscape

**Stage 4 (Coder) passes when:**
- Implementation matches Designer spec (field names, status values, event names)
- TypeScript strict mode — no `any` without comment
- All parameterized queries — no SQL string concatenation
- No customer PII in logs

**Stage 5 (Reviewer) passes when:**
- Zero High severity findings open (data loss, security vulnerability, spec violation)
- JWT validated server-side on every authenticated route
- Stripe webhook signatures verified before event processing
- PIN auth rate-limited to 5 attempts/min/IP
- Human Gate 2 approved by reviewer

**Stage 6 (Deployer) passes when:**
- All unit and e2e tests pass on CI
- Menu page Lighthouse Performance ≥ 90, LCP ≤ 2.0s on 4G throttle
- Stripe test-mode webhook events verified (payment_intent.succeeded, payment_intent.payment_failed)
- DB migrations run cleanly on staging from previous version
- No High severity Reviewer findings remaining

## Orchestrator Configuration

- Coordination pattern: sequential pipeline with handoffs
- Failure handling: stop pipeline at failing agent, surface error to human
- Retry policy: no automatic retries (human decides whether to re-run)
- Branch strategy: feature branch per work item, merge after Deployer gate passes

## Conventions Reference

(verbatim from PROJECT_MANIFEST.md Section 5)

- File naming: kebab-case for all files and directories (`order-item.ts`, `cart-summary.tsx`, `use-order-status.ts`)
- Test files: `*.test.ts` / `*.test.tsx` co-located with source for unit tests; `client/tests/e2e/*.spec.ts` for Playwright
- API routes: noun-first, kebab-case (`POST /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`); version prefix (`/api/v2/...`) only on breaking changes
- Commits: Conventional Commits — `feat:`, `fix:`, `chore:`, `test:`, `refactor:`
- Branches: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`
