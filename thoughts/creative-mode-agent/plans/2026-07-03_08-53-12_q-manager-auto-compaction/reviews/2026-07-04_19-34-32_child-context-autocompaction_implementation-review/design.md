---
date: 2026-07-04T23:24:56-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 184fa8f9f7558eaf4a29fd50c9dafcfbd5a7ac0d
branch: creative-mode-agent/q-manager-auto-compaction_review-fixes
repository: vamos
stage: design
ticket: 'implementation review follow-up: q-manager child context exhaustion'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
related_adrs:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/adrs/2026-07-04_23-24-56_provider-context-error-evidence.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/adrs/2026-07-04_23-24-57_terminal-error-delivery-identity.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/adrs/2026-07-04_23-24-58_recovery-summarizer-helper.md
brainstorm_docs:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/questions/2026-07-04_19-35-18_child-context-autocompaction.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/context/brainstorms/2026-07-04_19-35-18_child-context-autocompaction.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/context/design/2026-07-04_19-52-54_child-context-autocompaction-design-brainstorm.md
---

# Design: q-manager child context exhaustion recovery

## Executive Summary

Make child context-window/provider failures deterministic. CLI reads latest child Pi JSONL terminal evidence, classifies context-window provider errors even when older `qrspi_result` exists, updates validation status, and wakes parent with manager-needed recovery. Add optional recovery summarizer helper: fresh Pi process reads failed session tail/artifacts and writes a concise recovery note for relaunching same graph node. Proactive child compaction stays separate/best-effort after deterministic recovery exists.

## Current State

- Child Pi command passes q-manager extension/session flags into visible tmux child. `cmd/vamos-runtime/internal/qrspicmd/child.go:112`
- Child extension only hooks `agent_end`, runs `qrspi child-complete`, writes status, touches done marker. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`
- Pi `agent_end` happens before final assistant persistence and post-run compaction/retry handling. Research: `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:514`, `:979`
- Session parser stores `StopReason` but not `errorMessage`. `cmd/vamos-runtime/internal/qrspicmd/session_result.go:21`, `cmd/vamos-runtime/internal/qrspicmd/session_result.go:24`
- Final QRSPI extraction skips `stopReason: error|aborted`; last-text extraction ignores empty-content error messages. `cmd/vamos-runtime/internal/qrspicmd/session_result.go:157`
- Health classifier returns `finished_success_needs_result_validation` when any result exists before checking later context errors. `cmd/vamos-runtime/internal/qrspicmd/child_health.go:51`
- `RunChildComplete` parses/validates child text first, then writes validation status/wake. `cmd/vamos-runtime/internal/qrspicmd/root.go:1477`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1519`
- Duplicate suppression compares `state.Delivery.LastDeliveryID` against current status delivery ID. `cmd/vamos-runtime/internal/qrspicmd/root.go:1743`
- Existing context-exhausted action card has right recovery commands, but current code misses observed empty-content provider errors. `cmd/vamos-runtime/internal/qrspicmd/root.go:2870`
- `steer-child` pastes feedback into same pane and does not increment generation. `cmd/vamos-runtime/internal/qrspicmd/root.go:2566`
- Parent compaction wrapper already samples parent usage and calls native parent `ctx.compact()`. `.pi/extensions/q-manager-parent.ts:47`, `.pi/extensions/q-manager-parent.ts:203`

## Desired End State

- Latest session terminal provider context error is deterministic operational truth.
- Older valid `qrspi_result` remains historical, not current child state, when a later terminal error exists.
- `child-complete` can deliver/queue parent wake for context-window provider failure.
- `continue` and `inspect --sessions --latest` show same classification and safe commands.
- `validation-status.json` reflects latest terminal error, not stale earlier result only.
- Duplicate suppression does not hide later terminal errors after steering.
- Manager can ask a fresh recovery summarizer helper to write a same-stage recovery note, then relaunch same graph node with that note.
- No fake durable QRSPI result, no graph advancement from failed child, no private host paths in runtime code.

## Direct Answers

### 1. How make child provider/context-window failures deterministic?

- Parse latest assistant terminal metadata from Pi JSONL, not only assistant text.
- Detect `stopReason: "error"` plus context-window `errorMessage` needles:
  - `context window`
  - `context length`
  - `context_length_exceeded`
  - `maximum context`
  - `context limit`
  - `input exceeds`
- Store evidence: session path, session ID, line number or timestamp, stop reason, normalized error message, short hash.
- Classification precedence: latest terminal provider context error beats older QRSPI result in same/latest session.
- Use same classifier in `child-complete`, `continue`, `inspect`, `validate-latest`, and recovery helper selection.

### 2. Can CLI classify the error and wake parent?

Yes. CLI owns state, validation status, delivery IDs, action cards, and parent wake delivery. Design path:

1. Resolve active/latest child session.
1. Read latest assistant terminal evidence, with bounded refresh in `child-complete` because Pi persistence may lag `agent_end`.
1. If latest evidence is context-window provider error, build `ChildCompletionStatus`:
   - `validated=false`
   - `managerNeeded=true`
   - `retryExhausted=false`
   - result stage = active child stage
   - result status = `child_context_exhausted` or `error` summary with provider message
   - session path + evidence ID fields
1. Write `validation-status.json` with that status.
1. Build/update `LastActionCard` with session refs, error, last known artifact/result if present, safe commands.
1. Delivery ID uses terminal evidence identity, so stale blocked delivery does not suppress it.
1. Call existing queue/deliver wake path.

### 3. Can separate Pi agent summarize filled session and suggest recovery?

Yes, as helper after deterministic CLI classification. It should be optional but designed now.

- New manager action: spawn fresh Pi recovery/summarizer child or CLI-managed Pi process.
- Inputs: failed session JSONL path, validation status, active child metadata, latest artifact path/result if any, plan `AGENTS.md`, current design/plan docs when present.
- Permissions: read-only against code unless human/manager explicitly directs edits.
- Output: `context/recovery/YYYY-MM-DD_HH-MM-SS_<stage>_<child-id>_context-recovery.md` under active plan/review dir.
- Content:
  - where child left off
  - completed commands/checks/artifacts
  - exact provider error and session tail evidence
  - next same-stage tasks/checks
  - what to avoid: repeated large-output commands, re-running expensive logs blindly, dumping huge artifacts
  - prompt snippet for relaunching same graph node
- It does not emit `qrspi_result` and does not advance workflow.
- Manager relaunches same graph node with recovery note as extra context.

## Patterns to Follow

- Shared parser/classifier, not per-command bespoke grep. Existing session helpers centralize JSONL parsing in `session_result.go`.
- Operational action cards for manager-needed recovery. Existing child context card already names safe inspect/recover commands. `cmd/vamos-runtime/internal/qrspicmd/root.go:2870`
- Latest-session recovery keeps child/session refs and increments generation only on rebind. `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:282`
- Parent compaction remains separate from child recovery. `.pi/extensions/q-manager-parent.ts:47`

## Patterns to Avoid

- Do not trust `validation-status.json` over latest session tail.
- Do not fabricate a QRSPI YAML result after provider failure.
- Do not advance graph after recovery summary; relaunch same node.
- Do not depend on proactive compaction to make provider errors recoverable.
- Do not make same-child steering generation changes required for this fix.
- Do not add Chestnut/private paths or host-specific commands.

## Recommended Approach

### Part A: Terminal evidence model

Add a small data model in `session_result.go` or adjacent file:

```go
type AssistantTerminalEvidence struct {
    SessionPath string
    SessionID   string
    Line        int
    Timestamp   string
    StopReason  string
    ErrorMessage string
    ContextWindowError bool
    EvidenceID string
}
```

Implementation shape:

- Extend `sessionMessage` with `ErrorMessage string`.
- Scan JSONL to latest assistant message, recording text and metadata.
- Compute stable `EvidenceID` from session path/session ID + line/timestamp + stop reason + normalized error message.
- Return both latest terminal evidence and older QRSPI text availability where useful.
- Keep final QRSPI extraction behavior strict; do not make provider error text look like a result.

### Part B: Shared child health precedence

Change `InspectActiveChildHealth` ordering:

1. Resolve latest active child session.
1. Read terminal evidence.
1. If context-window provider error and done/status indicates child ended, return `ActiveChildContextExhausted` with evidence even if older QRSPI result exists.
1. Else check `ChildHasQRSPIResult` and normal paths.

This fixes inspect/continue without needing `child-complete` to hit the exact persistence window.

### Part C: `child-complete` terminal-error path

At start of `RunChildComplete`:

- Resolve active child latest session.
- Poll/re-read briefly for final assistant evidence if invoked from `agent_end` and latest state is ambiguous.
- If terminal context-window provider error exists:
  - build manager-needed `ChildCompletionStatus`
  - copy last known result/artifact from prior validation when available for context only
  - use terminal evidence delivery ID
  - set lifecycle `awaiting_manager`
  - write validation status
  - save state
  - queue/deliver wake
  - output JSON status
- Else continue existing parse/validate/retry logic.

### Part D: Delivery identity

Add delivery ID branch:

```text
childID:generation:provider_context_error:evidenceID
```

Properties:

- Different from earlier `childID:generation:verify:blocked::artifact`.
- Stable for repeated same final JSONL error.
- Works even if same-child steer did not increment generation.
- Lets `queueOrDeliverWake` keep existing duplicate logic.

### Part E: Action card / wake payload

Action card should include:

- child ID, stage, pane ID if known
- session path and session ID
- provider `errorMessage`
- evidence ID / line / timestamp
- last known stage/status/artifact from previous validation if available
- safe command: `vamos qrspi inspect --state-file ... --sessions --latest`
- continue command: existing `recover-manual --mode latest-session --continue`
- optional helper command: recovery summarizer

Wake should stay operational `q_manager_child_wake`, not fake `qrspi_result`.

### Part F: Recovery summarizer helper

Add a CLI-managed helper after classification, not in the critical wake path.

Possible command shape for outline to refine:

```text
vamos qrspi recover-summary --state-file <state> --session-file <jsonl> --stage <stage>
```

Behavior:

- Writes prompt file under local run state.
- Launches fresh Pi or uses configured Pi command with read-only instructions.
- Reads session tail and artifacts, not entire huge transcript unless needed.
- Writes note under `context/recovery/` in plan dir.
- Updates action card/recovery output with note path.
- Does not mutate code or workflow result.

Prompt rules:

- Summarize completed work and last reliable evidence.
- Point to artifacts/commands with paths.
- Tell next child exactly what to do first.
- Tell next child what not to repeat.
- No `qrspi_result`.

### Part G: Proactive child compaction

Keep separate/best-effort.

- Pi already has auto-compaction settings and overflow handling per research.
- Child extension could later add `turn_end` usage sampling and `ctx.compact()` if extension context exposes reliable usage in child sessions.
- Do not block deterministic recovery on this.
- If implemented, log compaction diagnostics separately; do not conflate with manager wake classification.

## Decision

Go with deterministic CLI recovery first. It fixes the actual failure mode: stale older QRSPI validation hid a later terminal provider context-window error. Then add recovery summarizer helper so manager can relaunch same graph node with precise context. Proactive child compaction remains optional hardening.

## Resolved Decisions

- Latest terminal provider context error is first-class session evidence. See [`adrs/2026-07-04_23-24-56_provider-context-error-evidence.md`](adrs/2026-07-04_23-24-56_provider-context-error-evidence.md).
- Terminal provider errors use distinct delivery identity. See [`adrs/2026-07-04_23-24-57_terminal-error-delivery-identity.md`](adrs/2026-07-04_23-24-57_terminal-error-delivery-identity.md).
- Recovery summarizer is helper, not graph result. See [`adrs/2026-07-04_23-24-58_recovery-summarizer-helper.md`](adrs/2026-07-04_23-24-58_recovery-summarizer-helper.md).

## ADR Candidate Disposition

- Accepted as ADR: explicit provider-context-error session evidence model.
- Accepted as ADR: later terminal provider errors get distinct delivery identity.
- Accepted as ADR: separate recovery summarizer helper writes same-stage note, no QRSPI result.
- Resolved without ADR: proactive child compaction is best-effort future hardening, not required for deterministic recovery.
- Resolved without ADR: same-child `steer-child` generation change not required for this fix.

## Test Direction

- Session parser fixture: empty `content: []`, `stopReason: "error"`, `errorMessage` context-window string.
- Health fixture: older QRSPI blocked result plus later provider error => `ActiveChildContextExhausted`.
- Child-complete fixture: prior delivered blocked result, same generation, later provider error => manager-needed wake delivered/queued, not duplicate.
- Validation status fixture: latest provider error replaces stale validated blocked status.
- Inspect fixture: prints context-exhausted health, session path, safe command.
- Recovery helper fixture: writes note, no code edits, no QRSPI result, same node relaunch instruction.

## Rollout / Verification

- Unit tests for parser, health, child-complete, delivery, recovery command output.
- Focused Go test package: `go test ./cmd/vamos-runtime/internal/qrspicmd`.
- Manual smoke on existing failed JSONL fixture copied into temp session dir.
- Then rerun parent verify q-manager smoke.

## Open Questions

- Exact command name and prompt file shape for recovery summarizer helper.
- Whether helper should launch tmux-visible Pi child or noninteractive CLI process.
- Whether proactive child compaction belongs in same implementation slice after deterministic recovery passes tests.
