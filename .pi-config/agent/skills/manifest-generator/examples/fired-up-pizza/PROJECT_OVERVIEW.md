# Fired Up Pizza — Project Overview

## What We're Building

Fired Up Pizza is an online ordering platform for a small chain of artisan pizza restaurants (3 locations in the Bay Area). Customers can browse the menu, customize their pizza, place orders for pickup or delivery, and track their order status in real time.

The system also needs a staff-facing side: kitchen staff see a live order queue and mark items as in-progress or ready, and store managers can update menu items, view daily sales reports, and manage operating hours.

## Users

**Customers** — browse menu, add items to cart, place orders (guest or logged-in), track order status, view order history (if logged in).

**Kitchen Staff** — view live order queue sorted by time, update order item status (received → in-progress → ready), see special instructions per item.

**Store Managers** — manage menu (add/edit/remove items, set prices, mark items unavailable), view daily sales reports, update store hours and delivery radius.

## Tech Stack

- **Frontend:** React + TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js + Express, REST API
- **Database:** PostgreSQL (orders, menu, users), Redis (session, real-time order state)
- **Real-time:** WebSockets (Socket.io) for live order status updates
- **Auth:** JWT-based, email + password for customers; PIN-based for kitchen staff
- **Payments:** Stripe (card processing, no cash or PayPal)
- **Hosting:** Railway (backend + DB), Vercel (frontend)
- **Testing:** Vitest (unit), Playwright (e2e)

## Domain Model

Core entities:

- **Customer** — id, email, password_hash, name, phone, addresses[], created_at
- **Order** — id, customer_id (nullable for guest), store_id, items[], status, subtotal, tax, delivery_fee, total, pickup_or_delivery, delivery_address, placed_at, updated_at
- **OrderItem** — id, order_id, menu_item_id, quantity, size, customizations[], unit_price, status (received | in-progress | ready)
- **MenuItem** — id, store_id, name, description, category, base_price, sizes[], available_customizations[], is_available, image_url
- **Store** — id, name, address, phone, hours, delivery_radius_miles, is_open
- **Staff** — id, store_id, name, pin_hash, role (kitchen | manager)

Key relationships:
- An Order belongs to one Store and optionally one Customer
- An Order has many OrderItems, each referencing one MenuItem
- A MenuItem belongs to one Store (menus are per-location)
- A Staff member belongs to one Store

## Key Flows

1. **Guest checkout** — browse menu → customize item → add to cart → enter contact + delivery info → pay with Stripe → receive confirmation email → track via link in email
2. **Logged-in checkout** — same as above but address auto-filled, order saved to history
3. **Kitchen queue** — staff logs in with PIN → sees live queue → taps item to mark in-progress → taps again to mark ready → order auto-advances to "ready for pickup/out for delivery" when all items are ready
4. **Menu management** — manager logs in → goes to menu tab → edits item price or availability → change takes effect immediately for new orders

## Constraints

- MVP scope: single-location launch first (one Store), multi-location in v2
- No mobile app — mobile web must work well on iOS Safari and Android Chrome
- Stripe only — no other payment processors in v1
- Delivery handled by restaurant staff (no third-party delivery integration)
- Orders must be stored and queryable for 2 years (compliance)
- Kitchen display must work on a 10-inch tablet in landscape mode
- Page load target: < 2 seconds on a 4G connection for the menu page

## Success Criteria

- Customer can complete a guest checkout end-to-end in under 3 minutes
- Kitchen staff can update order item status with one tap (no confirmation dialog)
- Menu page loads in < 2s on simulated 4G (Lighthouse)
- Zero lost orders — if the WebSocket drops, the kitchen queue still shows current state on reconnect
- Manager can update a menu item price without a developer
- All Stripe webhook events handled idempotently (duplicate events don't create duplicate orders)
