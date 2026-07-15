---
date: 2026-07-15T11:06:58-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: f61af15238c679df46583495971e2841e30dcc8c
branch: main
repository: vamos
stage: design
artifact: adr
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
related_artifact: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/design.md
---

# ADR: Use asymmetric manager and child replacement mechanics

Manager rotation keeps the existing pane/process: q-manager persists rotation context, targets Pi's built-in `/new`, then the fresh extension `session_start` claims and injects the handoff. Child rotation reuses the proven q-manager path: launch a fresh pane/process/session with authoritative stage/cwd/env refs, save it as active, then close the predecessor pane.

## Status

Accepted

## Consequences

- No upstream Pi API or manager-pane transfer.
- Manager wake target stays stable across rotation.
- Children avoid stale process environment and session-ref repair caused by in-pane `/new`.
