---
date: 2026-07-03T10:55:37-07:00
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

# ADR: Child context exhaustion is recoverable, not completion

A child that hits context exhaustion, failed child compaction, provider context-limit errors, or exits without a valid `qrspi_result` has not completed the QRSPI node. q-manager must preserve pane/session/artifact refs, surface evidence and safe recovery commands, and recover by child compact only when context-limit evidence exists; otherwise resume/steer/rebind or same-node relaunch instead of inventing durable YAML or advancing the graph.

## Status

Accepted

## Consequences

- Existing artifacts may be validated and salvaged, but graph transition still requires valid result semantics.
- No trustworthy result means relaunch the same graph node.
- Action cards/tests must protect recovery refs and prevent accidental advancement.
- Child `/compact` is context-limit recovery only, not generic no-wake recovery.
