---
date: 2026-07-03T10:15:24-07:00
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

# ADR: Preserve and test the q-manager wake chain

Auto-compaction must not make missed child wakes harder to diagnose. Treat the wake chain as an end-to-end reliability contract: child Pi extension -> `qrspi child-complete` -> session JSONL validation -> delivery queue/deliver -> parent pane wake.

## Status

Accepted

## Consequences

- Parent wrapper/native compaction tests must prove valid child completion wakes manager or queues then flushes.
- Recovery commands must validate latest child session and continue without hand-editing durable artifacts.
- No-wake diagnostics remain local control-plane state, not durable `qrspi_result` content.
