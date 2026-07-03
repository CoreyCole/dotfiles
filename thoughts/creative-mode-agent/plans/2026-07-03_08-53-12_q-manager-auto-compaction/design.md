---
date: 2026-07-03T09:56:09-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
stage: design
ticket: q-manager auto-compact parent after child launch
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
related_adrs:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_09-56-09_queue-wakes-before-native-compact.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_10-15-24_wake-chain-reliability.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_10-55-37_child-context-exhaustion-recovery.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md
brainstorm_docs:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/questions/2026-07-03_08-53-12_q-manager-auto-compaction.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/research/2026-07-03_09-21-09_q-manager-auto-compaction.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/context/design/2026-07-03_09-29-00_q-manager-auto-compaction-design-brainstorm.md
---

# Design: q-manager auto-compaction after child launch

> Human update 2026-07-03: trigger parent native compaction at 90% manager context usage, not 80%.

## Executive Summary

Add parent Pi q-manager wrapper/command for auto-compaction. It measures parent context with `ctx.getContextUsage()`, runs normal `vamos qrspi start-next` / `continue`, then calls native `ctx.compact()` only after q-manager saved delivery `compacting`. Child starts first and keeps working while parent compacts. Wake reliability is in scope: valid child completion must wake, queue, or be recoverable from latest session without hand-editing artifacts. Child context exhaustion is also in scope: no valid result means recover or relaunch same node, never invent completion.

## Current State

- q-manager CLI launches visible child sessions and owns graph/state transitions. `RunStartNext` writes prompt, calls `RunChild`, reloads state, then calls compaction helper. `cmd/vamos-runtime/internal/qrspicmd/root.go:581`, `root.go:736`, `root.go:752`.
- `RunContinue` validates active child, persists decision, starts next child when graph allows, then calls compaction helper. `cmd/vamos-runtime/internal/qrspicmd/root.go:2642`, `root.go:2757`, `root.go:2768`.
- `RunChild` persists `ActiveChild` before returning. Child refs include pane/session/status/lifecycle/generation. `cmd/vamos-runtime/internal/qrspicmd/root.go:1376`, `root.go:1390`.
- Current compaction helper needs explicit CLI usage flags. Missing usage prints skip. `cmd/vamos-runtime/internal/qrspicmd/root.go:1886`, `root.go:1904`, `root.go:1924`.
- Current code uses usage >80 to write q-manager operational handoff, save `Delivery.Status = "compacting"`, and print `manager-ready`; this feature should raise the trigger to 90%. `cmd/vamos-runtime/internal/qrspicmd/root.go:1951`, `root.go:1985`.
- Wake delivery queues when `Delivery.Status == "compacting"`. `cmd/vamos-runtime/internal/qrspicmd/root.go:1733`, `root.go:1756`.
- Child extension only runs in child Pi process; on `agent_end`, it calls `vamos qrspi child-complete`. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:27`, `q_manager_child_extension.js:75`.
- Pi parent extension context exposes `getContextUsage()` and fire-and-forget `compact()`. `context/pi/packages/coding-agent/src/core/extensions/types.ts:328`, `types.ts:330`.
- Pi interactive mode queues normal input while native compaction runs and flushes after `compaction_end`. `context/pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts:3835`, `interactive-mode.ts:3853`, `interactive-mode.ts:2994`.
- q-manager docs currently describe explicit usage flags, not automatic parent measurement. `docs/q-manager.md:52`, `docs/q-manager.md:125`.
- No-wake recovery commands already exist in manager guidance: inspect latest sessions, validate/rebind latest, or recover manual latest-session and continue. `.pi/skills/q-manager/SKILL.md:81`, `.pi/skills/q-manager/SKILL.md:89`, `.pi/skills/q-manager/SKILL.md:93`.

## Desired End State

- Manager user runs a Pi q-manager command/wrapper, not raw CLI flags, for normal start/continue.
- Parent wrapper measures parent Pi context usage before the CLI call.
- Wrapper passes measured usage to existing CLI flags when usage is known and threshold-relevant; target trigger is 90%.
- CLI remains deterministic state authority: child launch, state save, graph decision, delivery compacting flag, queued wake, `manager-ready`.
- Parent wrapper calls native `ctx.compact()` only after CLI indicates q-manager compaction started.
- Native compaction resets parent manager context; q-manager operational handoff remains recovery/instructions for fresh manager.
- Quick child result/human gate while parent compacts is not lost and not processed twice.
- If child finished but no parent wake arrived, manager/operator can inspect latest session, validate/rebind it, and continue without editing durable artifacts by hand.
- If child exhausts context or exits with no valid `qrspi_result`, q-manager stops with evidence and recovery actions; graph does not advance.

## Patterns to Follow

- Keep q-manager graph/state authority in Go CLI. Existing `RunStartNext` and `RunContinue` already define launch/advance flow. `cmd/vamos-runtime/internal/qrspicmd/root.go:581`, `root.go:2642`.
- Keep child extension child-only and validation-driven. It calls `child-complete`; Go validates JSONL and decides wake. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`.
- Reuse q-manager delivery `compacting` state and `manager-ready` flush. `docs/q-manager.md:52`, `docs/q-manager.md:128`.
- Preserve and test the full wake chain: child Pi extension -> `qrspi child-complete` -> session JSONL validation -> delivery queue/deliver -> parent pane wake.
- Use Pi extension APIs only from parent Pi process. `context/pi/packages/coding-agent/src/core/extensions/types.ts:328`, `types.ts:330`.
- Keep manager output concise. q-manager skill says no NDJSON on happy path. `.pi/skills/q-manager/SKILL.md:103`.

## Patterns to Avoid

- Do not make Go CLI guess parent usage from token totals or logs. Research found usage exists in parent Pi session API, not child/CLI process.
- Do not call native `ctx.compact()` before child refs and delivery `compacting` are saved.
- Do not rely only on Pi's generic compaction input queue for child wakes. q-manager needs validated wake payload, stale suppression, and one-shot `manager-ready` flush.
- Do not treat no-wake as a one-off operator issue. It is an in-scope reliability bug class in the child-complete wake chain.
- Do not treat child context exhaustion, failed child compaction, provider context-limit errors, or terminal no-result child exits as successful stage completion.
- Do not put manager state file, pane IDs, or queued wake refs in durable `qrspi_result` YAML.
- Do not hide child sessions or replace visible tmux child model.

## Recommended Approach

### 1. Add parent Pi q-manager wrapper/command

Add a parent-side Pi extension command/wrapper for normal q-manager launch/continue. It runs inside the manager Pi session, so it can call:

```ts
const usage = ctx.getContextUsage();
// run: vamos qrspi start-next/continue ... --manager-usage-percent usage.percent
// if CLI reports q-manager compaction started:
ctx.compact({ customInstructions: handoffPrompt });
```

The wrapper should support the normal manager actions:

- start first/next child from plan dir.
- continue after child wake.
- preserve model/policy/operator args already supported by CLI.
- use default text CLI output for manager chat.

It should not duplicate graph rules. It is an adapter around existing CLI commands.

### 2. Keep CLI explicit usage path as internal seam

Keep `--manager-usage-percent` and token/window flags. Parent wrapper feeds them from the parent Pi process's live `ctx.getContextUsage()` API; the Go CLI must not scan Pi session JSONL to estimate parent context usage.

Between manager turns, store the last observed usage sample in local q-manager control state for diagnostics/history: percent, tokens/window when available, timestamp, and source. Use fresh `ctx.getContextUsage()` samples for compaction decisions; do not trigger native compact from stale stored usage. Do not put usage samples in durable `qrspi_result` YAML.

Behavior:

- usage unavailable or percent null: run CLI without compaction usage; skip auto native compact.
- usage \<90: persist last sample for diagnostics if useful, but no compaction.
- usage >=90: pass explicit usage; CLI writes operational handoff and saves `Delivery.Status = "compacting"`.

This preserves current tests and makes parent measurement additive.

### 3. Native compact only after q-manager state is queue-safe

Ordering must be strict:

1. Parent wrapper measures usage.
1. Parent wrapper runs CLI `start-next` or `continue`.
1. CLI launches child and saves `ActiveChild`.
1. CLI sees usage >=90, writes handoff, saves `Delivery.Status = "compacting"`, prints/returns handoff + `manager-ready`.
1. Parent wrapper detects compaction-started signal.
1. Parent wrapper calls `ctx.compact()` with concise custom instructions pointing at handoff and `manager-ready`.

If any earlier step fails, do not compact. Preserve parent context for recovery.

### 4. Wake during parent compaction

If child finishes or asks a human question while parent compacts:

1. Child Pi extension fires on `agent_end` and runs `vamos qrspi child-complete`.
1. Go validates the child session/result.
1. Delivery sees `state.Delivery.Status == "compacting"`.
1. q-manager stores the validated wake as `QueuedWake` instead of pasting to the parent pane.
1. Pi native compaction may also be queueing user text, but the q-manager wake should not depend on that generic queue.
1. Fresh/compacted manager resumes from Pi compaction and follows handoff instructions.
1. Manager runs `vamos qrspi manager-ready --state-file ... --manager-pane "$TMUX_PANE"`.
1. `manager-ready` marks delivery ready, rechecks child generation/lifecycle, and flushes the queued wake exactly once.
1. Manager runs the wake's `continue` or handles human gate/blocked/error per existing flow.

Result: child wake waits outside parent prompt stream until the manager is ready. No lost prompt, no duplicate transition, no durable YAML pollution.

Stale queue behavior stays explicit: if the child was steered, manually rebound, or superseded while parent compacted, `manager-ready` suppresses old-generation queued wakes and waits for the current child/session result.

### 5. No-wake recovery path

If child visibly finished and wrote a valid `qrspi_result` but parent manager did not receive a wake, treat it as recoverable control-plane failure, not artifact failure.

Expected recovery:

1. Manager/operator runs `vamos qrspi inspect --state-file <state> --sessions --latest`.
1. If latest child session is the correct active result, run `vamos qrspi validate-latest --state-file <state> --stage <node> --apply-rebind`.
1. Or run `vamos qrspi recover-manual --state-file <state> --mode latest-session --continue` when safe.
1. CLI validates latest session JSONL, applies/rebinds state, and continues graph-authoritatively.
1. Do not hand-edit `qrspi_result`, `validation-status.json`, manager JSON, or durable artifacts.

This recovery path must remain obvious after parent wrapper/native compaction changes. Wrapper diagnostics should mention these commands when it detects child finished/no wake evidence.

### 6. Child context exhaustion recovery

If child runs out of context before valid YAML or before wake delivery, treat it as failed/incomplete child execution.

Detection signals:

- child session JSONL or status contains context exhaustion, failed child compaction, provider context-limit error, or aborted generation.
- child process is terminal with no valid `qrspi_result`.
- child output/pane shows context-limit failure before `agent_end` wake path completed.
- stage artifacts changed but session lacks valid graph result.

Policy:

- Do not mark stage complete.
- Do not invent durable `qrspi_result` YAML.
- Do not advance graph from artifacts alone.
- Preserve child pane, session path, status/output paths, prompt file, stage, and active child generation for inspection.

Recovery order:

1. Surface concise action card/stop with evidence and safe commands.
1. If evidence shows actual child context-limit/context-exhaustion, use child `/compact` (or `pi --resume <session>` then `/compact`) and steer same child to emit valid YAML.
1. If no child context limit occurred but enough context remains, steer/resume the child for a QRSPI handoff/recovery note, then continue same stage; do not compact child just because a wake/result is missing.
1. If stage artifacts were written, validate them and use latest-session/rebind/steer so work is not discarded.
1. If no trustworthy artifact/result exists, relaunch the same graph node with prior artifacts plus recovered notes; do not advance.

This is separate from no-wake: no-wake has a valid result but delivery failed; context exhaustion has no trustworthy result yet.

### 7. Operational handoff still matters

Native Pi compaction is the actual context reset. q-manager operational handoff remains the recovery/control handoff:

- exact state file.
- active child refs.
- `manager-ready` command.
- how to continue after queued wake.

Parent wrapper can pass a concise custom compact instruction: read the operational handoff, then run `manager-ready` once compaction ends.

### 8. Tests and docs

Add coverage at three layers:

- Go CLI/unit tests: ensure compaction-started output is machine-detectable; state saved `compacting` before wrapper would compact; existing queue/flush tests stay green.
- Parent Pi wrapper tests: mocked `getContextUsage()` >=90, CLI success with compaction-started, calls `ctx.compact()` once; usage unknown/\<90 does not compact; CLI failure does not compact.
- Wake reliability/integration tests: valid child completion triggers parent wake; valid completion while `Delivery.Status=compacting` queues and `manager-ready` flushes exactly one current-generation wake; stale queued wake is suppressed after steer/rebind; no-wake recovery validates latest session safely and continues.
- Child exhaustion tests: terminal context-limit/no-result child produces recoverable action card, does not advance graph, preserves recovery refs, and offers compact/resume/steer/rebind/relaunch paths as appropriate.

End-to-end chain under test:

```text
child Pi extension -> qrspi child-complete -> session JSONL validation -> delivery queue/deliver -> parent pane wake
```

Update docs/skill:

- Normal q-manager path uses parent wrapper/command for automatic usage measurement.
- Raw CLI flags remain debug/manual seam.
- Wake-during-compaction behavior: queued by q-manager, flushed by `manager-ready`.
- No-wake recovery: inspect latest session, validate/rebind latest, or recover latest-session and continue.
- Child context exhaustion: preserve refs; compact child only when context-limit evidence exists; otherwise steer/resume/rebind; validate artifacts if present; otherwise relaunch same node.

## Decision

Go with parent Pi q-manager wrapper plus existing CLI compaction state machine. This fits process boundaries: parent Pi knows context usage and can call native compact; Go CLI knows q-manager state and graph; child extension only wakes manager after validation.

## Resolved Decisions

- Parent Pi wrapper owns parent usage measurement and native compact trigger. See [`adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md`](adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md).
- q-manager delivery must enter `compacting` before native compact. See [`adrs/2026-07-03_09-56-09_queue-wakes-before-native-compact.md`](adrs/2026-07-03_09-56-09_queue-wakes-before-native-compact.md).
- Wake chain reliability is part of this feature, including no-wake recovery. See [`adrs/2026-07-03_10-15-24_wake-chain-reliability.md`](adrs/2026-07-03_10-15-24_wake-chain-reliability.md).
- Child context exhaustion is recoverable incomplete execution, not completion. See [`adrs/2026-07-03_10-55-37_child-context-exhaustion-recovery.md`](adrs/2026-07-03_10-55-37_child-context-exhaustion-recovery.md).
- Parent compaction trigger is fresh usage >=90%; persisted last usage is diagnostics only. See [`adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md`](adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md).

## ADR Candidate Disposition

- Accepted as ADR: parent q-manager auto-compaction lives in parent Pi wrapper/command → `adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md`.
- Accepted as ADR: local q-manager delivery enters `compacting` before native Pi compaction fires → `adrs/2026-07-03_09-56-09_queue-wakes-before-native-compact.md`.
- Accepted as ADR: preserve/test full wake chain and no-wake recovery → `adrs/2026-07-03_10-15-24_wake-chain-reliability.md`.
- Accepted as ADR: child context exhaustion/no-result terminal status recovers or relaunches same node, never advances graph → `adrs/2026-07-03_10-55-37_child-context-exhaustion-recovery.md`.
- Accepted as ADR: parent wrapper samples usage each turn; compacts on fresh >=90%; local last-usage state is diagnostics only → `adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md`.
- Resolved without ADR: child refs persist before compaction — existing code already does this; tests should protect it.
- Deferred: multi-wake queue — one active child plus generation/lifecycle stale suppression remains sufficient for this feature.

## Open Questions

- Exact parent command name and registration surface.
- Exact compact custom-instructions text and whether it should include handoff path only or a short inline checklist.
- Whether CLI text output needs a small stable marker for parent wrapper to detect `compacting started`, or wrapper should use JSON/structured output without bloating manager chat.
