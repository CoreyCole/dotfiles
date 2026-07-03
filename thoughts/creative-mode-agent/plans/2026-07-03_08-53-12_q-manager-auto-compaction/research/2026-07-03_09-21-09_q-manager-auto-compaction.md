---
date: 2026-07-03T09:21:09-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
stage: research
ticket: q-manager auto-compact parent after child launch
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Research: q-manager auto-compaction

## Brainstorm Summary

- Desired outcome: q-manager launches child first, then compacts parent when parent context usage is above 80%.
- Current failed signal: q-manager only compacts when explicit manager usage flags are supplied.
- Preferred API direction from question context: Pi native `/compact` / extension `ctx.compact()` rather than custom q-manager handoff as the main compaction mechanism.
- Safety requirements: active child refs persist before compaction; child wake during parent compaction queues and flushes after manager is ready; stale queued wakes are superseded.

## Research Question

Answers the question doc at `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/questions/2026-07-03_08-53-12_q-manager-auto-compaction.md`.

## Evidence Boundary

Use `AGENTS.md` and the question doc for framing only. Current behavior claims below are grounded in Vamos and Pi source/docs/tests with file:line references.

## Summary

Current q-manager child launch saves `ActiveChild` before compaction. `start-next` and `continue` call `maybeStartManagerCompaction` only after `RunChild` returns, and only when CLI flags provide usage. Pi exposes `ctx.getContextUsage()` and fire-and-forget `ctx.compact()`. Pi queues messages while compaction is running and flushes them after compaction. Existing q-manager delivery state already queues wakes while `Delivery.Status == "compacting"`, flushes on `manager-ready`, and suppresses stale queued wakes by child generation/lifecycle.

## Detailed Findings

### 1. Current `start-next` / `continue` launch, refs, compaction, delivery flow

- `start-next` captures manager usage flags via `usageFromChangedFlags`, assigning `opts.Usage` before `RunStartNext` runs. If flags are not changed, no usage values are present. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:113`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1886`
- `RunStartNext` renders a stage prompt, resolves the child cwd, invokes `RunChild`, reloads state from the state file, then calls `maybeStartManagerCompaction`. Child launch happens before compaction decision. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:581`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:736`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:752`
- `RunChild` builds a child request with state file, session dir/id, manager pane, prompt file, extension path, and plan dir; then starts the runner. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1291`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1339`
- `RunChild` assigns `state.ActiveChild` with child ID, stage, cwd, tmux pane, output/status/done paths, session id/dir, validation status path, lifecycle `running`, and generation `1`, then saves state before returning. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1376`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1390`
- `continue` captures the same explicit manager usage flags before `RunContinue`. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:468`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:474`
- `RunContinue` validates the active child, persists the graph decision, starts the next child when `parsed.Decision.StartNext` is true, then calls `maybeStartManagerCompaction` after the next child is launched. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2642`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2757`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2768`
- `startNextChildFromDecision` uses `RunChild` for the next graph node and reloads state from disk afterward. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2960`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2984`
- `ManagerState` stores `Delivery`, `ActiveChild`, and `PendingCleanupChild`; `ManagerDeliveryState` stores status, manager pane, queued wake, and last delivery ID. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/state.go:17`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/state.go:24`
- `maybeStartManagerCompaction` computes usage from explicit `ManagerUsageInput`; if no usage is present, it emits `manager compaction: skipped; no explicit usage input`. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1904`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1914`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1924`
- If usage percent is `<= 80`, compaction is skipped; if `> 80`, q-manager writes an operational handoff, sets `state.Delivery.Status = "compacting"`, fills delivery manager pane from `ManagerPaneID` when needed, saves state, and prints a `manager-ready` command. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1951`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1985`
- Current docs state the same behavior: `start-next` / `continue` accept explicit usage flags and above 80% write handoff, mark delivery `compacting`, and queue child wakes until `manager-ready`; missing usage skips compaction. — `context/vamos/docs/q-manager.md:52`, `context/vamos/docs/q-manager.md:125`

### 2. Pi native context usage and compaction APIs

- Pi extension context exposes `getContextUsage(): ContextUsage | undefined` with `tokens`, `contextWindow`, and `percent`; tokens/percent can be `null` after compaction until the next LLM response. — `context/pi/packages/coding-agent/src/core/extensions/types.ts:281`, `context/pi/packages/coding-agent/src/core/extensions/types.ts:328`
- Pi extension context exposes `compact(options?: CompactOptions): void` and documents it as “Trigger compaction without awaiting completion.” `CompactOptions` supports `customInstructions`, `onComplete`, and `onError`. — `context/pi/packages/coding-agent/src/core/extensions/types.ts:289`, `context/pi/packages/coding-agent/src/core/extensions/types.ts:329`
- In interactive mode, the extension context binds `getContextUsage` to `this.session.getContextUsage()` and `compact` to an async call to `this.session.compact(...)` with callbacks, but the exposed function itself does not return/await the promise. — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:1697`
- `AgentSession.getContextUsage()` returns undefined when no model/context window exists, returns `{ tokens: null, contextWindow, percent: null }` when no trusted assistant usage exists after latest compaction, otherwise estimates tokens and percent from session messages. — `context/pi/packages/coding-agent/src/core/agent-session.ts:2981`, `context/pi/packages/coding-agent/src/core/agent-session.ts:3013`
- `AgentSession.compact()` is manual compaction: it disconnects from the agent, aborts current operation, emits `compaction_start`, prepares compaction, runs extension hook or native compaction, appends a compaction entry, updates agent messages, emits `compaction_end`, and reconnects. — `context/pi/packages/coding-agent/src/core/agent-session.ts:1648`
- Pi native auto-compaction uses `shouldCompact(contextTokens, contextWindow, settings)`, where `shouldCompact` returns true when tokens exceed `contextWindow - reserveTokens`, not a fixed 80% threshold. — `context/pi/packages/coding-agent/src/core/agent-session.ts:1895`, `context/pi/packages/agent/src/harness/compaction/compaction.ts:202`
- Pi has `/compact` as a built-in interactive command; the README lists `/compact [prompt]` as “Manually compact context, optional custom instructions.” — `context/pi/packages/coding-agent/README.md:154`, `context/pi/packages/coding-agent/README.md:221`

### 3. Ordering guarantees for q-manager before invoking native compaction

- Current q-manager ordering already launches the child and saves active child refs before `maybeStartManagerCompaction` runs: `RunStartNext` calls `RunChild`, reloads state, then compaction; `RunContinue` starts next child, then compaction. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:736`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:752`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2757`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2768`
- `RunChild` saves `ActiveChild` before timeout wait or any child completion handling, so a fast child wake has state refs to validate against. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1376`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1390`
- Wake queuing depends on `state.Delivery.Status == "compacting"`; therefore q-manager must set/save delivery `compacting` before invoking Pi native compaction if it wants any immediate child wake to queue instead of paste into a compaction-active parent. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1756`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1951`
- `maybeStartManagerCompaction` currently sets and saves `Delivery.Status = "compacting"` before printing instructions, but it does not call Pi native compaction. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1951`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1985`
- Child extension wake logic runs on Pi `agent_end`, invokes `vamos qrspi child-complete`, then writes diagnostic status/done. The Go `child-complete` path owns queue/deliver/suppress. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:76`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:98`

### 4. Pi native compaction and queued messages while compaction runs

- Interactive mode stores `compactionQueuedMessages` specifically for “Messages queued while compaction is running.” — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:342`
- On normal Enter while `this.session.isCompacting`, extension commands run immediately but non-extension text is queued with mode `steer`. — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:2684`
- Follow-up queueing while compacting calls `queueCompactionMessage(text, "followUp")`. — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3529`
- `queueCompactionMessage` appends to `compactionQueuedMessages`, clears editor text, updates pending display, and shows “Queued message for after compaction.” — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3835`
- `flushCompactionQueue` snapshots queued messages, clears the compaction queue, and either queues them for retry via `session.steer`/`session.followUp` when `willRetry` is true or sends the first non-extension prompt with `session.prompt` and queues the rest as steer/follow-up. — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3853`, `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3900`
- Interactive mode calls `flushCompactionQueue` when `compaction_end` events occur. — `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:2994`
- Therefore a q-manager child wake pasted as a normal parent prompt while Pi native compaction is in progress would be handled by Pi’s compaction queue, not immediately processed, provided it reaches the editor/session input path as one prompt.

### 5. Integration locations and current boundaries

- The q-manager CLI owns deterministic child launch, state refs, validation, graph decisions, and wake delivery. Its `start-next` and `continue` commands are the current integration points for usage-driven compaction after launching a child. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:581`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2642`
- The q-manager child extension only observes child `agent_end`, calls the CLI `child-complete`, and writes diagnostic files. It does not know parent context usage or call parent compaction APIs. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:27`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`
- Pi extension API methods needed for native parent behavior exist only inside the parent Pi process context (`ctx.getContextUsage`, `ctx.compact`). A child-side CLI process cannot call those parent in-process APIs directly. — `context/pi/packages/coding-agent/src/core/extensions/types.ts:328`, `context/pi/packages/coding-agent/src/core/extensions/types.ts:330`
- q-manager skill currently instructs operators to pass explicit usage values to CLI and says missing usage skips compaction; this is operator/runbook behavior, not automatic parent measurement. — `context/vamos/.pi/skills/q-manager/SKILL.md:103`
- q-manager docs state normal child wake delivery is validated CLI output, not raw `agent_end`; the integration boundary for child completion remains Go `qrspi child-complete`. — `context/vamos/docs/q-manager.md:29`

### 6. Existing and missing tests

- Existing unit tests cover usage percent calculation, skip-without-usage, threshold handoff/`compacting` state, and queue/flush wake behavior after explicit usage compaction. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:12`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:26`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:43`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:84`
- Existing delivery tests cover ready manager one-wake delivery, queue while compacting and flush on `manager-ready`, and stale queued wake supersession. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:11`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:52`, `context/vamos/cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:82`
- Existing repair tests cover `mark-child-active` superseding queued wake. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/repair_state_test.go:157`
- Existing child test verifies the embedded child extension includes `agent_end`, `child-complete`, status/done paths, parent pane, wake mode, and validation-only wake logic. — `context/vamos/cmd/vamos-runtime/internal/qrspicmd/child_test.go:62`
- Missing from current Vamos tests: parent Pi extension/command usage measurement via `ctx.getContextUsage()`, native `ctx.compact()` trigger after child launch, guarantee that q-manager saves `Delivery.Status = "compacting"` before calling native compact, quick child wake while native compact is in progress, and interaction with Pi’s own compaction queue.
- Missing from current Pi tests for this feature scope: q-manager-specific parent extension command behavior. Pi itself already has compaction queueing logic in interactive mode, but no Vamos q-manager parent integration exists in the inspected code.

## Code References

- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:581` — `RunStartNext` entry point.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:736` — `RunStartNext` launches child.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:752` — `RunStartNext` calls compaction after child launch.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1376` — `RunChild` writes active child refs.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1733` — queue/deliver wake function.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1914` — current explicit usage compaction function.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:1951` — current delivery status `compacting` state save.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/root.go:2089` — `RunManagerReady` flush entry point.
- `context/vamos/cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75` — child `agent_end` hook.
- `context/pi/packages/coding-agent/src/core/extensions/types.ts:328` — Pi extension context usage API.
- `context/pi/packages/coding-agent/src/core/extensions/types.ts:330` — Pi extension native compact API.
- `context/pi/packages/coding-agent/src/core/agent-session.ts:1648` — manual compaction implementation.
- `context/pi/packages/coding-agent/src/core/agent-session.ts:2981` — context usage implementation.
- `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3835` — interactive compaction message queue.
- `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3853` — interactive compaction queue flush.

## Historical Context

- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md` framed the preferred direction as Pi native compaction after child launch.
- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/AGENTS.md` records the invariant that child refs must persist before parent compaction.

## Surprises

- Pi native auto-compaction threshold is reserve-token based (`contextWindow - reserveTokens`), while q-manager’s requested trigger is a fixed `>80%` manager-context usage.
- Pi’s extension `compact()` is fire-and-forget from the extension API, but the underlying session compaction aborts current work before compacting.
- Current q-manager compaction is not native Pi compaction; it writes an operational handoff and requires `manager-ready` after resume.

## Open Questions

- Whether parent q-manager should expose a new Pi extension command that wraps `start-next` / `continue`, measures `ctx.getContextUsage()`, then calls `ctx.compact()` after the CLI returns.
- Whether the parent integration should still write the current operational handoff or only set delivery `compacting` and rely on Pi native compaction summary.
- Whether Pi `ctx.compact()` abort semantics have any edge case if invoked from a command handler immediately after a CLI command finishes.
