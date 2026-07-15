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

# ADR: Trigger handoff steering at 75% context usage

Managed manager and child extensions will sample estimated usage at stable `turn_end`; at a configurable 75% default they persist one rotation intent and queue the handoff prompt as steering. The first version keeps Pi's existing per-tool truncation and accepts that this conservative threshold is not a mathematical guarantee against one extreme parallel batch.

## Status

Accepted

## Consequences

- Current batch finishes; handoff becomes the next provider turn.
- No aggregate output cap, telemetry prerequisite, or exact payload accounting in v1.
- Unknown usage does not trigger proactive rotation; existing exhaustion recovery remains available.
