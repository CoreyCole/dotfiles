---
date: 2026-07-05T23:51:24-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 424859bd6e6b79a07d290f1ed49799d913fa9c8e
branch: creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes
repository: vamos
stage: design
ticket: 'implementation-review follow-up: parent pane adoption'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
project: github.com/CoreyCole/vamos
related_projects: []
related_adrs:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/adrs/2026-07-05_23-51-24_safe-current-pane-adoption.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/adrs/2026-07-05_23-51-24_explicit-manager-pane-adoption-intent.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/adrs/2026-07-05_23-51-24_dead-pane-wake-queues.md
brainstorm_docs:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/context/brainstorms/2026-07-05_23-35-36_parent-pane-adoption.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/context/design/2026-07-05_23-51-24_parent-pane-adoption-design-brainstorm.md
---

# Design: q-manager parent pane adoption

## Executive Summary

Make q-manager parent pane role recoverable from normal tmux CLI commands. Add shared manager-pane adoption logic for loaded-state `start-next`, `continue`, and `manager-ready`. Auto-adopt current `$TMUX_PANE` only when safe: no stored pane, old pane dead, delivery compacting, queued wake, or unavailable delivery pane. For live different old parent, stop with action card unless operator passes explicit `--manager-pane`. Product design not warranted: internal recovery/runtime fix.

## Current State

- Local state owns parent pane refs: `ManagerState.ManagerPaneID` and `ManagerDeliveryState.ManagerPaneID`. `cmd/vamos-runtime/internal/qrspicmd/state.go:8-29`.
- Capture helper prefers explicit pane then `$TMUX_PANE`. `cmd/vamos-runtime/internal/qrspicmd/root.go:3985-3989`.
- `init` and first-run `start-next` persist captured manager pane. `cmd/vamos-runtime/internal/qrspicmd/root.go:94-101`; `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:31-70`.
- `start-next --state-file --manager-pane` loads state but ignores manager-pane for rebind. `cmd/vamos-runtime/internal/qrspicmd/root.go:128-153`; `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:16-29`.
- `continue` has no `--manager-pane`; normal graph advance cannot explicitly adopt replacement pane. `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`; `cmd/vamos-runtime/internal/qrspicmd/options.go:571-581`.
- `RunChild` prefers explicit, stored, then current env; writes state only when stored pane was empty. `cmd/vamos-runtime/internal/qrspicmd/root.go:1359-1367`.
- Wake delivery targets `Delivery.ManagerPaneID` before `ManagerPaneID`. `cmd/vamos-runtime/internal/qrspicmd/root.go:1948-1952`.
- Wake delivery queues for `Delivery.Status=compacting` and missing pane ID. `cmd/vamos-runtime/internal/qrspicmd/root.go:1912-1939`.
- Wake delivery pastes without liveness check; dead pane returns paste error. `cmd/vamos-runtime/internal/qrspicmd/root.go:1940-1945`.
- `manager-ready --manager-pane` already writes both pane refs and flushes queued wake. `cmd/vamos-runtime/internal/qrspicmd/root.go:2331-2422`.
- `TmuxClient.PaneExists` exists and preflight uses it for manager pane liveness. `cmd/vamos-runtime/internal/qrspicmd/options.go:663-668`; `cmd/vamos-runtime/internal/qrspicmd/preflight.go:104-142`.
- Action-card shape can carry evidence, recommended action, safe command, continue command, and `RequiresHuman`. `cmd/vamos-runtime/internal/qrspicmd/options.go:186-195`; `cmd/vamos-runtime/internal/qrspicmd/root.go:3530-3554`.

## Desired End State

- Running `vamos qrspi continue --state-file ...` inside tmux can adopt current pane when old parent is unavailable or q-manager state says delivery needs a current manager.
- Running `vamos qrspi start-next --state-file ... --manager-pane ...` actually rebinds the loaded state before preflight/launch.
- Running `vamos qrspi continue --state-file ... --manager-pane ...` explicitly rebinds parent ownership before validation/next launch.
- Running `manager-ready` keeps its current explicit/current pane flush behavior but shares the same adoption decisions and diagnostics.
- Dead/unavailable manager pane during wake delivery queues current-generation wake, records evidence, and points at safe recovery command.
- Ambiguous live-parent conflict produces action card, not silent env takeover.
- Pane refs remain local state only; durable QRSPI YAML stays unchanged.

## Patterns to Follow

- Use local `ManagerState` / `ManagerDeliveryState` for ephemeral control refs. `cmd/vamos-runtime/internal/qrspicmd/state.go:8-29`.
- Use `PaneExists` abstraction for tmux liveness, same pattern as preflight and child health. `cmd/vamos-runtime/internal/qrspicmd/preflight.go:104-142`; `cmd/vamos-runtime/internal/qrspicmd/child_health.go:90-96`.
- Use action cards for safe operator recovery commands. `cmd/vamos-runtime/internal/qrspicmd/options.go:186-195`; `cmd/vamos-runtime/internal/qrspicmd/preflight.go:263-270`.
- Preserve queued wake generation safety. `cmd/vamos-runtime/internal/qrspicmd/root.go:2395-2405`.
- Keep `manager-ready` as the explicit queued-wake flush command. `cmd/vamos-runtime/internal/qrspicmd/root.go:2331-2422`.

## Patterns to Avoid

- Do not put manager pane IDs in `qrspi_result`; they are local control state, not durable artifact identity.
- Do not infer parent pane from child-side `child-complete`; current pane there may be the child.
- Do not make Pi wrapper/native compaction required for CLI recovery. `.pi/extensions/q-manager-parent.ts:123-207`.
- Do not silently steal manager role from a different live old parent via env-only `$TMUX_PANE`.
- Do not bubble raw tmux paste errors for dead manager pane when q-manager can queue and recover.

## Recommended Approach

Add a small shared manager-pane adoption layer inside `qrspicmd`.

It decides from:

- explicit manager pane argument
- current env pane from `CaptureManagerPaneID("")`
- `state.ManagerPaneID`
- `state.Delivery.ManagerPaneID`
- `state.Delivery.Status`
- `state.Delivery.QueuedWake`
- tmux liveness for stored/delivery/current panes

It returns:

- updated state when adoption/rebind should happen
- action card when env-only adoption would steal from live old parent
- evidence for diagnostics/tests
- selected pane for delivery/flush when needed

Apply it in three command paths:

1. `RunStartNext` after loaded state, before state-file preflight and active-child checks.
1. `RunContinue` after state load/model update, before active-child health/validation.
1. `RunManagerReady` before flushing queued wake, preserving existing explicit/current behavior.

Add `--manager-pane` to `continue`. Existing `--manager-pane` on state-file `start-next` becomes effective. No new `--force-manager-pane` yet.

### Safe auto-adoption predicates

Auto-adopt current env pane when all are true:

- current env pane non-empty
- no explicit pane needed
- at least one safe condition:
  - stored manager pane blank
  - selected stored/delivery pane dead or missing
  - delivery status `compacting`
  - queued wake exists
  - delivery pane missing/unavailable and wake delivery needs manager
- no different live stored/delivery parent that would be silently stolen, unless delivery is compacting/queued and old pane is unavailable by liveness check

Explicit `--manager-pane` may rebind even when old pane is live. That is operator intent.

### Rebind behavior

When adopting/rebinding:

- Set `state.ManagerPaneID = adoptedPane`.
- Set `state.Delivery.ManagerPaneID = adoptedPane` when:
  - explicit pane supplied
  - delivery status is `compacting`
  - queued wake exists
  - old delivery pane is blank/dead/unavailable
  - delivery pane differs from manager pane and is the selected stale target
- Save state before continuing command-side work.

### Action-card behavior

When current env pane differs from a live stored/delivery pane and no explicit pane was supplied:

- `Kind`: new manager-pane action, e.g. `manager_pane_adoption_required`.
- `Severity`: warning.
- `RequiresHuman`: false; operator action required but deterministic.
- Evidence:
  - state file
  - stored manager pane
  - delivery manager pane
  - current `$TMUX_PANE`
  - liveness results
  - delivery status
  - queued wake presence
- Safe command:
  - `vamos qrspi continue --state-file <state> --manager-pane "$TMUX_PANE"` for continue context.
  - `vamos qrspi start-next --state-file <state> --manager-pane "$TMUX_PANE"` for start-next context.
  - `vamos qrspi manager-ready --state-file <state> --manager-pane "$TMUX_PANE"` for queued flush context.

### Wake delivery behavior

Before `pasteWake`:

- Check `PaneExists` for selected delivery pane.
- If unavailable, store `Delivery.QueuedWake` with reason `manager_pane_unavailable` / `manager_pane_dead`.
- Record action-card evidence with safe `manager-ready --manager-pane "$TMUX_PANE"` or current command context.
- Do not infer current env pane in delivery path.

Representative code:

```go
adoption, err := ResolveManagerPaneAdoption(ctx, state, ManagerPaneAdoptionOptions{
    ExplicitPane: opts.ManagerPane,
    CurrentPane:  CaptureManagerPaneID(""),
    Command:      "continue",
}, d)
if err != nil { return err }
if adoption.ActionCard != nil { save; return writeManagerActionCard(out, *adoption.ActionCard, opts.Output) }
if adoption.Changed { state = adoption.State; save }
```

## Decision

Going with shared safe adoption helper + explicit `--manager-pane` rebind + dead-pane queue. This uses existing state/action-card/tmux primitives and fixes both command recovery and wake delivery without new durable schema or hidden runners.

## Resolved Decisions

- Safe current-pane adoption belongs in shared command helper. See [`adrs/2026-07-05_23-51-24_safe-current-pane-adoption.md`](adrs/2026-07-05_23-51-24_safe-current-pane-adoption.md).
- Existing `--manager-pane` is explicit adoption intent; add it to `continue`. See [`adrs/2026-07-05_23-51-24_explicit-manager-pane-adoption-intent.md`](adrs/2026-07-05_23-51-24_explicit-manager-pane-adoption-intent.md).
- Dead/unavailable wake target queues instead of hard failing paste. See [`adrs/2026-07-05_23-51-24_dead-pane-wake-queues.md`](adrs/2026-07-05_23-51-24_dead-pane-wake-queues.md).

## ADR Candidate Disposition

- Accepted as ADR: manager-pane adoption as local control-state operation with safe auto-adoption and action-card fallback.
- Accepted as ADR: plain CLI liveness independent of Pi extension/native compaction.
- Accepted as ADR: dead pane wake queues; child-side delivery does not adopt current pane.
- Resolved without ADR: no new adopt/force flag now; captured by explicit `--manager-pane` ADR.
- Deferred: richer tmux unavailable error preservation from `PaneExists`; useful but not required for blocker.

## Test / Verification Direction

- Unit: helper auto-adopts when no stored pane and current env exists.
- Unit: helper auto-adopts when stored pane dead and current env exists.
- Unit: helper does not env-adopt when stored different pane is live; writes action card.
- Unit: explicit `--manager-pane` rebinds even when stored different pane is live.
- Command: `continue --manager-pane` updates `ManagerPaneID` and launches next child with adopted parent.
- Command: `start-next --state-file --manager-pane` updates loaded state before preflight/launch.
- Delivery: selected pane dead -> queued wake, no paste error, safe command evidence.
- Manager-ready: current/explicit pane flushes queued wake and writes both pane refs.
- Smoke docs: parent replacement recovery command from new tmux pane; compacting queued wake flush.

## Open Questions

- None blocking design.
