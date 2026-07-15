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

# ADR: Allow handoff from every QRSPI Agent node

Every ticket-level QRSPI `Agent` node will accept `status: handoff` and use the runtime's same-node continuation semantics; human-review and done nodes remain excluded. Resume instructions and skills must load the exact current stage context so planning, review, workspace, implementation, and verify checkpoints remain valid.

## Status

Accepted

## Consequences

- Rotation no longer depends on stage.
- The handoff artifact satisfies the node's primary-artifact requirement.
- Tests enumerate all Agent nodes and prove same-node continuation.
