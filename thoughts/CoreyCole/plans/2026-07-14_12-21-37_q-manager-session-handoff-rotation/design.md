---
date: 2026-07-15T11:06:58-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
last_updated_at: 2026-07-16T16:02:04-07:00
git_commit: 7ca824d7960e617861f647fd6314da34b2cff1fc
branch: main
repository: vamos
stage: design
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
related_plans:
  - thoughts/CoreyCole/plans/2026-07-16_10-32-28_q-manager-handoff-auto-resume
related_adrs:
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/adrs/2026-07-15_11-06-58_durable-handoff-fresh-session-rotation.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/adrs/2026-07-15_11-06-58_turn-end-steering-at-75-percent.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/adrs/2026-07-15_11-06-58_asymmetric-manager-child-session-replacement.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/adrs/2026-07-15_11-06-58_graph-wide-agent-handoff.md
brainstorm_docs:
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/context/brainstorms/2026-07-14_12-21-37_q-manager-session-handoff-rotation.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/questions/2026-07-14_13-10-05_q-manager-session-handoff-rotation.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/research/2026-07-14_15-34-21_q-manager-session-handoff-rotation.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/context/design/2026-07-14_16-06-42_q-manager-session-handoff-rotation-design-brainstorm.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/context/outline/2026-07-16_16-02-04_merged-handoff-auto-resume-baseline.md
---

# Design: q-manager session handoff rotation

## Executive Summary

Add proactive context monitoring and manager-session rotation on top of the merged q-manager handoff auto-resume foundation.

Merged code already validates graph-wide handoffs, auto-launches one fresh same-node `q-resume` child in guided/autopilot, persists replacement lineage, delivers or queues the wake, and cleans the predecessor last. This plan must reuse that child continuation path rather than build another replacement state machine.

Remaining work: monitor manager and child Pi sessions at completed `turn_end`; at configurable 75% usage, persist one rotation request and steer the next turn into q-handoff. Child completion then flows through merged auto-resume. Manager completion validates an operational handoff, replaces the same-pane Pi session with built-in `/new`, injects exact continuation from fresh `session_start`, then releases queued wakes.

## Goals

- Request durable handoff before manager or child provider overflow.
- Reuse merged child auto-resume as the sole child replacement path.
- Replace native parent compaction with same-pane fresh manager sessions.
- Preserve one active owner, exact artifact context, inspectable predecessors, and recoverable failures.

## Non-Goals

- Reimplement graph-wide handoff, artifact validation, q-resume prompting, child launch lineage, wake retry, or pane cleanup.
- Auto-run normal `complete` transitions from `child-complete`.
- Exact next-payload token accounting, aggregate tool-output cap, or telemetry prerequisite.
- Upstream Pi API changes, child in-pane `/new`, hidden child execution, or fabricated QRSPI results.

## Merged Foundation

`q-manager-handoff-auto-resume` landed in `e6f1e1f..374f8d6`, with follow-up docs on current `main` `7ca824d`.

### Graph and handoff contract

- All 15 agent-owned ticket-level QRSPI nodes accept `StatusHandoff`; human-review/done reject it.
- Handoff remains same-node runtime continuation; guided/autopilot starts, discuss waits.
- Exact-node handoff frontmatter uses `status: in_progress`; result uses `status: handoff`, no outcome.
- `q-handoff` and `q-resume` enumerate every resumable node.

### Child continuation

- `RunChildComplete` validates the graph decision and in-plan handoff artifact.
- Artifact validation maps through source-child cwd, resolves symlinks, requires regular file under real `handoffs/`, exact source stage, and `in_progress` status.
- Per-state operation lock serializes `child-complete`, `continue`, and `manager-ready` mutation.
- Guided/autopilot persists same-node decision and source claim, launches a fresh q-resume child, and stores replacement lineage.
- Order is replacement durable → source validation status → wake delivered/queued → predecessor cleanup.
- Duplicate source callbacks recover the persisted continuation; wake/pane failures converge without duplicate launch.
- Replacement tmux splits target the stored manager pane.

### Existing parent behavior still to replace

- Parent usage is sampled only when `/q-manager start-next|continue` runs.
- Threshold remains fixed at 90%.
- CLI writes a manager operational handoff, marks delivery `compacting`, then the parent extension calls `ctx.compact()`.
- Fresh manager must manually run `manager-ready`.
- Generated operational handoff still describes compaction and lacks a proactive rotation identity.

### Existing child trigger gap

- Generated child extension invokes `child-complete` only from `agent_end`.
- It does not sample usage or steer a handoff at `turn_end`.
- Merged auto-resume solves continuation after a valid handoff, not proactive handoff creation.

## Desired End State

### Shared rotation request

Manager and child extensions use one CLI-owned request contract:

1. Observe completed `turn_end`.
1. Read `ctx.getContextUsage()`.
1. Ignore missing/null usage, below-threshold usage, stale owner, or existing pending rotation.
1. At configurable default 75%, acquire the existing state operation lock.
1. Persist one rotation ID, role, source identity, usage sample, threshold, and phase.
1. Return an exact role-specific handoff prompt.
1. Queue it once with `deliverAs: "steer"`.

The current assistant/tool batch always completes. Steering owns the next provider turn. Threshold is conservative policy, not a proof against one extreme parallel batch.

### Child rotation on merged auto-resume

1. Child `turn_end` requests rotation using state file + child ID/generation.
1. Child extension steers exact q-handoff stop-work instructions.
1. Child writes an exact-stage in-progress handoff and emits graph-valid `status: handoff`.
1. Existing `agent_end` → `RunChildComplete` validates it.
1. Merged auto-resume launches and persists one fresh same-stage q-resume child.
1. Existing durable wake and cleanup ordering applies.
1. Rotation state records successor-ready only when persisted lineage matches the requested source.

No second child launcher, replacement record, artifact validator, or wake protocol.

### Manager operational handoff

Use a dedicated lightweight manager handoff prompt/helper. Artifact contains:

- Durable refs: plan, current node, latest result/artifact, handoff path.
- Local labeled refs: state file, run/pane/session, active child output/status/done/session refs.
- Rotation ID and exact continuation instruction.

Local refs stay markdown-only; durable `qrspi_result` does not gain machine-local fields.

### Manager same-pane rotation

1. Manager `turn_end` persists a rotation request and steers manager-handoff work.
1. Manager writes operational handoff and final `status: handoff` YAML.
1. Settled parent extension asks CLI to validate expected result/artifact and mark handoff-ready.
1. CLI sets delivery replacing so child wakes queue.
1. CLI targets exact manager pane with `/new` + Enter once.
1. Pi tears down old extension runtime, creates fresh JSONL, reloads extensions, emits `session_start(reason: "new")`.
1. Fresh extension claims the expected pane/rotation and records successor session identity.
1. Extension injects exact manager handoff + continuation prompt.
1. Successor-start acknowledgement marks rotation successor-ready and flushes one lineage-current queued wake.

Never paste `/new` and kickoff back-to-back. `session_start` is the injection boundary. Predecessor JSONL remains inspectable.

## State and Ownership

Extend existing `ManagerState`; do not create a parallel store.

Rotation record needs:

- rotation ID and role (`manager` or `child`)
- source manager session or child ID/generation
- source graph node
- usage sample and configured threshold
- phase and timestamps
- handoff result/artifact
- successor session or child lineage
- last error

Phases: `requested` → `handoff_ready` → `replacing` → `successor_ready`; failures preserve phase evidence and refs.

Invariants:

- One pending rotation per role/source generation.
- Existing operation lock serializes request, completion, claim, ready, and wake mutation.
- Durable validated handoff before replacement.
- Child success is proven by merged continuation lineage.
- Manager fresh claim must match rotation ID and exact pane/source session.
- Stale session/child generation cannot clear newer rotation.
- Wakes queue while manager delivery is replacing and flush only after successor start acknowledgement.

## Failure Semantics

### Handoff cannot finish

No replacement. Preserve source session, rotation request, and terminal evidence. Existing provider-context recovery remains explicit; never compact or fabricate YAML.

### Child continuation fails

Use merged `invalid_handoff_artifact`, `handoff_continuation_failed`, queued wake, lineage recovery, and pending cleanup behavior. Rotation state only adds trigger/source evidence.

### Manager `/new` fails

Keep validated handoff and replacing/failed state. Keep queued wake. Action card supplies exact retry; do not issue another `/new` without checking rotation/source identity.

### Fresh manager claim or injection fails

Preserve handoff, predecessor/successor session refs, and queued wake. Retry claim/injection into the current same-pane session or expose deterministic recovery; do not mark ready early.

### Unknown usage

Continue without guessed percentage. Existing provider-context failure evidence remains authoritative.

## Patterns to Follow

- Merged operation lock, continuation lineage, wake retry, and cleanup convergence.
- Merged q-resume prompt with full prior YAML and exact handoff.
- Pi `turn_end` full-batch steering boundary.
- Pi `/new` lifecycle: old shutdown → runtime replacement → fresh `session_start`.
- Existing exact manager-pane targeting and manager pane adoption.

## Patterns to Avoid

- Reopening graph-wide handoff or child auto-resume design.
- Triggering from `agent_end` or using follow-up messages.
- Native compaction or child `/new`.
- Separate child rotation launcher/state machine.
- Blind `/new` + kickoff tmux paste.
- Wake flush before fresh manager claim and start acknowledgement.
- Result movement inferred from `next.steps` or child-emitted policy.

## Verification Strategy

### Shared request/extension

- Full parallel tool batch completes before one steering prompt.
- Exactly one request above threshold; below/null/pending suppress.
- Default 75% is configurable and persisted.
- Stale child/session identity cannot request or claim rotation.

### Child integration

- Triggered research/design/review/implementation handoff uses merged q-resume path.
- Existing artifact safety, operation-lock, duplicate callback, wake, and cleanup tests stay green.
- Rotation becomes successor-ready only from matching persisted continuation lineage.

### Manager rotation

- Operational handoff includes required durable and local refs plus rotation ID.
- Result/artifact validate before `/new`.
- Exact manager pane receives `/new` once.
- Fresh `session_start` injects exact handoff; old extension state is not reused.
- Wake remains queued until successor start acknowledgement.
- Duplicate/stale claim, `/new` failure, injection failure, and restart recovery preserve refs.

### Controlled tmux

Use a low threshold. Prove manager same-pane fresh JSONL and automatic continuation, child fresh-pane q-resume, repeated rotations without pane accumulation, valid stage completion, and inspectable predecessor sessions.

## Rollout

1. Treat merged auto-resume as prerequisite baseline; no duplicate graph/child work.
1. Add shared rotation state/request and child monitoring first.
1. Add manager operational handoff validation and same-pane fresh-session claim/injection.
1. Remove native parent compaction path and 90% terminology directly.
1. Update q-manager docs/skills and generated child extension together.
1. Run focused/race/build checks plus controlled manager/child tmux story.

## Decision

Build proactive 75% `turn_end` handoff requests and same-pane manager fresh-session rotation on top of merged graph-authorized child auto-resume. Child rotation ends at the existing `RunChildComplete` continuation transaction; only trigger metadata and manager lifecycle remain new.

## Resolved Decisions

- Durable handoff before fresh session; no compaction.
- Configurable 75% `turn_end` steering.
- Manager same-pane `/new`; child merged fresh-pane q-resume.
- Graph-wide handoff and child continuation are implemented baseline, not this plan's work.

## Open Questions

None blocking outline. Exact CLI command/type names and manager fresh-session binding belong in outline; no upstream Pi change is expected.
