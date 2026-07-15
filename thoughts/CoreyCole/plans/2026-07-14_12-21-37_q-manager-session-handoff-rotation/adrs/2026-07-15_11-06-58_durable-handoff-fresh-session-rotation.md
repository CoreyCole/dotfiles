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

# ADR: Durable handoff before fresh-session rotation

Near-limit q-manager and child sessions will write a durable, graph-valid handoff before replacement, then continue in a fresh Pi session. Native compaction is removed from normal and fallback continuation because it is lossy and did not reliably resume the observed child failure.

## Status

Accepted

## Consequences

- Handoff artifact/result validation is the replacement commit point.
- Provider overflow remains an explicit recovery error; runtime never fabricates stage completion.
- Predecessor JSONL/artifacts remain inspectable.
