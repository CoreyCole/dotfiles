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

# ADR: Parent Pi q-manager wrapper owns usage + native compact

q-manager auto-compaction needs parent Pi context usage and native compaction APIs, which exist only inside the parent Pi process. Add a parent Pi q-manager wrapper/command that measures `ctx.getContextUsage()`, runs the normal Vamos CLI launch/continue path, then calls `ctx.compact()` only when the CLI has marked manager delivery `compacting`.

## Status

Accepted

## Consequences

- Go CLI remains graph/state authority.
- Child extension stays child-only.
- Parent wrapper must keep output concise and avoid NDJSON on happy path.
