---
date: 2026-07-05T23:43:28-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 424859bd6e6b79a07d290f1ed49799d913fa9c8e
branch: creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes
repository: vamos
stage: research
ticket: 'implementation-review follow-up: parent pane adoption'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
project: github.com/CoreyCole/vamos
related_projects: []
---

# Research: q-manager parent pane adoption

## Brainstorm Summary

- Desired outcome carried forward: normal tmux CLI `continue` / `start-next` can recover q-manager parent role by adopting current `$TMUX_PANE` when safe.
- Scope carried forward: parent/manager pane capture, delivery pane selection, queued wake/compacting behavior, explicit override UX, action-card stops, tests/docs.
- Constraints carried forward: pane refs remain local control state; do not put them in durable `qrspi_result`; preserve visible child sessions and graph authority; keep Pi native compaction optional.
- Tradeoff carried forward: auto-adopt dead/stale/compacting states for recovery, but require explicit operator intent when a different stored manager pane is still live.

## Research Question

Answers `questions/2026-07-05_23-35-36_parent-pane-adoption.md`: current manager-pane capture/persistence/priority, safe adoption states, tmux liveness primitives, ambiguous live-parent cases, existing override flag conventions, and regression/smoke coverage.

## Evidence Boundary

Use `AGENTS.md` and the question doc as framing only. Facts below are grounded in current code/docs/tests at commit `424859bd6e6b79a07d290f1ed49799d913fa9c8e` with file:line references.

## Summary

Current q-manager stores parent pane identity only in local manager state (`ManagerPaneID`) and delivery state (`Delivery.ManagerPaneID`), captures explicit `--manager-pane` before `$TMUX_PANE`, and delivers wakes to `Delivery.ManagerPaneID` before `ManagerPaneID`. `manager-ready` can rebind both stored fields from an explicit/current pane and flush queued wakes. `continue` has no manager-pane flag or adoption path, `start-next --state-file` does not use its `--manager-pane` to update an existing state, and wake delivery does not check parent-pane liveness before paste. Existing `PaneExists`/preflight APIs can report dead panes, but current resume paths mostly do not act on that report for manager-pane recovery.

## Detailed Findings

### 1. Current capture, persistence, and priority by command

- Local manager pane state is in `ManagerState.ManagerPaneID`; delivery-specific pane state is in `ManagerDeliveryState.ManagerPaneID`; queued wake payloads are local delivery state, not durable QRSPI YAML. — `cmd/vamos-runtime/internal/qrspicmd/state.go:8-29`
- Pane capture uses explicit input first, then `$TMUX_PANE`; tests assert explicit beats env and env is used when explicit is blank. — `cmd/vamos-runtime/internal/qrspicmd/root.go:3985-3989`, `cmd/vamos-runtime/internal/qrspicmd/root_test.go:89-97`
- `init` exposes `--manager-pane` and saves `state.ManagerPaneID = CaptureManagerPaneID(opts.ManagerPane)`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:94-101`, `cmd/vamos-runtime/internal/qrspicmd/root.go:574-581`
- `start-next` exposes `--manager-pane`, but when `--state-file` is present `resolveOrInitStartState` loads state and only applies `PiModel`; it does not apply `opts.ManagerPane` to the loaded state. — `cmd/vamos-runtime/internal/qrspicmd/root.go:128-153`, `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:16-29`
- First-run `start-next` without `--state-file` initializes state through the same capture path as `init`; tests assert `ManagerPaneID == "%parent"` after first launch. — `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:31-70`, `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go:13-42`
- `start-next --state-file` checks preflight with the stored `state.ManagerPaneID`, but the resume path only converts Pi compatibility failures into action cards; it does not stop or rebind on `preflight.Tmux` failure there. — `cmd/vamos-runtime/internal/qrspicmd/root.go:659-681`
- `start-next` launches `RunChild` without passing `opts.ManagerPane`; therefore existing-state launches rely on `RunChild`'s state/env fallback rather than the `start-next --manager-pane` flag. — `cmd/vamos-runtime/internal/qrspicmd/root.go:768-778`
- `run-child` exposes `--manager-pane`; inside `RunChild`, priority is explicit `opts.ManagerPane`, then stored `state.ManagerPaneID`, then `$TMUX_PANE`; the state is updated only when a parent pane exists and `state.ManagerPaneID` was empty. — `cmd/vamos-runtime/internal/qrspicmd/root.go:209-233`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1359-1367`
- `RunChild` passes the selected parent pane into `ChildRunRequest.ParentPaneID`, and `BuildChildCommand` exposes it to the child extension as `Q_MANAGER_PARENT_PANE`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1394`, `cmd/vamos-runtime/internal/qrspicmd/child.go:25`, `cmd/vamos-runtime/internal/qrspicmd/child.go:150`
- `continue` exposes no `--manager-pane` flag and `ContinueOptions` has no manager-pane field. — `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`, `cmd/vamos-runtime/internal/qrspicmd/options.go:571-581`
- `continue` starts the next child through `RunChild` without passing a manager pane, so next-child launch after validation uses stored `ManagerPaneID` or `$TMUX_PANE` only if stored pane is blank. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2884-3024`, `cmd/vamos-runtime/internal/qrspicmd/root.go:3277-3287`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1359-1367`
- `manager-ready` exposes `--manager-pane`; `RunManagerReady` uses explicit pane or `$TMUX_PANE`, sets `Delivery.Status = "ready"`, and when pane is non-empty writes both `Delivery.ManagerPaneID` and `ManagerPaneID` before flushing queued wake. — `cmd/vamos-runtime/internal/qrspicmd/root.go:249-264`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2331-2356`
- Wake delivery prioritizes `Delivery.ManagerPaneID` over `ManagerPaneID`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1948-1952`

### 2. States that currently queue, deliver, or can be safely identified

- If `Delivery.Status == "compacting"`, `queueOrDeliverWake` stores `Delivery.QueuedWake` and returns wake mode `queue` with reason `manager_compacting`; it does not paste to the parent. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1912-1924`
- If no delivery pane can be selected, `queueOrDeliverWake` stores `Delivery.QueuedWake` and returns wake mode `queue` with reason `manager_pane_missing`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1926-1939`
- If a pane ID is selected, `queueOrDeliverWake` calls `pasteWake`; it does not call `PaneExists` first and returns paste errors directly. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1940-1945`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1958-1967`
- `manager-ready` can flush a queued wake to the explicit/current pane first; if no pane is supplied it falls back to `managerDeliveryPane`, and if still blank it errors `manager pane is required to flush queued wake`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2380-2422`
- `flushQueuedWake` suppresses stale queued wakes when child generation differs, or when the active child is still `running`/`manual_reprompt`; it records a `superseded_queued_wake` action card. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2395-2405`
- Tests cover queue-while-compacting and flush-to-new-parent behavior: `RunManagerReady(... ManagerPane: "%new-parent")` flushes one queued wake and updates delivery state. — `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:138-207`
- Manager compaction marks delivery `compacting` and captures the current `ManagerPaneID` into `Delivery.ManagerPaneID` if delivery pane is blank. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2150-2156`
- Manager compaction tests assert queue safety: threshold writes handoff, marks `Delivery.Status == "compacting"`, emits a `manager-ready` command, queues child completion, and later flushes through `RunManagerReady`. — `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:60-119`, `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:203-273`
- Current code has facts for these adoption-relevant states: no stored pane, delivery `compacting`, queued wake present, and stale queued wake generation mismatch. Current code does not yet contain a shared adoption decision helper for these states; the only write path that updates a non-empty stored manager pane from current tmux is `RunManagerReady`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2331-2356`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2380-2422`

### 3. Tmux liveness primitives and non-tmux behavior

- `TmuxClient` already includes `PaneExists(ctx, pane)` beside split, paste, kill, and layout operations. — `cmd/vamos-runtime/internal/qrspicmd/options.go:663-668`
- `ShellTmuxClient.PaneExists` returns `(false, nil)` for blank pane IDs and also returns `(false, nil)` for any `tmux display-message -p -t <pane> #{pane_id}` failure; it does not preserve the underlying tmux error. — `cmd/vamos-runtime/internal/qrspicmd/tmux.go:66-73`
- `CheckTmuxAvailable` skips liveness checks when no manager pane is configured, otherwise calls `PaneExists`; it reports `OK=false` and evidence `manager pane unavailable: <err>` when pane does not exist or an error occurs. — `cmd/vamos-runtime/internal/qrspicmd/preflight.go:104-119`
- `CheckQRSPIPreflight` includes tmux health with `firstNonEmpty(opts.ManagerPaneID, state.ManagerPaneID)`, so callers can choose explicit candidate before stored state. — `cmd/vamos-runtime/internal/qrspicmd/preflight.go:132-142`
- Active child health already uses `PaneExists` to classify a child pane as missing, proving the abstraction is used for pane liveness elsewhere in q-manager. — `cmd/vamos-runtime/internal/qrspicmd/child_health.go:90-96`
- `SplitPane` targets the current `$TMUX_PANE` when splitting a child pane, independent of stored manager state; outside tmux or with stale env, this delegates failure/targeting behavior to the `tmux split-window` command. — `cmd/vamos-runtime/internal/qrspicmd/tmux.go:13-28`
- In non-tmux contexts, `CaptureManagerPaneID("")` returns empty when `$TMUX_PANE` is unset, `CheckTmuxAvailable` treats missing manager pane as OK/skipped, and `queueOrDeliverWake` queues instead of pasting when no manager pane exists. — `cmd/vamos-runtime/internal/qrspicmd/root.go:3985-3989`, `cmd/vamos-runtime/internal/qrspicmd/preflight.go:104-111`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1926-1939`

### 4. Ambiguous live-parent cases and current action-card evidence

- A live-parent ambiguity exists when stored `ManagerPaneID` is non-empty and different from current `$TMUX_PANE`; current `RunChild` prefers stored state over env and only writes env when stored state is empty. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1359-1367`
- Another ambiguity exists when `Delivery.ManagerPaneID` differs from `ManagerPaneID`; wake delivery prefers delivery pane, so changing only `ManagerPaneID` would not change wake target while delivery pane remains set. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1948-1952`
- Current code can detect whether the stored pane is live through `PaneExists`, but no manager-pane-specific action card kind exists; action-card constants cover state desync, active child conflict, human gate, invalid YAML, manual child steer, superseded wake, Pi compatibility, child launch failed, and child context exhausted. — `cmd/vamos-runtime/internal/qrspicmd/options.go:296-306`
- Current action-card shape supports evidence, recommended action, safe command, continue command, and `RequiresHuman`; text output prints those fields. — `cmd/vamos-runtime/internal/qrspicmd/options.go:186-195`, `cmd/vamos-runtime/internal/qrspicmd/root.go:3530-3554`
- Existing action-card safe commands are deterministic q-manager commands such as `steer-child`, `validate-latest --apply-rebind`, `repair-state --clear-failed-child --relaunch`, and `continue`; there is no current safe-command convention for manager-pane adoption. — `cmd/vamos-runtime/internal/qrspicmd/options.go:329-339`, `cmd/vamos-runtime/internal/qrspicmd/options.go:388-398`, `cmd/vamos-runtime/internal/qrspicmd/preflight.go:263-270`
- Docs currently instruct manual smoke to start/resume from the parent Pi session with explicit `--manager-pane "$TMUX_PANE"`, and to run `manager-ready --state-file <state> --manager-pane "$TMUX_PANE"` after compaction before flushing queued wake. — `docs/q-manager.md:120-129`

### 5. Existing explicit override/adoption flag conventions

- `--manager-pane` currently exists on `init`, `start-next`, `run-child`, and `manager-ready`; it does not exist on `continue`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:94-101`, `cmd/vamos-runtime/internal/qrspicmd/root.go:128-140`, `cmd/vamos-runtime/internal/qrspicmd/root.go:209-233`, `cmd/vamos-runtime/internal/qrspicmd/root.go:249-264`, `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`
- `--force` currently exists on `init` and `start-next`; in `start-next` it only clears/replaces an active child when `InspectActiveChildHealth` proves a terminal failed child. — `cmd/vamos-runtime/internal/qrspicmd/root.go:94-101`, `cmd/vamos-runtime/internal/qrspicmd/root.go:128-153`, `cmd/vamos-runtime/internal/qrspicmd/root.go:686-706`
- There is no `adopt`, `force-manager`, or `manager-pane` field in `ContinueOptions`; current `continue` cannot explicitly force a parent-pane rebind. — `cmd/vamos-runtime/internal/qrspicmd/options.go:571-581`, `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`
- Existing `--manager-pane` behavior is not uniform: `init` and first-run `start-next` persist it, `run-child` uses it for that launch and persists only when stored pane was empty, and `manager-ready` persists it even over an existing stored pane. — `cmd/vamos-runtime/internal/qrspicmd/root.go:574-581`, `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:31-70`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1359-1367`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2346-2356`
- The parent Pi wrapper passes all user args through to `vamos qrspi start-next|continue` and only adds manager usage flags; it does not add pane-adoption flags. — `.pi/extensions/q-manager-parent.ts:31-57`, `.pi/extensions/q-manager-parent.ts:123-157`
- The wrapper triggers native `ctx.compact()` only when CLI stdout includes `q-manager-parent-compact: started`, and its fallback ready command includes `manager-ready --manager-pane $TMUX_PANE`. — `.pi/extensions/q-manager-parent.ts:167-174`, `.pi/extensions/q-manager-parent.ts:200-207`

### 6. Current regression and smoke coverage

- Tests cover explicit/env capture through `CaptureManagerPaneID` and `init`. — `cmd/vamos-runtime/internal/qrspicmd/root_test.go:73-97`
- Tests cover first-run `start-next` persisting `ManagerPaneID` and visible child pane refs. — `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go:13-42`
- Tests cover direct wake delivery to `ManagerPaneID`, duplicate delivery suppression, compacting queue, `manager-ready` flushing to a new parent pane, and stale queued wake supersession. — `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:11-79`, `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:138-249`
- Tests cover compaction threshold behavior, ready command output, delivery `compacting`, and queue/flush interaction with manager compaction. — `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:60-119`, `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:203-273`
- Current smoke docs cover explicit parent pane, wrapper usage sampling, raw CLI usage flags, no immediate paste while compacting, and `manager-ready --manager-pane "$TMUX_PANE"` flush. — `docs/q-manager.md:120-129`
- I did not find tests for `continue` adopting current `$TMUX_PANE`, `start-next --state-file --manager-pane` rebinding stale stored manager pane, liveness-based manager-pane action cards, or paste-failure-to-queued-wake fallback; corresponding command/options paths currently have no adoption fields or helper. — `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`, `cmd/vamos-runtime/internal/qrspicmd/options.go:571-581`, `cmd/vamos-runtime/internal/qrspicmd/root.go:768-778`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1940-1945`

## Code References

- `cmd/vamos-runtime/internal/qrspicmd/state.go:8-29` — local manager/delivery/queued wake state fields.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:94-153` — `init`/`start-next` manager-pane and force flags.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525` — `continue` flags; no manager-pane flag.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:1359-1367` — `RunChild` parent pane priority and limited persistence.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:1889-1952` — wake queue/deliver logic and delivery-pane priority.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2111-2156` — compaction ready command and `Delivery.Status = "compacting"`.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2331-2422` — `manager-ready` rebind/flush logic.
- `cmd/vamos-runtime/internal/qrspicmd/tmux.go:13-28` — child split targets current `$TMUX_PANE`.
- `cmd/vamos-runtime/internal/qrspicmd/tmux.go:66-73` — tmux pane liveness check.
- `cmd/vamos-runtime/internal/qrspicmd/preflight.go:104-142` — preflight tmux liveness report.
- `.pi/extensions/q-manager-parent.ts:31-57` — parent wrapper command flow.
- `.pi/extensions/q-manager-parent.ts:123-207` — usage flags, compaction signal parsing, native compaction callback.

## Historical Context

- Current docs say manual smoke starts from the parent Pi session with `/q-manager start-next ... --manager-pane "$TMUX_PANE"`; raw CLI fallback can pass explicit manager usage flags, and missing usage skips compaction. — `docs/q-manager.md:120-126`
- Current docs say if manager was compacting, no immediate paste should occur until `vamos qrspi manager-ready --state-file <state> --manager-pane "$TMUX_PANE"` flushes exactly one current-generation queued wake. — `docs/q-manager.md:129`

## Surprises

- `start-next --state-file` accepts `--manager-pane`, but the loaded-state path does not apply it to state and the launch call does not pass it into `RunChild`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:128-140`, `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:16-29`, `cmd/vamos-runtime/internal/qrspicmd/root.go:768-778`
- `continue` has no pane override even though it is the normal post-wake graph-advance command. — `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`, `cmd/vamos-runtime/internal/qrspicmd/options.go:571-581`
- `queueOrDeliverWake` handles missing pane ID but not dead pane ID before paste; dead-pane paste errors bubble instead of being converted to queued wake/action-card evidence. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1926-1945`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1958-1967`
- `ShellTmuxClient.PaneExists` normalizes all tmux failures to `(false, nil)`, so callers can know unavailable vs available but not why unavailable. — `cmd/vamos-runtime/internal/qrspicmd/tmux.go:66-73`

## Open Questions

- I could not determine from current code which UX name should represent explicit adoption (`--manager-pane` alone, a new adopt flag, or a force flag); current code only shows existing flag conventions and inconsistent persistence behavior. — `cmd/vamos-runtime/internal/qrspicmd/root.go:94-153`, `cmd/vamos-runtime/internal/qrspicmd/root.go:493-525`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2331-2356`
- I could not determine any existing manager-pane-specific action-card kind or safe-command format; current action-card constants and writer are generic. — `cmd/vamos-runtime/internal/qrspicmd/options.go:296-306`, `cmd/vamos-runtime/internal/qrspicmd/root.go:3530-3554`
