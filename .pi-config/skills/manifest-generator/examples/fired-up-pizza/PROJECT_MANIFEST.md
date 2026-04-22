# Project Manifest: Fired Up Pizza

## Overview

Fired Up Pizza is an online ordering platform for a small chain of artisan pizza restaurants (3 Bay Area locations). Customers browse the menu, customize pizzas, and place orders as guests or logged-in accounts for pickup or delivery, then track their order status in real time. Kitchen staff see a live order queue sorted by time and advance item status as orders move through the kitchen. Store managers update menu items and prices, view daily sales reports, and manage operating hours and delivery radius.

## Tech Stack

| Layer          | Technology                     | Notes                                           |
|----------------|-------------------------------|------------------------------------------------|
| Frontend       | React + TypeScript             | Vite build tool                                 |
| Styling        | Tailwind CSS                   |                                                 |
| State          | React state + React Query      | (proposed — update when scaffolded)             |
| Routing        | React Router                   | (proposed — update when scaffolded)             |
| Real-time      | Socket.io (WebSockets)         | Live order status updates to customer + kitchen |
| Backend        | Node.js + Express              | REST API                                        |
| Database       | PostgreSQL                     | Orders, menu, users, stores                     |
| Cache/Session  | Redis                          | Session store, real-time order state            |
| Auth           | JWT                            | Email + password (customers); PIN (kitchen)     |
| Payments       | Stripe                         | Card processing only; no cash or PayPal         |
| Hosting        | Railway (backend + DB), Vercel (frontend) |                                      |
| Testing        | Vitest (unit), Playwright (e2e)|                                                 |

## Project Structure

(proposed — update when scaffolded)

```
fired-up-pizza/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── components/        # Shared UI components
│   │   ├── pages/             # Route-level page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client functions
│   │   └── types/             # Shared TypeScript types (client)
│   ├── tests/
│   │   └── e2e/               # Playwright specs
│   └── vite.config.ts
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── routes/            # Express route handlers
│   │   ├── controllers/       # Business logic
│   │   ├── models/            # DB query functions / ORM models
│   │   ├── middleware/        # Auth, validation, error handling
│   │   └── services/          # Stripe, Socket.io, email
│   └── package.json
├── shared/                    # Types shared between client and server
└── package.json               # Root workspace scripts
```

## Domain Model

**Customer** — id, email, password_hash, name, phone, addresses[], created_at
**Order** — id, customer_id (nullable for guest), store_id, items[], status (placed | in-progress | ready | out-for-delivery | delivered), subtotal, tax, delivery_fee, total, pickup_or_delivery, delivery_address, placed_at, updated_at
**OrderItem** — id, order_id, menu_item_id, quantity, size, customizations[], unit_price, status (received | in-progress | ready)
**MenuItem** — id, store_id, name, description, category, base_price, sizes[], available_customizations[], is_available, image_url
**Store** — id, name, address, phone, hours, delivery_radius_miles, is_open
**Staff** — id, store_id, name, pin_hash, role (kitchen | manager)

Relationships:
- An Order belongs to one Store and optionally one Customer (nullable for guest orders)
- An Order has many OrderItems, each referencing one MenuItem
- A MenuItem belongs to one Store (menus are per-location)
- A Staff member belongs to one Store

## Conventions

(default — update when scaffolded)

- File naming: kebab-case for all files and directories (`order-item.ts`, `cart-summary.tsx`, `use-order-status.ts`)
- Test files: `*.test.ts` / `*.test.tsx` co-located with source for unit tests; `client/tests/e2e/*.spec.ts` for Playwright
- API routes: noun-first, kebab-case (`POST /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`); version prefix (`/api/v2/...`) only on breaking changes
- Commits: Conventional Commits — `feat:`, `fix:`, `chore:`, `test:`, `refactor:`
- Branches: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`

## Constraints

- MVP scope: single-location launch (one active Store); multi-location support is v2
- No mobile app — mobile web only; iOS Safari and Android Chrome must work correctly
- Stripe only — no cash, PayPal, or other payment processors in v1
- Delivery by restaurant staff only — no third-party delivery integration (no DoorDash etc.)
- Orders must be stored and queryable for 2 years (compliance requirement)
- Kitchen display must work on a 10-inch tablet in landscape mode
- Page load target: < 2 seconds on a 4G connection for the menu page

---

## Task Inputs

(pipeline-critical — verify before running factory)

| Agent     | Receives                                           | From                              |
|-----------|---------------------------------------------------|-----------------------------------|
| Planner   | Feature request + PROJECT_MANIFEST.md              | Human requester + this file       |
| Architect | Planner work package + Tech Stack section          | Planner output                    |
| Designer  | Architect ADR + Domain Model section               | Architect output                  |
| Coder     | Designer spec + Conventions section                | Designer output                   |
| Reviewer  | Code diff + Review Standards section               | Coder output (feature branch)     |
| Deployer  | Reviewer report + Release Criteria section         | Reviewer output                   |

## Services to Connect

| Service    | Purpose                               | Config                                          |
|------------|--------------------------------------|------------------------------------------------|
| Stripe     | Payment processing                   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`   |
| PostgreSQL | Primary database                     | `DATABASE_URL`                                  |
| Redis      | Session store + real-time order state| `REDIS_URL`                                     |
| Socket.io  | Real-time order updates (WebSockets) | Runs on Express server; no separate service     |
| Railway    | Backend + DB hosting                 | Deploy via Railway CLI or GitHub integration    |
| Vercel     | Frontend hosting                     | Deploy via Vercel CLI or GitHub integration     |

## Success Criteria

### Per-Feature Success

- [ ] Customer can complete a guest checkout end-to-end in under 3 minutes
- [ ] Kitchen staff can update order item status with one tap — no confirmation dialog
- [ ] Manager can update a menu item price without a developer
- [ ] Order status updates appear in real time for customers tracking their order
- [ ] All Stripe webhook events handled idempotently (duplicate webhook events do not create duplicate orders)

### Factory-Level Success

- [ ] Menu page loads in < 2s on simulated 4G throttle (Lighthouse Performance ≥ 90)
- [ ] Zero lost orders: if WebSocket drops and reconnects, kitchen queue shows current state
- [ ] All unit tests pass on clean checkout (`npm test`)
- [ ] All e2e Playwright tests pass against staging environment

---

## Review Standards

(default — customize for this project)

### Spec Compliance

- Every PR must reference a Designer spec in `design/` — no spec, no merge
- API response shapes must match the spec exactly (field names, types, nullability)
- WebSocket event names and payload shapes must match the spec
- OrderItem status transitions must follow `received → in-progress → ready` — no skipping stages

### Style

- TypeScript strict mode enforced — no `any`, no `as unknown as X` casts without explanatory comment
- React components: named exports only, no default exports except page-level route components
- No raw SQL string concatenation — use parameterized queries or ORM methods
- No `console.log` left in committed code (use a structured logger in server; remove from client)

### Security

- JWT tokens must be validated server-side on every authenticated route — never trust client claims
- Stripe webhook signatures must be verified (`stripe.webhooks.constructEvent`) before processing any event
- No customer PII (email, phone, address) written to application logs or console
- PIN-based staff auth: rate-limit to 5 failed attempts per minute per IP before lockout
- All user input sanitized before DB write; parameterized queries required

### Severity Scale

- **Low**: cosmetic issues, minor inconsistencies, non-blocking style violations
- **Medium**: functional gaps, missing edge cases, unvalidated input at internal boundaries
- **High**: data loss risk, security vulnerability, spec violation, broken idempotency

---

## Release Criteria

(default — customize for this project)

### Required (all must PASS)

1. [ ] All unit and e2e tests pass on CI (zero failures, zero skipped)
2. [ ] No High severity Reviewer findings open
3. [ ] Stripe webhook handling verified against test-mode events (placed, payment_intent.succeeded, payment_intent.payment_failed)
4. [ ] Menu page Lighthouse audit: Performance ≥ 90, LCP ≤ 2.0s on 4G throttle
5. [ ] Database migrations run cleanly on staging from the previous deployed version

### Informational (reported but non-blocking)

- Client bundle size (total + largest chunk)
- Unit test coverage %
- p95 API response time from staging load test (100 concurrent users, 60-second run)
