---
date: 2026-07-05T23:35:36-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 424859bd6e6b79a07d290f1ed49799d913fa9c8e
branch: creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes
repository: vamos
stage: question
ticket: 'implementation-review follow-up: parent pane adoption'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
project: github.com/CoreyCole/vamos
related_projects: []
question_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/questions/2026-07-05_23-35-36_parent-pane-adoption.md
brainstorm_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/context/brainstorms/2026-07-05_23-35-36_parent-pane-adoption.md
prev_question_docs: []
---

# Research Questions: q-manager parent pane adoption

## Brainstorm Summary

- Desired outcome: normal tmux CLI `continue` / `start-next` can recover q-manager parent role by adopting current `$TMUX_PANE` when safe.
- Scope: parent/manager pane capture, delivery pane selection, queued wake/compacting behavior, explicit override UX, action-card stops, tests/docs.
- Constraints: pane refs remain local control state; do not put them in durable `qrspi_result`; preserve visible child sessions and graph authority; keep Pi native compaction optional.
- Current discovery: initial capture uses explicit `--manager-pane` then `$TMUX_PANE`; wake delivery prefers `Delivery.ManagerPaneID` then `ManagerPaneID`; `manager-ready` can update pane and flush queued wake; no obvious shared safe-adoption helper exists yet.
- Main tradeoff: auto-adopt dead/stale/compacting states for recovery, but require explicit operator intent when a different stored manager pane is still live.

## Context

Provider-context recovery verification is blocked by brittle q-manager parent pane ownership across compaction, restarts, and tmux pane replacement. The follow-up should determine current manager-pane state flow and define safe conditions for CLI adoption/rebinding from the current tmux pane.

## Brainstorm Artifact

- `context/brainstorms/2026-07-05_23-35-36_parent-pane-adoption.md` — full alignment rationale, code discovery, decision branches, and domain terms.

## Questions

1. How do `init`, `start-next`, `run-child`, `continue`, and `manager-ready` currently capture, persist, and prioritize explicit manager pane, stored manager pane, delivery manager pane, and `$TMUX_PANE`?
1. Which q-manager states make automatic current-pane adoption safe or necessary, including missing/dead stored pane, no stored pane, delivery `compacting`, queued wake, and manager pane missing during wake delivery?
1. How can q-manager reliably determine stored manager pane liveness with the existing `TmuxClient`/preflight abstractions, and what errors or non-tmux contexts must be handled?
1. What ambiguous live-parent cases exist when stored manager pane and current `$TMUX_PANE` differ, and what action-card evidence/safe commands should be emitted instead of silently rebinding?
1. What explicit override or adoption flags already fit q-manager CLI conventions, and should `--manager-pane` alone force rebind or require a separate adopt/force option?
1. Which regression tests and smoke docs should cover parent-pane adoption across `continue`, `start-next`, `manager-ready`, queued-wake flush, and native parent compaction interactions?

## Codebase References

- `cmd/vamos-runtime/internal/qrspicmd/root.go` — command wiring and current manager-pane capture/delivery/continue/start-next logic.
- `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go` — state initialization/resume for `start-next --state-file` and initial manager pane capture.
- `cmd/vamos-runtime/internal/qrspicmd/state.go` — manager state and delivery pane fields to preserve as local control state.
- `cmd/vamos-runtime/internal/qrspicmd/tmux.go` — `TmuxClient` operations, including `PaneExists`, for liveness checks.
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` and `manager_compaction_test.go` — queued wake, compacting, manager-ready, and delivery behavior tests.
- `.pi/extensions/q-manager-parent.ts` — parent Pi wrapper/native compaction behavior that should remain optional and compatible with CLI adoption.
- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/verify.md` — source verification blocker and accepted follow-up behavior.
