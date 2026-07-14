---
date: 2026-07-14T15:34:21-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 5abf7fa87e3e8cfee8ecada9ea8b2b4e40f16216
branch: main
repository: vamos
stage: research
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Research: q-manager session handoff rotation

## Brainstorm Summary

- Replace Pi compaction with proactive durable handoff plus fresh-session rotation for manager and managed child sessions.
- Child continuity uses normal QRSPI handoff semantics; manager continuity uses a lightweight control-plane handoff containing local recovery refs.
- Rotation must begin at a stable boundary before another normal provider request; `agent_end` is too late for the intended trigger.
- One `turn_end` follows completion of the whole concurrent tool batch, so reserve must include aggregate batch output plus handoff work.
- A successor must read the handoff before resuming; the old session remains inspectable but must not retain active ownership.
- Preserve exactly-once ownership, stale-wake suppression, deterministic recovery, visible child panes, and graph-validated QRSPI results.

## Research Question

Answers the seven questions in `thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/questions/2026-07-14_13-10-05_q-manager-session-handoff-rotation.md` against the current Vamos working tree and Pi source at `/Users/swarm/dotfiles/context/pi` commit `dcfe36c79702ec240b146c45f167ab75ecddd205`.

## Evidence Boundary

`AGENTS.md` and the question document supply framing only. Current behavior below is grounded in current code, docs, and tests. The Vamos working tree contained unrelated pre-existing modifications during research, so cited Vamos lines describe the inspected working tree rather than only commit `5abf7fa8`.

## Summary

- Pi completes every tool in a turn—including the full parallel batch—before awaited `turn_end` handlers run. After `turn_end`, the low-level loop refreshes next-turn state, optionally checks an internal stop callback, then drains steering and follow-up queues before another provider request. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:205-274`
- `turn_end` is the earliest public extension event after a stable full turn, but coding-agent extensions cannot return the low-level `shouldStopAfterTurn` signal. `agent_end` can still be followed by retry, compaction, or queued continuation; only `agent_settled` means those continuations are exhausted. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:204-221`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:704-722`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1048-1065`
- `ctx.getContextUsage()` is not the exact next outbound payload size. It uses the last valid assistant-reported usage plus a chars/4 estimate for trailing session messages, can be unknown after compaction, and does not account for later `context` mutations or provider-payload rewrites. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:3078-3119`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:120-200`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:1029-1088`
- The canonical QRSPI graph currently accepts `status: handoff` only for `implement` and `verify`; all other agent nodes reject it before same-node continuation. — `pkg/agents/workflows/qrspi/definition_agentchat.go:35-105`; `pkg/agents/workflows/qrspi/transition_test.go:100-139`
- Current child handoff continuation is graph-driven: a valid handoff queues the same node, a fresh child/session is launched, and the previous pane is killed only after the replacement child is saved. The manager itself still uses native compaction, not fresh-session replacement. — `pkg/agents/workflows/runtime/transition.go:64-83`; `cmd/vamos-runtime/internal/qrspicmd/root.go:3170-3191`; `cmd/vamos-runtime/internal/qrspicmd/root.go:3436-3475`; `cmd/vamos-runtime/internal/qrspicmd/root.go:4206-4232`; `.pi/extensions/q-manager-parent.ts:26-48`
- No single safe reserve can be derived from current measurements. Pi's default reserve is 16,384 tokens, while each built-in tool can contribute up to 50 KB/~10k tokens and parallel batch cardinality is not capped at the extension boundary. q-manager's fixed 90% threshold leaves model-dependent headroom and has no child pre-turn monitor. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:94-106`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:2034-2078`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:506-557`; `cmd/vamos-runtime/internal/qrspicmd/options.go:102-116`

## Detailed Findings

### 1. Pi lifecycle ordering and synchronization guarantees

#### Turn and tool-batch ordering

- A turn consists of one assistant response and its tool calls/results. Pi gathers all tool calls from the assistant message, executes the batch, appends every resulting `toolResult` to current context, and only then emits `turn_end`. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:187-224`
- In parallel mode, tool preflight is sequential, allowed tool executions are collected and awaited with `Promise.all`, `tool_execution_end` follows completion order, then final tool-result messages are emitted in assistant source order. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:506-557`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:31-42`
- The Pi tests confirm that both parallel tools finish before steering is injected, and that `turn_end.toolResults` contains the complete source-ordered batch. — `/Users/swarm/dotfiles/context/pi/packages/agent/test/agent-loop.test.ts:527-617`; `/Users/swarm/dotfiles/context/pi/packages/agent/test/agent-loop.test.ts:637-727`
- Agent listeners are awaited in registration order. `AgentSession` subscribes its internal handler and awaits extension `turn_end` handlers before the low-level loop continues. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent.ts:238-246`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent.ts:523-575`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:674-696`

#### Boundary after `turn_end`

- Immediately after `turn_end`, the low-level loop calls `prepareNextTurn`, applies any replacement context/model/thinking state, then calls `shouldStopAfterTurn`. Only after those steps does it poll steering messages. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:224-260`
- If `shouldStopAfterTurn` returns true, the loop emits `agent_end` before polling steering or follow-up queues and before another provider call. The callback receives context after the assistant message and all tool results are appended. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:116-131`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:204-213`; `/Users/swarm/dotfiles/context/pi/packages/agent/test/agent-loop.test.ts:1060-1137`
- `AgentLoopConfig` exposes `shouldStopAfterTurn`, but the `Agent` class options/fields and coding-agent `ExtensionAPI` do not expose that callback. The `Agent` class currently forwards `prepareNextTurn`, queue getters, and tool hooks, but not `shouldStopAfterTurn`. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:204-221`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent.ts:83-118`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent.ts:431-466`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:1187-1200`
- Public `turn_end` extension handlers return no control result; their event type supplies the assistant message and batch tool results only. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:716-722`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:1196-1200`

#### Steering, follow-up, provider request, and settlement

- Steering is polled after every completed turn and injected before the next assistant response. Follow-up is polled only when there are no more tool calls and no steering messages. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:258-274`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:225-246`
- The coding-agent session removes a delivered queued message from UI tracking when its user-message event begins. Queue contents can therefore change between `turn_end`, the next `turn_start`, and the next provider call. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:549-568`
- Before each provider call, Pi applies the `context` extension transform, converts messages to provider-compatible messages, builds `{systemPrompt, messages, tools}`, and invokes the stream function. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:282-313`
- `before_provider_request` runs after the provider-specific payload is serialized and directly before transmission; it can replace the payload but has no cancellation result. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:671-688`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:661-668`
- Low-level `agent_end` is the final event for one agent run, but `AgentSession` then evaluates automatic retry, automatic compaction, and any messages queued by `agent_end` handlers. Any of those can call `agent.continue()` and start another provider run. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1048-1065`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1891-1992`
- `agent_settled` is emitted only in `_runAgentPrompt`'s finalizer after the retry/compaction/queued-continuation loop ends; `ctx.isIdle()` is normally true by then. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:529-540`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1048-1065`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:551-565`

**Direct answer:** `turn_end` is a synchronized, awaited, full-turn boundary before queue polling and the next provider request. Public extensions can observe it but cannot currently stop that next request through a return value. `agent_end` is later and not settled; `agent_settled` is latest and guarantees no automatic continuation remains.

### 2. Accuracy of `ctx.getContextUsage()` by candidate hook

#### Calculation

- `getContextUsage()` returns `undefined` without an active model or positive model context window. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:3078-3084`
- After compaction, if no non-error/non-aborted assistant with positive usage exists after the latest compaction entry, it returns `{tokens: null, percent: null}`. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:3085-3111`
- Otherwise it calls `estimateContextTokens(this.messages)`: last valid assistant usage becomes the base, and all messages after that assistant are estimated with a chars/4 heuristic. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:3113-3119`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:147-200`
- Assistant usage is treated as `usage.totalTokens`, or the sum of input, output, cache-read, and cache-write values when `totalTokens` is zero. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:116-122`
- The trailing estimator counts text, thinking, serialized tool-call arguments, tool-result/custom content, bash output, and summary text. It estimates each image as 4,800 characters, then divides characters by four. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:210-273`

#### Hook-specific state

- At assistant `message_end`, the finalized assistant already exists in Agent state before listeners run, but `AgentSession` persists it only after extension handlers finish. A call from that hook sees the assistant in `this.messages`, including its reported usage. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent.ts:534-549`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:570-618`
- At `tool_result`/`tool_execution_end`, the current tool result has not yet been emitted as a final `toolResult` message or appended to session state. In parallel mode, sibling results may still be running. Usage sampled there can omit current and sibling batch output. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:454-478`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:542-557`
- At `turn_end`, all batch tool-result messages have been appended to Agent state and passed in `event.toolResults`; `getContextUsage()` therefore includes them as trailing chars/4 estimates after the last assistant usage. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:205-224`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:687-695`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:176-200`
- At `agent_end`, the same completed-run messages are present, but an `agent_end` handler can enqueue new steering/follow-up work that is not part of the sample taken before enqueueing. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:678-680`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1062-1065`
- At `agent_settled`, all automatic continuations have finished, so it is accurate for the settled transcript estimate, not for any future prompt that has not yet been submitted. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:529-540`
- In an idle extension command, such as current `/q-manager`, usage describes the current transcript before the command invokes the CLI. The command's own UI notifications and CLI stdout do not enter LLM context, but any later replacement/handoff prompt does. — `.pi/extensions/q-manager-parent.ts:29-48`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:347-375`

#### Missing parts of an exact next-request count

- With no valid assistant usage, the estimate sums session messages only; it does not add the system prompt or tool schemas. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:176-188`
- `before_agent_start` can add persistent custom messages and change the system prompt after a command's usage sample. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1177-1214`
- The `context` event can replace messages before each LLM call, and `before_provider_request` can replace the serialized provider payload. Neither mutation is reflected in the earlier session-state estimate. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:653-688`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:1051-1088`
- Provider-side tokenization and serialization overhead are not computed by `estimateTokens`; its implementation is a character heuristic. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:229-273`

**Direct answer:** `turn_end` is the most complete public pre-next-turn sample because it includes the entire tool batch, but the value remains an estimate of session context, not the exact next outbound provider payload. `tool_result` is too early for a parallel batch; command/start hooks can miss new prompt/system changes; post-compaction usage can be null.

### 3. Graph-wide `status: handoff` and same-node continuation

- Runtime recognizes `handoff` as a general status, but each graph node must list it in its `ResultContract`. — `pkg/agents/workflows/runtime/definition.go:19-31`; `pkg/agents/workflows/runtime/definition.go:67-84`; `pkg/agents/workflows/runtime/transition.go:168-195`
- A valid handoff sets workspace state to idle, sets `PendingNextNodeID` to the same source node, and returns that node with `StartNext` according to advance mode. It does not follow an outcome edge. — `pkg/agents/workflows/runtime/transition.go:64-83`
- In the canonical Agent Chat QRSPI graph, only `implement` and `verify` declare `StatusHandoff`. — `pkg/agents/workflows/qrspi/definition_agentchat.go:88-101`
- `question`, `research`, `design`, `outline`, `review-outline`, review-research helpers, `plan`, `review-plan`, `workspace`, and `review-implementation` do not declare `handoff`; `ValidateWorkflowResult` rejects it for those nodes. — `pkg/agents/workflows/qrspi/definition_agentchat.go:35-88`; `pkg/agents/workflows/qrspi/definition_agentchat.go:94-105`; `pkg/agents/workflows/runtime/transition.go:168-177`
- Tests assert same-node handoff only for `implement` and `verify`, including pending-node state and `StartNext=true` under default guided policy. — `pkg/agents/workflows/qrspi/transition_test.go:100-139`
- The parser permits a handoff without `outcome`; only `status: complete` requires outcome. It still requires stage, summary, valid next-step entries, and graph-level primary artifact where the node contract requires one. — `pkg/agents/workflows/qrspi/result_yaml.go:337-374`; `pkg/agents/workflows/runtime/transition.go:178-195`
- q-manager maps a handoff decision to `continue_pending`; guided/autopilot starts the same node, while discuss mode leaves it pending. — `pkg/agents/workflows/qrspi/semantic/next_action.go:45-80`; `pkg/agents/workflows/runtime/transition.go:64-83`

**Direct answer:** graph-wide handoff support does not exist. Current valid same-node handoff/resume coverage is exactly `implement` and `verify`; every other child agent stage currently lacks a valid `status: handoff` contract.

### 4. Handoff artifact and prompt contract boundaries

#### Normal QRSPI handoff

- `q-handoff` defines handoff mode as stop-work mode and permits only inspection plus writing the handoff artifact. — `.pi/skills/q-handoff/SKILL.md:71-83`; `.pi/skills/q-handoff/SKILL.md:149-160`
- A normal checkpoint writes `[plan_dir]/handoffs/<timestamp>_<stage>-handoff.md`, records status, learnings, decisions, context artifacts, verification, next work, and a required future-agent notes footer. — `.pi/skills/q-handoff/SKILL.md:225-278`
- Non-final implementation checkpoints emit `status: handoff`, omit outcome, retain the current stage, and route through `q-resume`; manager operational handoffs also use `status: handoff` but route to `q-manager continue`. — `.pi/skills/q-handoff/SKILL.md:193-201`; `.pi/skills/q-handoff/SKILL.md:314-324`
- `q-resume` requires the exact handoff, then stage-specific artifacts. For implementation it additionally loads `q-implement`, plan memory, questions, design, outline, plan, research, and relevant context before continuing one work chunk. — `.pi/skills/q-resume/SKILL.md:105-134`

#### Manager operational handoff

- The q-manager skill treats manager handoff as control-plane continuity, not stage reasoning. Its required markdown fields include durable plan identity, source/implementation cwd, graph node, latest durable result, state file, full active child refs, wait/continue status, and an exact next command. — `.pi/skills/q-manager/SKILL.md:187-218`
- Local manager refs are permitted in the markdown but forbidden as structured fields in durable `qrspi_result` YAML. — `.pi/skills/q-manager/SKILL.md:206-218`; `.pi/skills/q-handoff/SKILL.md:91-96`
- Current generated operational handoff records plan dir, current node, implementation cwd, state file, source cwd, manager run/pane, and a compact active-child string. It does not include latest durable result YAML/path, child session directory, output path, or validation-status path required by the skill contract. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2391-2443`; `.pi/skills/q-manager/SKILL.md:195-204`

#### Child prompt rendering

- q-manager renders every fresh child prompt with ordered reads for `qrspi-planning`, the graph-selected node skill, plan `AGENTS.md`, and latest primary artifact, then embeds the full prior canonical `qrspi_result` YAML. — `cmd/vamos-runtime/internal/qrspicmd/prompt.go:37-78`
- For a handoff, the latest primary artifact is the handoff path and the prior YAML carries its explicit `next.steps`. The prompt instructs the child to read the artifact; it does not inline the markdown handoff body. — `cmd/vamos-runtime/internal/qrspicmd/prompt.go:44-71`
- A fresh child process receives a unique child ID, Pi session ID, and plan-owned `.sessions/pi` directory; q-manager launches it in a visible tmux split. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1383-1450`; `cmd/vamos-runtime/internal/qrspicmd/child.go:89-144`

**Direct answer:** normal handoffs own portable stage reasoning and resume artifacts; manager handoffs own machine-local orchestration refs. The existing child prompt path already reuses prior full YAML plus exact primary handoff path. Current generated manager handoff is narrower than the documented manager contract.

### 5. Deterministic fresh-session creation, injection, ownership transfer, and retirement

#### Pi APIs

- `ctx.newSession()` is available only to extension command handlers, not event handlers or tools. It supports parent-session linkage, pre-bind `SessionManager` setup, and a `withSession` callback receiving a fresh replacement-session context. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:338-375`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:1102-1133`
- Successful replacement emits old `session_shutdown`, tears down the old runtime, binds the replacement, emits new `session_start`, then runs `withSession`. Captured old `pi`, command context, and session manager become stale; only the callback's replacement context is valid. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:1225-1263`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:802-813`
- `withSession` can call async `sendUserMessage()` in the new session, while `setup` can append durable messages before binding. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:378-393`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:1102-1126`
- The programmatic SDK's `AgentSessionRuntime` provides `newSession`, `switchSession`, and `fork`; callers must re-subscribe and re-bind extensions because `runtime.session` changes. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/sdk.md:100-181`
- The example handoff extension generates a prompt, calls `ctx.newSession({parentSession, withSession})`, and writes the handoff prompt into the replacement editor. It requires a user submit rather than automatically starting the turn. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/examples/extensions/handoff.ts:124-188`

#### Current q-manager child ownership

- q-manager stores one `ActiveChild` ref. `start-next` refuses a duplicate while a nonterminal active child exists. — `cmd/vamos-runtime/internal/qrspicmd/state.go:5-21`; `cmd/vamos-runtime/internal/qrspicmd/root.go:713-739`; `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go:126-169`
- On a graph transition, q-manager first copies the old active child to `PendingCleanupChild`; after the new tmux child starts, it saves the new `ActiveChild`, then kills the pending old pane and clears pending cleanup. — `cmd/vamos-runtime/internal/qrspicmd/root.go:3408-3421`; `cmd/vamos-runtime/internal/qrspicmd/root.go:1438-1479`; `cmd/vamos-runtime/internal/qrspicmd/root.go:4188-4232`
- Child generation participates in delivery identity. Manual rebind/reprompt increments generation and supersedes queued wakes whose child/generation no longer matches. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1803-1823`; `cmd/vamos-runtime/internal/qrspicmd/root.go:2717-2756`; `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:517-547`
- `manager-ready` flush refuses a queued wake when generation differs or the active child is running/manual-reprompt. Duplicate delivery IDs are also suppressed. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2515-2547`; `cmd/vamos-runtime/internal/qrspicmd/root.go:1969-1994`
- State files are atomically replaced on save, and initialization uses a flock-protected plan lock with a 12-hour expiry. Normal state saves are not compare-and-swap operations and do not reacquire/refresh the plan lock. — `cmd/vamos-runtime/internal/qrspicmd/state_store.go:14-16`; `cmd/vamos-runtime/internal/qrspicmd/state_store.go:65-120`; `cmd/vamos-runtime/internal/qrspicmd/state_store.go:137-157`

#### Missing current manager rotation path

- The parent extension currently runs CLI `start-next|continue`, then invokes `ctx.compact()` when the CLI reports compaction started. It never calls `ctx.newSession()`. — `.pi/extensions/q-manager-parent.ts:26-48`; `.pi/extensions/q-manager-parent.ts:180-208`
- The current manager handoff tells a human/fresh manager to run `manager-ready`; q-manager does not create or seed a successor manager Pi session itself. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2409-2443`
- The child extension only runs on `agent_end`, calls `qrspi child-complete`, writes status, and touches done. It has no usage monitor, handoff trigger, or replacement-session operation. — `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:58-104`

**Direct answer:** Pi can deterministically replace a manager session from a command and inject successor work through `setup`/`withSession`. q-manager already has a deterministic fresh child launcher plus active/pending-cleanup refs and generation-based stale-wake suppression. No existing path combines those APIs into proactive manager or child rotation, and state persistence currently lacks a CAS/lease refresh boundary for concurrent old/new manager writers.

### 6. Measurable context-growth bounds and safe reserve

- The active model supplies `contextWindow` and `maxTokens`; model values vary by model. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:1438-1460`
- Pi's automatic compaction default reserves 16,384 tokens and triggers when estimated context exceeds `contextWindow - reserveTokens`; this is an output-room threshold, not a measured handoff-completion budget. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:94-106`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:202-208`
- Built-in/custom tool guidance requires truncation at 50 KB or 2,000 lines per tool output, described as roughly 10k tokens. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/docs/extensions.md:2034-2078`
- Parallel mode executes every allowed tool call in the assistant message and appends all results before the next turn. No batch-wide byte/token ceiling appears in the loop; the total batch can therefore be the sum of multiple individually truncated results. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:506-557`
- Assistant output is bounded by the selected model's `maxTokens`, but assistant text, thinking, and tool-call arguments all contribute to the trailing estimate. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:1456-1460`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:242-258`
- User prompts, loaded context-file contents, appended system prompt, and skill listings enter base prompt construction; no aggregate token limit is enforced in the inspected system-prompt options or prompt submission path. — `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:979-1017`; `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1090-1214`
- q-manager currently samples only when `/q-manager start-next|continue` is invoked and triggers at 90%. At 90%, nominal remaining context equals 10% of the model window, while Pi's default absolute reserve remains 16,384. — `.pi/extensions/q-manager-parent.ts:35-40`; `cmd/vamos-runtime/internal/qrspicmd/options.go:102-116`; `cmd/vamos-runtime/internal/qrspicmd/root.go:2244-2284`
- There is no current instrumentation recording per-turn delta by system prompt, user prompt, assistant output, individual tool, aggregate batch, or handoff generation. Existing manager usage state records only percent/tokens/window/source/timestamp. — `cmd/vamos-runtime/internal/qrspicmd/state.go:5-21`; `cmd/vamos-runtime/internal/qrspicmd/options.go:108-116`

**Direct answer:** current code provides component ceilings for model output and each tool result, but no batch-wide or handoff-work upper bound. Because usage is heuristic and parallel result count is uncapped at this boundary, the required safe reserve cannot be determined from current evidence. The existing 90% threshold is not proven sufficient across supported context windows/models.

### 7. Failure interleavings and existing test seams

#### Duplicate threshold/completion events

- Repeated completion for the same child/generation/result yields the same delivery ID and is suppressed after one paste. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1803-1823`; `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:11-87`
- Repeated `manager-ready` clears/flushes at most one queued wake; subsequent calls report no queued wake. — `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:137-211`
- Current manager compaction threshold code has no persisted rotation generation/idempotency key; repeated qualifying manager commands can write another timestamped operational handoff and leave delivery `compacting`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2240-2284`; `cmd/vamos-runtime/internal/qrspicmd/root.go:2351-2385`

#### Handoff and successor launch failure

- If manager handoff writing fails, `maybeStartManagerCompaction` returns before saving `Delivery.Status=compacting`. If state save fails after handoff write, the artifact can exist without delivery entering compacting state. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2258-2276`
- `RunChild` starts the tmux child before saving `ActiveChild`; a save failure can leave a launched child whose ownership was not persisted. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1428-1453`
- During normal graph continuation, old child refs move to pending cleanup before replacement launch. Cleanup runs only after the replacement `ActiveChild` save; cleanup failure preserves refs and reports `child_cleanup_failed`. — `cmd/vamos-runtime/internal/qrspicmd/root.go:3408-3421`; `cmd/vamos-runtime/internal/qrspicmd/root.go:1454-1481`
- Current tests cover failed-child relaunch and preservation of old child on launch paths, but no test invokes Pi `ctx.newSession()` or a manager-session successor. — `cmd/vamos-runtime/internal/qrspicmd/repair_state_test.go:62-108`; `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go:126-169`; `.pi/extensions/q-manager-parent.ts:26-48`

#### Unknown usage and large parallel batches

- Missing/unknown manager usage passes no CLI usage flags and skips manager compaction. Null token/percent states are deliberately converted to no flags by the parent extension. — `.pi/extensions/q-manager-parent.ts:93-112`; `cmd/vamos-runtime/internal/qrspicmd/root.go:2244-2256`; `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:26-51`
- Pi's parallel-loop tests cover completion/source ordering and steering only after all tools finish, but do not couple a large aggregate batch to context usage or handoff rotation. — `/Users/swarm/dotfiles/context/pi/packages/agent/test/agent-loop.test.ts:527-727`

#### Stale wakes and interrupted manager replacement

- Delivery tests cover queue-while-compacting, exactly-once flush, unavailable/dead parent pane adoption, and stale generation suppression. — `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:137-376`
- Session-recovery tests cover rebinding a newer child session, incrementing generation, clearing stale queued wake, and continuing from the rebound result. — `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go:69-245`
- Manager compaction tests cover the stable `q-manager-parent-compact: started` signal and a child wake that queues during compacting then flushes after `manager-ready`. — `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:156-267`
- These tests model compaction/rebind state transitions with fake tmux/state dependencies. They do not create two live Pi manager sessions, assert exclusive write ownership between old/new managers, or simulate old-manager wake after a successor has taken ownership. — `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:43-267`; `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:137-376`

#### Context exhaustion

- Child completion refreshes terminal evidence four times at 100 ms intervals so a later provider context error can outrank an older result, then emits a distinct provider-context delivery ID. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1825-1888`
- Tests cover stale-result-then-provider-context-error precedence, distinct/duplicate delivery behavior, and no graph advancement during latest-session recovery. — `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go:327-482`; `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go:247-405`
- This is reactive recovery after provider failure; it does not test proactive pre-limit rotation. — `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:58-104`

**Direct answer:** existing seams already cover duplicate deliveries, queued-wake flush, stale generations, pane adoption, failed child relaunch, and reactive context exhaustion. Missing empirical seams are duplicate rotation triggers, artifact-write/state-save split failure, manager `newSession` failure, orphan child after launch/save failure, aggregate large-batch threshold crossing, unknown-usage policy, and two-live-manager stale ownership after replacement.

## Code References

- `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:187-274` — full turn end, next-turn preparation, stop check, steering/follow-up order.
- `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent-loop.ts:506-557` — parallel batch execution and source-ordered result persistence.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:1048-1065` — post-`agent_end` retry/compaction/queue continuation.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts:3078-3119` — context usage API implementation.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/compaction/compaction.ts:147-208` — usage estimator and reserve threshold.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts:338-393` — command-only session replacement APIs.
- `pkg/agents/workflows/qrspi/definition_agentchat.go:88-101` — handoff-enabled QRSPI nodes.
- `pkg/agents/workflows/runtime/transition.go:64-83` — same-node handoff transition.
- `cmd/vamos-runtime/internal/qrspicmd/prompt.go:37-78` — child prompt and prior-result injection.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2240-2443` — current manager threshold, handoff, and manager-ready contract.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:3170-3191` — validated-result successor launch.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:4206-4232` — old child retirement after replacement save.
- `.pi/extensions/q-manager-parent.ts:26-48` — current parent wrapper usage sample and native compaction.
- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js:58-104` — current child `agent_end` completion path.

## Historical Context

- The prior auto-compaction research established child-first launch, parent usage sampling, delivery `compacting`, queued wakes, and `manager-ready`; current source retains those mechanics. — `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/research/2026-07-03_09-21-09_q-manager-auto-compaction.md`
- Prior accepted ADRs selected a parent wrapper with fresh usage, a 90% threshold, queue-before-compact ordering, and reactive child context-exhaustion recovery rather than treating overflow as completion. — `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_09-56-09_parent-pi-q-manager-wrapper.md`; `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_11-30-10_parent-usage-threshold-and-sampling.md`; `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/adrs/2026-07-03_10-55-37_child-context-exhaustion-recovery.md`
- The follow-up verification recorded that parent role/pane adoption remained brittle across compaction and new tmux panes; current delivery tests now include current-pane adoption and unavailable-pane queuing. — `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/verify.md`; `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:212-376`

## Surprises

- Pi core already has the exact low-level graceful stop point needed for a post-turn pre-request boundary (`shouldStopAfterTurn`), but coding-agent `Agent`/extension APIs do not expose it. — `/Users/swarm/dotfiles/context/pi/packages/agent/src/types.ts:204-221`; `/Users/swarm/dotfiles/context/pi/packages/agent/src/agent.ts:83-118`
- Current graph handoff semantics are generic in runtime but enabled for only two QRSPI nodes. — `pkg/agents/workflows/runtime/transition.go:64-83`; `pkg/agents/workflows/qrspi/definition_agentchat.go:88-101`
- Current manager operational handoff generation is less complete than the manager skill's own documented recovery contract. — `cmd/vamos-runtime/internal/qrspicmd/root.go:2391-2443`; `.pi/skills/q-manager/SKILL.md:187-218`
- Current active-child transfer is ordered replacement-before-retirement, but state writes have no generation/CAS check preventing an old manager process from later overwriting successor state. — `cmd/vamos-runtime/internal/qrspicmd/root.go:1438-1481`; `cmd/vamos-runtime/internal/qrspicmd/state_store.go:65-70`; `cmd/vamos-runtime/internal/qrspicmd/state_store.go:137-157`

## Open Questions

- What measured turn-delta distribution exists in real q-manager manager and child sessions by model, tool count, and tool-output size? Current state does not record it.
- Does the intended integration permit an upstream Pi change to expose `shouldStopAfterTurn`/next-turn control to coding-agent extensions, or must rotation operate only through existing command/session APIs?
- Which non-`implement`/`verify` QRSPI stages can always produce a meaningful durable checkpoint artifact before their normal primary artifact exists?
- What authority token or persisted generation should distinguish the sole active manager writer from inspect-only predecessor sessions? Current manager state has run and child generations but no manager ownership generation.
