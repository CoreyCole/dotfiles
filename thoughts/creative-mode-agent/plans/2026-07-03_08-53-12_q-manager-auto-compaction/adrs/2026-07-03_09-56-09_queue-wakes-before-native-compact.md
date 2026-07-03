---
date: 2026-07-03T09:56:09-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
stage: design
artifact: adr
ticket: q-manager auto-compact parent after child launch
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
related_artifact: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md
---

# ADR: q-manager queues child wakes before native parent compact

A quick child result or human gate must not paste into a parent session that is being compacted. Keep the existing q-manager delivery state: after child launch refs persist, the CLI writes the operational handoff, saves `Delivery.Status = "compacting"`, and only then may the parent wrapper invoke `ctx.compact()`.

## Status

Accepted

## Consequences

- Child wakes during parent compaction are stored as the queued q-manager wake.
- Fresh manager runs `manager-ready` after compaction and receives exactly one validated wake.
- Existing generation/lifecycle checks continue to suppress stale queued wakes.
