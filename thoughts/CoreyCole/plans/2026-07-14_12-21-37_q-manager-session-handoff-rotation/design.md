---
date: 2026-07-15T11:06:58-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: f61af15238c679df46583495971e2841e30dcc8c
branch: main
repository: vamos
stage: design
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
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
---

# Design: q-manager session handoff rotation

## Executive Summary

Replace q-manager parent compaction and reactive child exhaustion as normal continuity with proactive durable handoff plus fresh Pi session.

Managed manager/child extensions sample usage at completed `turn_end`. At configurable 75%, one persisted rotation intent queues q-handoff work as steering. Current tool batch finishes; handoff owns the next turn.

After artifact/result validation, manager rotates in-place with built-in `/new`; child reuses q-manager's fresh-pane launch/save/close flow. Every QRSPI Agent node accepts same-node handoff.

Risk: one extreme parallel batch can jump past reserve. V1 stays simple: early threshold, current truncation, explicit exhaustion recovery, no compaction or fabricated result.

## Goals

- Rotate before overflow through durable QRSPI handoff.
- Auto-start exact-context successor; preserve inspectable predecessor history and one active owner.
- Allow handoff from every managed Agent node.

## Non-Goals

- Exact token accounting, aggregate output cap, or upstream Pi API.
- Identical role mechanics, hidden execution, or runtime-authored result.
- Product-design graph changes; latest QRSPI makes it standalone.

## Current State

### Pi

- Assistant plus full tool batch completes before `turn_end`; steering is polled before next provider call. `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:224-259`.
- `getContextUsage()` estimates transcript usage, not exact next payload. `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:3078-3119`.
- `sendUserMessage(..., {deliverAs: "steer"})` enters steering while streaming. `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1431-1471`.
- Built-in `/new` awaits runtime session replacement. `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:5833-5847`.

### Manager

- Parent samples usage only during direct `/q-manager start-next|continue`. `.pi/extensions/q-manager-parent.ts:33-64`.
- Threshold writes manager handoff, marks `compacting`, then calls `ctx.compact()`. `cmd/vamos-runtime/internal/qrspicmd/root.go:2230-2285`; `.pi/extensions/q-manager-parent.ts:226-237`.
- Generated manager handoff lacks some session/output/validation refs required by skill. `cmd/vamos-runtime/internal/qrspicmd/root.go:2350-2446`.
- Manager pane adoption and queued wake flush already exist.

### Child and graph

- Child extension reacts only at `agent_end`. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75-109`.
- Valid continuation launches/saves replacement before old-pane cleanup. `cmd/vamos-runtime/internal/qrspicmd/root.go:3428-3477`; `cmd/vamos-runtime/internal/qrspicmd/root.go:4195-4230`.
- Child prompt already carries graph skill, exact artifact, full prior YAML. `cmd/vamos-runtime/internal/qrspicmd/prompt.go:38-78`.
- Runtime handoff already means same-node continuation. `pkg/agents/workflows/runtime/transition.go:71-83`.
- Local graph allows handoff only on implement/verify. `pkg/agents/workflows/qrspi/definition_agentchat.go:91-101`.

## Desired End State

### Shared monitor

Every managed session:

1. Observe completed `turn_end`.
1. Read estimated usage.
1. Ignore below threshold, unknown usage, or pending rotation.
1. At threshold, persist one rotation intent.
1. Queue exact handoff instruction as steering.
1. Allow only handoff creation to continue.
1. Validate durable handoff result.
1. Replace through role-specific path.
1. Inject exact handoff before successor work.
1. Clear pending state after successor claim/start.

Representative direction:

```ts
pi.on("turn_end", (_event, ctx) => {
  const usage = ctx.getContextUsage();
  if (!rotationPending && usage?.percent !== null && usage.percent >= threshold) {
    rotationPending = true;
    persistRotationIntent();
    pi.sendUserMessage(handoffPrompt, { deliverAs: "steer" });
  }
});
```

Outline owns exact state/types.

### Steering and reserve

- Steering, never follow-up.
- Current assistant/tool batch always finishes.
- Handoff becomes next user message before normal continuation.
- q-handoff stop-work limits work to checkpoint creation.
- Final YAML/no-tool response ends naturally.
- Configurable default: 75% for manager and child.
- No model table, aggregate cap, or telemetry prerequisite in v1.
- Unknown usage does not trigger.
- Existing provider-exhaustion recovery remains explicit failure path.
- Threshold is conservative, not a safety proof.

### Child handoff contract

- Standard artifact under plan `handoffs/`.
- Stage remains current node.
- `status: handoff`; no outcome.
- Handoff/checkpoint is primary artifact.
- `next.steps` load q-resume plus exact stage context.
- q-manager validates before replacement.

### Manager handoff contract

Dedicated lightweight manager wrapper:

- Durable refs: plan, node, latest result/artifact.
- Local refs: state, pane, session, output/status/done paths.
- Exact continuation/ready instruction.
- Local refs stay markdown-only, not structured YAML.
- Parent validates expected manager handoff before `/new`.

### Manager rotation

1. Monitor queues manager-handoff steering.
1. Agent writes operational handoff and final YAML.
1. Settled extension asks CLI to validate/persist readiness.
1. Delivery enters `rotating`; child wakes queue.
1. CLI sends `/new` + Enter to exact manager pane.
1. Pi replaces session/runtime; pane stays stable.
1. Fresh extension `session_start` claims rotation ID.
1. Extension records new session identity.
1. Extension injects full handoff YAML/path.
1. Delivery becomes ready; one current wake flushes.

Never paste `/new` and kickoff back-to-back. Fresh `session_start` is injection boundary. Old JSONL stays inspectable; old extension runtime is invalidated.

### Child rotation

1. Monitor queues stage handoff steering.
1. Child writes handoff/final YAML.
1. `agent_end` validates through child completion.
1. Runtime decides same-node continuation.
1. q-manager renders exact handoff/full-YAML prompt.
1. q-manager launches fresh pane/process/session with correct stage/cwd/env.
1. New child becomes `ActiveChild`.
1. q-manager closes predecessor pane.
1. Cleanup failure preserves predecessor ref.

Do not use child `/new`: process env binds child/stage/cwd/session/path/wake refs; in-place replacement creates stale control state.

### Graph-wide handoff

Add `StatusHandoff` to every ticket-level Agent node:

- question, research, design
- outline, review-outline
- research/address-review-research-outline
- plan, review-plan
- research/address-review-research-plan
- workspace, implement
- review-implementation, verify

Exclude human-review and done nodes.

q-resume becomes stage-aware for every Agent node. Handoff artifact is read explicitly; full prior YAML stays verbatim. Existing human-created product design remains optional context only.

## State and Ownership

Persist one rotation record:

- role and rotation ID
- expected node/child generation
- usage sample and threshold
- phase
- handoff artifact/result
- predecessor/successor session identity
- timestamps and last error

Phases: requested → handoff-ready → replacing → successor-ready; failure records error without erasing refs.

Invariants:

- One pending rotation per role/session generation.
- Durable handoff before replacement.
- Child successor saved before predecessor close.
- Manager `session_start` must match rotation ID.
- Wakes queue during manager replacement.
- Stale generation/rotation cannot clear newer state.

## Failure Semantics

### Handoff cannot finish

No rotation. Preserve predecessor evidence. Surface exhaustion/invalid-result recovery. Never compact or fabricate YAML.

### Manager `/new` or injection fails

Keep handoff and pending/failed rotation. Keep queued wake. Action card gives exact retry. Do not flush wake before fresh claim/injection succeeds.

### Child launch or cleanup fails

Launch failure keeps predecessor; relaunch same node from validated handoff. Cleanup failure leaves successor active and pending-cleanup ref; old generation cannot deliver accepted wake.

### Unknown usage

Continue without guessed percentage. Existing provider-context evidence drives recovery.

## Patterns to Follow

- Pi full-turn steering boundary. `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:224-259`.
- q-manager replacement-before-retirement. `cmd/vamos-runtime/internal/qrspicmd/root.go:3428-3477`.
- Generic same-node handoff. `pkg/agents/workflows/runtime/transition.go:71-83`.
- Full prior-YAML prompt. `cmd/vamos-runtime/internal/qrspicmd/prompt.go:38-78`.
- Exact tmux pane targeting. `cmd/vamos-runtime/internal/qrspicmd/tmux.go:34-47`.
- Existing generation/delivery suppression.

## Patterns to Avoid

- `agent_end` trigger or `followUp` handoff.
- Native compaction or blind `/new` + kickoff race.
- Child `/new` with stale env.
- Fabricated result or stage handoff exemption.
- Duplicate rotation IDs/retries.

## Verification Strategy

### Extension

- Parallel batch finishes before steering.
- Exactly one trigger above threshold.
- Below/unknown usage does not trigger.
- Pending state suppresses duplicates.
- Fresh manager session injects exact handoff.
- Stale session start cannot claim newer rotation.

### Graph/runtime

- Enumerate every Agent node; handoff accepted.
- Human/done reject handoff.
- Same node remains pending/idle.
- Guided auto-starts; discuss leaves pending.

### q-manager

- Manager handoff contains all required refs.
- Wake queues during replacement.
- `/new` targets exact pane once.
- Fresh claim precedes wake flush.
- Child successor save precedes close.
- Launch/cleanup failure preserves refs.
- Stale generation/wake suppressed.

### Controlled tmux

Use low test threshold. Confirm durable handoff, manager same-pane new session with automatic injection, child fresh pane with old-pane cleanup, same-node resume, valid completion, inspectable old JSONL.

## Rollout

- Replace manager compaction directly; no compatibility mode.
- Keep reactive exhaustion action card.
- Expose 75% through normal q-manager config/CLI.
- Update graph contracts before monitor activation.
- Update skills and generated child extension together.
- Run focused graph/runtime tests, then controlled tmux story.

## Decision

Use proactive `turn_end` steering into durable q-handoff, then role-specific fresh-session replacement. Reuses proven q-manager child lifecycle and Pi `/new`; keeps graph/artifacts authoritative; avoids upstream complexity.

## Resolved Decisions

- Durable handoff before fresh session; no compaction. See [`adrs/2026-07-15_11-06-58_durable-handoff-fresh-session-rotation.md`](adrs/2026-07-15_11-06-58_durable-handoff-fresh-session-rotation.md).
- Configurable 75% `turn_end` steering. See [`adrs/2026-07-15_11-06-58_turn-end-steering-at-75-percent.md`](adrs/2026-07-15_11-06-58_turn-end-steering-at-75-percent.md).
- Manager same-pane `/new`; child fresh-pane replacement. See [`adrs/2026-07-15_11-06-58_asymmetric-manager-child-session-replacement.md`](adrs/2026-07-15_11-06-58_asymmetric-manager-child-session-replacement.md).
- Handoff on every Agent node. See [`adrs/2026-07-15_11-06-58_graph-wide-agent-handoff.md`](adrs/2026-07-15_11-06-58_graph-wide-agent-handoff.md).

## ADR Candidate Disposition

- Accepted: durable handoff/fresh session; threshold; role-specific replacement; graph-wide handoff.
- Resolved without ADR: manager wrapper; upstream Pi API unnecessary.
- Deferred: aggregate output cap and telemetry tuning.

## Open Questions

None blocking outline. V1 accepts conservative-not-guaranteed reserve semantics.
