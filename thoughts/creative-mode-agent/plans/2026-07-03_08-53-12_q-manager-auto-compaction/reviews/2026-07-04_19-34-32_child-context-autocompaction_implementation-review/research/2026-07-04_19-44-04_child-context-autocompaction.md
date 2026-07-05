---
date: 2026-07-04T19:44:04-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 184fa8f9f7558eaf4a29fd50c9dafcfbd5a7ac0d
branch: creative-mode-agent/q-manager-auto-compaction_review-fixes
repository: vamos
stage: research
ticket: 'implementation review follow-up: q-manager child context exhaustion'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
question_doc: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/questions/2026-07-04_19-35-18_child-context-autocompaction.md
---

# Research: q-manager child context exhaustion recovery

## Brainstorm Summary

- Desired outcome: q-manager child sessions either compact before provider context-window failure or surface deterministic manager-needed recovery with current session evidence.
- Scope: child launch/extension path, Pi JSONL provider-error shape, stale validation replacement, duplicate-delivery identity, recovery command behavior, tests, and Pi child compaction capability.
- Constraints: do not invent durable `qrspi_result`; preserve pane/session refs and latest-session recovery paths; keep parent manager compaction distinct from child handling.
- Open tension: Pi has built-in auto-compaction surfaces, but q-manager's child `agent_end` validator currently observes session state before Pi has persisted the terminal assistant message.

## Research Question

This pass answers `questions/2026-07-04_19-35-18_child-context-autocompaction.md`: child launch/instrumentation, provider-error JSONL shape, `child-complete`/`continue`/`inspect`/recovery classification, generation/delivery semantics, safe commands, existing tests, and Pi child compaction APIs/settings.

## Evidence Boundary

Use `AGENTS.md`, brainstorm, and bug reports for framing only. Code, tests, docs, local runtime state, and Pi source are the factual sources below.

## Summary

q-manager launches visible Pi children with `--extension`, `--session-id`, and `--session-dir` under the plan workspace; the child extension only runs `child-complete` on `agent_end` and does not call `ctx.getContextUsage()` or `ctx.compact()`. Pi exposes `ctx.getContextUsage()` and non-awaited `ctx.compact()` to extensions, has default auto-compaction enabled, and detects OpenAI `exceeds the context window` errors; however Pi emits `agent_end` extension events before persisting the final assistant message, so `child-complete` can validate an older blocked result while the terminal provider-error message appears later in JSONL. Current Vamos parsers ignore `errorMessage`, skip error/aborted messages when extracting final QRSPI text, and only classify child context exhaustion from extracted assistant text/output evidence plus status/done/no-result. Steering the same child does not increment `ActiveChild.Generation`; retry-exhausted invalid delivery IDs collapse to `child:generation:invalid_result`, while validated delivery IDs preserve stage/status/outcome/artifact. Existing tests cover text-based context exhaustion, duplicate suppression, latest-session rebind, and malformed/aborted parsing, but no fixture covers valid blocked result -> same-child steering -> later empty-content provider context error.

## Detailed Findings

### 1. How child Pi sessions launch, get instrumented, and complete

- `BuildChildCommand` runs `pi` in an interactive tmux child and includes `--extension "$Q_MANAGER_CHILD_EXTENSION" --session-id "$SESSION_ID" --session-dir "$SESSION_DIR" --name "$SESSION_NAME" "@$PROMPT_FILE"` when an extension path is present. `cmd/vamos-runtime/internal/qrspicmd/child.go:112`
- The child command exports q-manager fields including parent pane, state file, plan dir, stage, child ID, run paths, validation-status path, wake mode, session ID, session dir, extension path, and optional model. `cmd/vamos-runtime/internal/qrspicmd/child.go:34`, `cmd/vamos-runtime/internal/qrspicmd/child.go:72`
- Child sessions are stored under the plan/workspace `.sessions/pi` directory when `CanonicalPlanDir` or `PlanDir` is known; only if no plan/cwd exists does code fall back to local manager state `runs/<child>/sessions`. `cmd/vamos-runtime/internal/qrspicmd/root.go:1076`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1082`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1085`
- `RunChild` creates the `ChildRunRequest`, starts a tmux split, saves `ActiveChild` with `LifecycleStatus: "running"` and `Generation: 1`, and only resolves `SessionPath` after waiting for done in timeout-driven paths. `cmd/vamos-runtime/internal/qrspicmd/root.go:1357`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1398`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1455`
- The child extension registers only `pi.on("agent_end")`; on that event it runs `vamos qrspi child-complete --state-file ... --child-id ... --output json`, reads validation status if the helper produced nothing, writes diagnostic status fields, and touches the done marker. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:27`, `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`, `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:98`
- The extension's `shouldWakeManager` treats `validated`, `managerNeeded`, or `retryExhausted` validation as wake-worthy, but wake delivery is actually produced by Go `RunChildComplete`/`queueOrDeliverWake`; the extension records the helper's wake mode/reason in status diagnostics. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:61`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1477`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1743`
- The shell wrapper writes `{"exitCode":...,"finishedAt":...}` to the same status path after `pi` exits, which can overwrite the extension's richer `agent_end` status object. `cmd/vamos-runtime/internal/qrspicmd/child.go:149`; observed run status files currently contain only `exitCode` and `finishedAt`. `/home/ruby/.local/state/vamos/q-manager/e4f1eb9cda298fc532b1371c1ceeff5c0b39f682ea8afb6e9f9300ff04bcdfde/runs/verify-20260704153722-841317071/status.json:1`

### 2. Pi JSONL provider-error, abort, compaction, and normal-result shapes

- Pi/agent-core stream functions must encode request failures as a final assistant message with `stopReason: "error"` or `"aborted"` and `errorMessage`; provider/runtime failures should not throw/reject as the final transport contract. `/home/ruby/dotfiles/context/pi/packages/agent/src/types.ts:22`
- `AssistantMessage` includes optional `errorMessage`; Pi docs say final messages with error or abort contain error details and partial content in `message.content`. `/home/ruby/dotfiles/context/pi/packages/agent/src/types.ts:341`; `/home/ruby/dotfiles/context/pi/packages/ai/README.md:1305`
- The actual failed Codex sessions end with a single JSONL `message` entry whose assistant message has `content: []`, `api: "openai-codex-responses"`, `provider: "openai-codex"`, `model: "gpt-5.5"`, zero usage, `stopReason: "error"`, `responseId`, and `errorMessage: "Codex error: Your input exceeds the context window of this model. Please adjust your input and try again."` `/home/ruby/cn/chestnut-flake/vamos/thoughts/creative-mode-agent/plans/2026-07-04_10-49-18_workbench-renderer-actions-comments/.sessions/pi/2026-07-04T22-57-14-939Z_verify-20260704155713-893013177.jsonl:291`; `/home/ruby/cn/chestnut-flake/vamos/thoughts/creative-mode-agent/plans/2026-07-04_12-01-45_streamlit-websocket-e2e/.sessions/pi/2026-07-04T22-37-23-672Z_verify-20260704153722-841317071.jsonl:134`
- Searches for `compact`/`compaction` in both failed child JSONL files returned no matches, while the bug reports recorded the same absence. `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/reports/2026-07-04_16-51-11_qrspi-child-autocompact-context-window-bug.md:78`
- Current Vamos `sessionMessage` parses role, content, and stopReason, but has no `ErrorMessage` field. `cmd/vamos-runtime/internal/qrspicmd/session_result.go:20`, `cmd/vamos-runtime/internal/qrspicmd/session_result.go:24`
- `ExtractFinalAssistantTextFromSession` asks `extractLastAssistantTextFromSession` for only assistant text containing `qrspi_result`; when `requireQRSPIResult` is true, messages with `stopReason == "error"` or `"aborted"` are skipped. `cmd/vamos-runtime/internal/qrspicmd/session_result.go:105`, `cmd/vamos-runtime/internal/qrspicmd/session_result.go:157`
- `ExtractLastAssistantTextFromSession` does not require a QRSPI result, but it still returns only text blocks/string content. Empty-content provider-error messages are skipped because `textBlocksFromAssistantMessage` returns empty text and the scanner continues. `cmd/vamos-runtime/internal/qrspicmd/session_result.go:120`, `cmd/vamos-runtime/internal/qrspicmd/session_result.go:166`
- Session tests cover normal final QRSPI extraction, malformed/tool/thinking filtering, aborted assistant text being ignored for final QRSPI extraction, missing QRSPI result errors, and string content, but they do not include an empty-content `stopReason:"error"` + `errorMessage` fixture. `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go:64`, `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go:82`, `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go:101`

### 3. `child-complete`, `continue`, `inspect`, `validate-latest`, and `recover-manual` classification

- `RunChildComplete` loads the active child, reads child result text from the active session via `ReadChildResultText`, then parses/normalizes/validates the QRSPI result. Valid parsed results set `Validated=true`, compute a delivery ID, set `LifecycleStatus="completed"`, and call `queueOrDeliverWake`. `cmd/vamos-runtime/internal/qrspicmd/root.go:1477`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1508`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1519`
- On parse/read errors, `RunChildComplete` either reprompts the same child while retry remains or emits a retry-exhausted invalid-result manager-needed wake after retry limit; otherwise it returns the error. `cmd/vamos-runtime/internal/qrspicmd/root.go:1535`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1580`
- `RunChildComplete` writes `validation-status.json` only after building the current `ChildCompletionStatus`; when it parsed the stale valid blocked result, the on-disk status remained `validated: true`, `result.status: blocked`, and `wake.reason: duplicate_delivery` even though latest JSONL had a later provider error. `cmd/vamos-runtime/internal/qrspicmd/root.go:1616`; `/home/ruby/.local/state/vamos/q-manager/e4f1eb9cda298fc532b1371c1ceeff5c0b39f682ea8afb6e9f9300ff04bcdfde/runs/verify-20260704153722-841317071/validation-status.json:2`; `/home/ruby/.local/state/vamos/q-manager/e4f1eb9cda298fc532b1371c1ceeff5c0b39f682ea8afb6e9f9300ff04bcdfde/runs/verify-20260704153722-841317071/validation-status.json:24`
- `InspectActiveChildHealth` first calls `ChildHasQRSPIResult`; if any active child session text contains `qrspi_result`, it returns `finished_success_needs_result_validation` immediately, before looking for context-exhaustion evidence in later session text. `cmd/vamos-runtime/internal/qrspicmd/child_health.go:38`, `cmd/vamos-runtime/internal/qrspicmd/child_health.go:41`
- If no QRSPI result is found, health can become `context_exhausted_no_result` only when status exists, done marker exists, no QRSPI result exists, and `HasChildContextExhaustionEvidence` matches context needles in evidence/output tail/extracted assistant text. `cmd/vamos-runtime/internal/qrspicmd/child_health.go:77`, `cmd/vamos-runtime/internal/qrspicmd/child_health.go:148`
- Because the extractor ignores empty `errorMessage`-only assistant messages, `HasChildContextExhaustionEvidence` cannot currently see the observed Codex context-window error unless it also appears in output tail/status/evidence. `cmd/vamos-runtime/internal/qrspicmd/session_result.go:166`, `cmd/vamos-runtime/internal/qrspicmd/child_health.go:145`
- `RunInspect --sessions --latest` prints active child health and latest session path/classification; it only prints the terminal-failed safe command when `IsTerminalFailedChild` is true, otherwise it prints `continueCommand`. `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:47`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:65`
- `RunContinue` checks `InspectActiveChildHealth` before validating; if health is recoverable no-result child, it writes a `child_context_exhausted` action card; if launch failed, it writes a launch-failed card; otherwise it validates active child text. `cmd/vamos-runtime/internal/qrspicmd/root.go:2720`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2765`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2769`
- The `child_context_exhausted` action card includes child/stage, session path or dir, status, evidence/output tail, safe command `vamos qrspi inspect --state-file ... --sessions --latest`, and continue command `vamos qrspi recover-manual --state-file ... --mode latest-session --continue`. `cmd/vamos-runtime/internal/qrspicmd/root.go:2875`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2892`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2902`
- `RunValidateLatest` finds the newest relevant JSONL; with `--apply-rebind` it rebinds active child, and with `--continue` it runs `RunContinue`. Without `--continue`, it parses the candidate session. `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:154`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:162`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:176`
- `RunRecoverManual --mode latest-session` always rebinds active child to the latest relevant session, saves state, and with `--continue` runs `RunContinue`; otherwise it prints `safe command: vamos qrspi validate-latest --state-file ... --apply-rebind --continue`. `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:216`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:223`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:237`

### 4. Child generations, steering/rebinding, delivery IDs, and duplicate suppression after steering

- `ChildRunRef` stores `LastDeliveryID`, `LifecycleStatus`, `Generation`, `ValidationRetryCount`, and `LastRepromptAttempt`; manager delivery state stores global `LastDeliveryID` and optional queued wake with `ChildGeneration`. `cmd/vamos-runtime/internal/qrspicmd/state.go:29`, `cmd/vamos-runtime/internal/qrspicmd/state.go:48`
- Valid delivery IDs are `child.ID:generation:sourceNode:status:outcome:artifact`; exhausted/invalid IDs are `child.ID:generation:invalid_result`. `cmd/vamos-runtime/internal/qrspicmd/root.go:1668`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1673`
- `queueOrDeliverWake` suppresses any status whose `DeliveryID` equals `state.Delivery.LastDeliveryID`; delivered wakes update `state.Delivery.LastDeliveryID`. `cmd/vamos-runtime/internal/qrspicmd/root.go:1759`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1798`
- `RunSteerChild` pastes feedback into the active child pane and returns a continue command; it does not update `ActiveChild.Generation`, `LifecycleStatus`, `LastDeliveryID`, or queued wake state. `cmd/vamos-runtime/internal/qrspicmd/root.go:2566`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2603`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2615`
- `RunMarkChildActive` is the command that increments active child generation, sets lifecycle `manual_reprompt`, and supersedes queued wakes. `cmd/vamos-runtime/internal/qrspicmd/root.go:2405`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2429`
- Rebinding latest-session recovery also increments generation from the previous active child and supersedes stale queued wakes. `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:282`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:298`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:336`
- The failed runtime states show stale validated blocked delivery IDs of form `verify-...:1:verify:blocked::thoughts/.../verify.md` plus `wake.reason: duplicate_delivery` after later provider-error JSONL lines. `/home/ruby/.local/state/vamos/q-manager/7864017dd2de9b7cec5186d5a1daea1e7e7908e96b85cfbff09b2e465565e471/runs/verify-20260704155713-893013177/validation-status.json:6`; `/home/ruby/.local/state/vamos/q-manager/7864017dd2de9b7cec5186d5a1daea1e7e7908e96b85cfbff09b2e465565e471/runs/verify-20260704155713-893013177/validation-status.json:24`

### 5. Safe deterministic recovery commands and action-card evidence

- The q-manager manifest documents that `child_context_exhausted` means a child ended with context-limit/no-result evidence and that recovery should preserve refs, inspect latest session, compact/resume the same child only when evidence is real, or relaunch the same graph node after salvage is impossible. `docs/q-manager.md:76`
- The same manifest lists deterministic self-heal commands: `doctor`, `repair-state --align-active-child`, `repair-state --clear-failed-child --relaunch`, `mark-child-active`, `inspect --sessions --latest`, `find-latest-child`, `validate-latest --apply-rebind`, and `recover-manual --mode latest-session --continue`. `docs/q-manager.md:92`
- `BuildChildContextExhaustedCard` currently exposes `inspect --sessions --latest` as the safe command and `recover-manual --mode latest-session --continue` as the continue command. `cmd/vamos-runtime/internal/qrspicmd/root.go:2892`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2902`
- `InspectActiveChildHealth` sets a Pi resume command (`pi --resume <sessionPath> # then run /compact only if this is the exhausted child session`) only inside the low-level health object; the manager-facing action card's safe command is `inspect`, not direct `pi --resume`. `cmd/vamos-runtime/internal/qrspicmd/child_health.go:87`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2897`
- Current code has no `ChildCompletionStatus` field for session path or provider error; wake payload includes validation state, stage/status/outcome/artifact, child ID, state file, reason, policy, summary, next child, and continue command. `cmd/vamos-runtime/internal/qrspicmd/options.go:149`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1851`

### 6. Existing test coverage and missing regression fixture

- `child_health_test.go` covers context exhaustion only when extracted assistant text contains context phrases, e.g. `provider error: context length exceeded...` or `compaction failed after maximum context window...`; it does not model empty-content assistant errors with `errorMessage`. `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go:141`, `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go:191`
- `child_health_test.go` verifies `RunContinue` writes a `child_context_exhausted` action card and does not advance workflow when health is `context_exhausted_no_result`. `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go:202`, `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go:215`
- `child_completion_test.go` covers validated status writing, duplicate `RunChildComplete` suppression, manager-compacting queueing, positive outcome normalization, and invalid-result suppress-then-exhaust behavior. `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go:12`, `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go:99`, `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go:355`
- `session_recovery_test.go` covers finding latest relevant child session, rebind incrementing generation/superseding queued wake, and `validate-latest --apply-rebind --continue` advancing from the latest valid session. `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go:12`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go:80`, `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go:143`
- `delivery_test.go` covers duplicate wake suppression by `LastDeliveryID` and queued-wake supersession for newer generation, but not a later terminal provider error after same-child steering. `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:72`, `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:193`
- No existing test found covers valid blocked result -> manager steers same child -> later empty-content `stopReason:"error"` + context-window `errorMessage` -> `child-complete`/`continue`/`inspect` surfacing manager-needed provider-error recovery. `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go:82`, `cmd/vamos-runtime/internal/qrspicmd/steer_child_test.go:12`

### 7. Pi APIs/settings for automatic child compaction

- Pi docs state sessions support manual `/compact` and automatic compaction; automatic compaction triggers on context overflow recovery/retry or when approaching the limit. `/home/ruby/dotfiles/context/pi/packages/coding-agent/README.md:196`
- Pi settings default compaction to enabled with reserve tokens `16384` and recent kept tokens `20000`; `shouldCompact` triggers when `contextTokens > contextWindow - reserveTokens`. `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/settings-manager.ts:754`, `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/settings-manager.ts:767`, `/home/ruby/dotfiles/context/pi/packages/agent/src/harness/compaction/compaction.ts:202`
- Pi extension handlers receive `ctx.getContextUsage()` and `ctx.compact()`; docs specify `ctx.compact()` triggers compaction without awaiting completion and uses callbacks for completion/error. `/home/ruby/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:984`, `/home/ruby/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:995`
- The upstream `trigger-compact.ts` example calls `ctx.getContextUsage()` on `turn_end` and then `ctx.compact(...)` after crossing a token threshold. `/home/ruby/dotfiles/context/pi/packages/coding-agent/examples/extensions/trigger-compact.ts:25`, `/home/ruby/dotfiles/context/pi/packages/coding-agent/examples/extensions/trigger-compact.ts:44`
- The existing project parent q-manager extension uses `ctx.getContextUsage()` from a command context, passes explicit manager usage flags to the Go CLI, and calls `ctx.compact()` only after the CLI reports `q-manager-parent-compact: started`. `.pi/extensions/q-manager-parent.ts:35`, `.pi/extensions/q-manager-parent.ts:197`
- Pi emits extension `agent_end` before session persistence and before `_lastAssistantMessage` drives post-run retry/compaction handling: `_handleAgentEvent` calls `_emitExtensionEvent(event)` first, then persists messages and tracks `_lastAssistantMessage`; `_handlePostAgentRun` later calls `_checkCompaction(msg)`. `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:514`, `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:537`, `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:979`
- Pi recognizes `exceeds the context window` as an OpenAI overflow pattern, and `_checkCompaction` treats same-model context overflow error messages as overflow, with one compact-and-retry attempt for non-`stop` errors. `/home/ruby/dotfiles/context/pi/packages/ai/src/utils/overflow.ts:39`, `/home/ruby/dotfiles/context/pi/packages/ai/src/utils/overflow.ts:126`, `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1842`
- The current q-manager child extension does not use `turn_end`, `ctx.getContextUsage()`, `ctx.compact()`, `session_before_compact`, or `session_compact`; its only Pi hook is `agent_end`. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`

## Code References

- `cmd/vamos-runtime/internal/qrspicmd/child.go:112` — child Pi command includes extension/session flags.
- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75` — child extension `agent_end` hook invokes `child-complete`.
- `cmd/vamos-runtime/internal/qrspicmd/session_result.go:20-166` — session entry parsing ignores `errorMessage` and extracts only text blocks.
- `cmd/vamos-runtime/internal/qrspicmd/child_health.go:38-87` — active child health classification order and context-exhaustion action.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:1477-1616` — `RunChildComplete` parses active session, writes validation status, and queues/delivers wake.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:1668-1798` — delivery ID construction and duplicate suppression.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2720-2902` — `RunContinue` health gate and `child_context_exhausted` card.
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:154-237` — latest-session validate/rebind/recover flows.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2566-2622` — `steer-child` paste path does not increment generation.
- `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:514-979` — Pi event persistence and post-agent compaction ordering.
- `/home/ruby/dotfiles/context/pi/packages/ai/src/utils/overflow.ts:39-126` — provider overflow error detection.

## Historical Context

- The first bug report records that a verify child exceeded model context after useful work and no final `qrspi_result` was emitted; inspect classified it as `finished_success_needs_result_validation`. `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/bug-reports/2026-07-04_16-50-02_q-manager-child-context-compaction-missed.md:16`, `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/bug-reports/2026-07-04_16-50-02_q-manager-child-context-compaction-missed.md:55`
- The second report records the exact same error shape, stale `validation-status.json`, duplicate delivery suppression, and inspect misclassification after same-child steering. `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/reports/2026-07-04_16-51-11_qrspi-child-autocompact-context-window-bug.md:57`, `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/reports/2026-07-04_16-51-11_qrspi-child-autocompact-context-window-bug.md:93`, `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/reports/2026-07-04_16-51-11_qrspi-child-autocompact-context-window-bug.md:135`
- `docs/q-manager.md` already documents `child_context_exhausted` recovery semantics and latest-session recovery commands, but current code only reaches that card for text/output-detectable context exhaustion without an older QRSPI result. `docs/q-manager.md:76`, `docs/q-manager.md:92`

## Surprises

- Pi's `agent_end` extension hook runs before Pi persists the final assistant message; q-manager's child extension invokes `child-complete` exactly there, so validation can read stale prior QRSPI text instead of the just-finished provider-error assistant message. `/home/ruby/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:514`, `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:75`
- Same-child `steer-child` does not increment generation; only `mark-child-active` and rebind do. That leaves same-child post-steer completions in generation 1 unless a separate mark/rebind command runs. `cmd/vamos-runtime/internal/qrspicmd/root.go:2566`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2429`
- The child status path can be written first by the extension and then overwritten by the shell wrapper's exit-code JSON. `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:98`, `cmd/vamos-runtime/internal/qrspicmd/child.go:149`
- Pi source already recognizes the exact OpenAI/Codex context-window string as overflow; the observed q-manager failure is not because the phrase is unknown to Pi. `/home/ruby/dotfiles/context/pi/packages/ai/src/utils/overflow.ts:39`

## Open Questions

- Whether Pi actually attempted auto-compaction after the recorded `agent_end` in the failed runs cannot be determined from current source alone; the JSONL files contain no compaction entries and the bug reports found no compaction markers.
- Whether q-manager should depend on Pi's built-in post-run auto-compaction, add child-extension pre/post hooks, or handle terminal provider errors entirely in Go is a design decision, not settled by research.
- Whether same-child `steer-child` should always mark a new generation before feedback is pasted is a design decision; current facts only show it does not.
