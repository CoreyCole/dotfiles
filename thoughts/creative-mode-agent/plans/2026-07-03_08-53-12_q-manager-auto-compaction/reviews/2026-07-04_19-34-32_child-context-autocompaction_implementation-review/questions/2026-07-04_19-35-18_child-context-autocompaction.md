---
date: 2026-07-04T19:36:25-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 184fa8f9f7558eaf4a29fd50c9dafcfbd5a7ac0d
branch: creative-mode-agent/q-manager-auto-compaction_review-fixes
repository: vamos
stage: question
ticket: 'implementation review follow-up: q-manager child context exhaustion'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
question_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/questions/2026-07-04_19-35-18_child-context-autocompaction.md
brainstorm_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/context/brainstorms/2026-07-04_19-35-18_child-context-autocompaction.md
prev_question_docs: []
---

# Research Questions: q-manager child context exhaustion recovery

## Brainstorm Summary

- Desired outcome: q-manager child sessions either compact before model context failure or surface deterministic manager-needed recovery when provider context errors occur.
- Scope: child JSONL provider-error detection, stale validation replacement, duplicate-delivery bypass for later terminal errors, manager action card/wake, safe recovery commands, and regression tests.
- Distinction to preserve: parent manager compaction is already handled by the Pi parent wrapper; this follow-up owns child-session context exhaustion and recovery.
- Constraints: do not invent QRSPI results, preserve child/session refs and latest-session recovery paths, keep reusable Vamos code free of host-private paths, and do not let stale runtime cache outrank latest session evidence.
- Open tension: child auto-compaction depends on Pi child-session capabilities; if unavailable or unreliable, terminal provider-error detection and recovery wake become mandatory fallback.

## Context

Parent q-manager auto-compaction verification is blocked by live child Pi sessions reaching provider context-window errors after useful verification work. The runtime can leave stale `validation-status.json`, suppress a later terminal error as `duplicate_delivery`, and classify latest sessions as success-needing-validation instead of recoverable child context exhaustion.

## Brainstorm Artifact

- `context/brainstorms/2026-07-04_19-35-18_child-context-autocompaction.md` — source evidence, alignment, decision branches, and design rationale.

## Questions

1. How do q-manager child Pi sessions currently get launched, instrumented, and completed, and where can child-side context usage, compaction, or terminal provider-error hooks be observed?
1. What exact Pi JSONL shapes are produced for provider context-window failures, aborted turns, compaction failures, and normal assistant results, and which current parsers miss those shapes?
1. How do `child-complete`, `continue`, `inspect`, `validate-latest`, and `recover-manual` currently classify no-result child sessions, write `validation-status.json`, and choose action cards?
1. How are child generations, steering/rebinding, delivery IDs, and duplicate suppression updated after a manager steers the same child following an earlier valid result?
1. What recovery commands are safe and deterministic when latest child evidence shows context exhaustion but no valid `qrspi_result`, and what evidence must the manager wake/action card include?
1. What tests already cover child context exhaustion, duplicate delivery suppression, session-result parsing, and latest-session recovery, and what regression fixture is missing for valid result -> steer -> later provider context error?
1. What Pi APIs or runtime settings, if any, can enable automatic child compaction before provider context failure for sessions launched with `--extension`, `--session-id`, `--session-dir`, and q-manager environment variables?

## Codebase References

- `cmd/vamos-runtime/internal/qrspicmd/child.go` — child Pi command/env construction, session IDs/dirs, extension injection.
- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js` — Pi `agent_end` hook that invokes `qrspi child-complete` and writes child status diagnostics.
- `cmd/vamos-runtime/internal/qrspicmd/session_result.go` — Pi JSONL session resolution and assistant text extraction.
- `cmd/vamos-runtime/internal/qrspicmd/child_health.go` — active-child health classification, context-exhaustion evidence checks, inspect action-card inputs.
- `cmd/vamos-runtime/internal/qrspicmd/root.go` — `RunChildComplete`, validation status writing, wake delivery, delivery IDs, duplicate suppression, and child context action card construction.
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` — latest-session discovery, inspect, validate-latest, rebind, and recover-manual flows.
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` — existing context-exhaustion/no-result and continue action-card coverage.
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` — existing child-complete, validation status, delivery, and duplicate wake coverage.
- `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go` — existing JSONL result extraction fixtures.
- `.pi/extensions/q-manager-parent.ts` — parent-only compaction wrapper; useful contrast for child capability research.
- `docs/q-manager.md` — documented q-manager child validation, parent compaction, action-card, and recovery contracts.
