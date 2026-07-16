---
date: 2026-07-16T16:11:18-07:00
reviewer: CoreyCole
git_commit: 7ca824d7960e617861f647fd6314da34b2cff1fc
branch: main
repository: vamos
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
review_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/reviews/2026-07-16_16-11-18_q-manager-session-handoff-rotation_outline-review
review_mode: planning
review_kind: outline-review
reviewed_artifacts:
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/design.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/outline.md
status: complete
type: planning_review
verdict: correct
---

# Planning Review: q-manager session handoff rotation

## Summary

Post-edit design and outline are ready for tactical planning. Three vertical slices reuse merged child continuation, add manager same-pane rotation, then delete native compaction. One manager successor-lineage gap was fixed.

## Current Design / Plan

At configurable 75% `turn_end` usage, manager and child extensions persist one rotation request and steer the next turn into durable handoff work. Child handoff completion reuses merged same-node q-resume launch, delivery, and cleanup. Manager completion validates a dedicated operational handoff before exact-pane `/new`; fresh `session_start` claims the rotation, injects kickoff, and `agent_start` releases queued delivery. Final cleanup removes fixed 90% native compaction behavior and verifies repeated rotations.

## Requirements Alignment

- PRD/ticket requirements: aligned; no separate PRD. Durable handoff, fresh sessions, proactive manager/child monitoring, visible children, and no fabricated result are covered by `design.md` and `outline.md`.
- Brainstormed requirements and decisions: aligned with `context/brainstorms/2026-07-14_12-21-37_q-manager-session-handoff-rotation.md`; manager uses same-pane `/new`, children reuse fresh-pane q-resume, and steering occurs after the full tool batch.
- Research/design constraints: aligned with `research/2026-07-14_15-34-21_q-manager-session-handoff-rotation.md`, merged-baseline validation, and all four accepted ADRs. V1 explicitly accepts unknown usage and extreme-batch limitations without compaction fallback.

## Findings Summary

- Fixed one P1 successor-lineage hole: manager claim lacked Pi's predecessor session path, so it could not enforce the design invariant that the fresh `/new` session descends from the persisted source JSONL.

## Findings

### Finding 1: Manager claim could not authenticate predecessor session lineage

- Classification: obvious_doc_fix
- Priority: P1
- References: `design.md:164`; pre-edit `outline.md` manager claim options/CLI/hook; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:548-553`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session-runtime.ts:233-249`
- Issue: The design required the fresh claim to match the exact source session, but `ManagerRotationClaimOptions` and CLI accepted only rotation ID, pane, and successor JSONL. The runtime therefore had no predecessor value to compare with `SessionRotation.SourceSessionPath`.
- Example: If another `/new` occurred in the same pane while a replacing rotation and inherited process environment remained active, that unrelated fresh session could satisfy rotation/pane checks and claim the pending rotation.
- Resolution: Added `PreviousSessionPath`, `--previous-session-path`, explicit `event.previousSessionFile` forwarding/matching, and a mismatched-predecessor rejection test checkpoint. Promoted the lineage rule into plan `AGENTS.md`.

## Focused Review Lanes

- Selector run in outline mode. Subagent execution was unavailable in this session, so the main reviewer directly covered integration/operations, maintainability, Go interfaces, Go test checkpoints, project guidance, and docs health.
- SQL selector match was a prose false positive; design and outline explicitly exclude DB/schema work.

## Conflicting Guidance

- None.

## Applied Doc Edits

- `outline.md` — added predecessor JSONL to manager claim type/CLI, fresh-session hook, and rejection test.
- `AGENTS.md` — preserved exact `event.previousSessionFile` lineage invariant.

## Research Follow-up Needed

- None.

## Human Decisions Needed

- None.

## Follow-up Questions Doc

None.

## Verification

- Read root and plan `AGENTS.md`; no path-local guidance exists under `cmd/vamos-runtime/internal/qrspicmd`, `.pi/extensions`, `.pi/skills`, or `docs` beyond root guidance.
- Read current `state.go`, `options.go`, parent/child extensions, relevant `root.go` completion/delivery/compaction/ready paths, state-store operation locking, compaction/delivery tests, q-manager docs/skills, plan questions/research/brainstorm/design context, and ADRs.
- Read Pi extension lifecycle docs plus `SessionStartEvent` and `AgentSessionRuntime.newSession`; confirmed `/new` emits `previousSessionFile` for exact predecessor validation.
- Confirmed planned new `rotation.go` / `rotation_test.go` neighbors against current `root.go`, `state.go`, `options.go`, `manager_compaction_test.go`, `child_completion_test.go`, `delivery_test.go`, and `integration_test.go` package patterns.
- Re-read edited outline; slices remain vertical and the changed claim contract now satisfies design ownership invariants.

## Recommended Next Steps

Start `/q-plan` immediately from the reviewed outline; no additional approval or research gate.
