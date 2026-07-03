---
date: 2026-07-03T11:30:10-07:00
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

# ADR: Parent auto-compaction triggers at 90% fresh usage

Parent q-manager wrapper should sample `ctx.getContextUsage()` on each manager action and trigger native parent compaction only when the fresh sample is at least 90%. q-manager may persist the last observed usage sample in local manager control state for diagnostics, but stale samples must not trigger compaction and usage samples must not appear in durable `qrspi_result` YAML.

## Status

Accepted
