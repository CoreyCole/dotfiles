---
date: 2026-07-03T08:53:12-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
stage: question
ticket: q-manager auto-compact parent after child launch
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
question_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/questions/2026-07-03_08-53-12_q-manager-auto-compaction.md
brainstorm_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md
prev_question_docs: []
---

# Research Questions: q-manager auto-compact parent after child launch

## Brainstorm Summary

- Desired outcome: when q-manager starts a child and parent manager context is >80%, child starts first, then parent manager uses Pi native compaction so child can work while manager context resets.
- Current test failed: manager started a child but did not handoff/compact; current CLI only compacts when explicit `--manager-usage-*` flags are passed.
- Preferred direction: use Pi native manager `/compact` / extension `ctx.compact()` rather than relying on custom manager handoff as the main compaction mechanism.
- Preserve safety: child remains visible; active child refs are persisted before compaction; quick child human gate/result queues safely and flushes to the compacted manager.
- Open tension: where to integrate parent usage detection and native compaction—q-manager CLI, q-manager Pi extension, parent command wrapper, or a new manager command flow.

## Context

q-manager currently launches visible child Pi sessions and validates child results through `vamos qrspi start-next` / `continue`. It has a local delivery state that can queue wakes while `compacting`, but live use did not trigger automatically because the CLI needs explicit usage flags. Research should map the current control flow and Pi native compaction APIs before design.

## Brainstorm Artifact

- `context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md` — full investigation, branch map, and alignment rationale.

## Questions

1. How does the current q-manager `start-next` / `continue` flow launch a child, persist active child refs, decide compaction, and deliver or queue child wakes?
1. What Pi interactive extension APIs or events expose parent manager context usage and native compaction, and can they be called safely from a q-manager parent command after `start-next` returns?
1. What ordering guarantees are needed so q-manager marks delivery queue-safe before invoking Pi native compaction, especially if the child completes or asks a human question immediately?
1. How does Pi native compaction handle messages submitted while compaction is running, and how would a q-manager child wake be delivered or queued relative to that behavior?
1. Where should the integration live—Vamos q-manager CLI, q-manager child/parent Pi extension, a registered manager command, or a small wrapper—and what code boundaries already exist?
1. What tests currently cover manager compaction/wake queue behavior, and what regressions are missing for native compaction trigger, quick child human gate, queued wake flush, and stale wake supersession?

## Codebase References

- `cmd/vamos-runtime/internal/qrspicmd/root.go` — `RunStartNext`, `RunContinue`, `maybeStartManagerCompaction`, `RunManagerReady`, wake queue/flush helpers.
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` — current explicit usage threshold and queued wake tests.
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` — delivery ready/compacting/manager-ready behavior.
- `docs/q-manager.md` — manager contract, child wake contract, current compaction notes.
- `.pi/skills/q-manager/SKILL.md` — operator-facing q-manager workflow and compaction instructions.
- `context/pi/packages/coding-agent/src/core/extensions/types.ts` — Pi `ExtensionContext.getContextUsage()` and `compact()` API definitions.
- `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts` — `/compact` command handling and input queueing during compaction.
- `context/pi/packages/agent/src/harness/compaction/compaction.ts` — native compaction threshold/usage calculations and session compaction behavior.
