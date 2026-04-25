---
date: 2026-04-25T12:59:32-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 9c7f5dddde18dc68f8456b4a0b201cf41a5eb1c2
branch: main
repository: dotfiles
stage: question
ticket: "Plan Pi extensions for tool hooks and automatic AGENTS.md reads"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read"
question_doc: "thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/questions/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read.md"
prev_question_docs: []
---

# Research Questions: Pi extension hooks and automatic AGENTS.md reads

## Brainstorm Summary
- Desired outcome: add two separate Pi extensions to the personal dotfiles config — one for configurable pre/post tool hooks and one for automatic `AGENTS.md` loading tied to `read` tool usage.
- Hook functionality target: same functional goal as Claude Code hooks, but grounded in Pi's actual extension/runtime surfaces rather than copied blindly.
- Research for Pi config changes must use `context/pi-mono` as ground truth and should also load the `pi` skill.
- The automatic instructions behavior should trigger only on `read`, walk ancestor `AGENTS.md` files, emit visible reads in session history, dedupe by exact absolute path, and re-read when the file content hash changes.
- Open tension intentionally deferred to research: whether the AGENTS behavior fits best as a `tool_call`/`tool_result` extension, a built-in `read` override, or a deeper resource/session integration point.

## Context
We want to plan two Pi extensions for the dotfiles Pi config: a Claude-Code-style pre/post tool hook configuration surface and an automatic `AGENTS.md` reading feature that activates when the agent reads a file. The design must be grounded in the local `context/pi-mono` clone so later stages reflect Pi's real extension and context-loading behavior.

## Questions
1. What extension/runtime primitives already exist in Pi for tool lifecycle interception, specifically around pre-tool and post-tool execution, and how do their semantics compare to the requested Claude-Code-style hook behavior?
2. What is the current Pi mechanism for loading `AGENTS.md` and other context files into session context, and how does that behavior differ from the requested per-`read` automatic ancestor loading?
3. What implementation options exist in Pi for attaching new behavior to `read` tool usage — event handlers, built-in tool override, or other extension surfaces — and what tradeoffs do those options impose for visible tool history, argument/result mutation, and session-scoped state?
4. Where can session-scoped state be stored or coordinated in Pi extensions so the automatic `AGENTS.md` extension can dedupe by absolute path and re-read only when file content hashes change?
5. What existing code paths, event payloads, and tool result formats would a visible `AGENTS.md` auto-read implementation need to work with if it should appear in session history rather than silently mutating context?
6. What configuration shape would best match the requested “same functionality as Claude Code” hook system within Pi’s settings and extension model, and what parts of Claude Code’s hook lifecycle are directly mappable versus requiring Pi-specific adaptation?
7. What tests, examples, or nearby extension patterns in `context/pi-mono` and `.pi-config/extensions/` should guide implementation and verification for these two extensions?

## Codebase References
- `.pi-config/context/pi-mono/packages/coding-agent/docs/extensions.md` — documents `tool_call`, `tool_result`, tool overrides, and extension event semantics.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/extensions/types.ts` — defines tool lifecycle event payloads and mutability rules.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/agent-session.ts` — shows where tool lifecycle handlers are invoked in live sessions.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts` — current ground truth for `AGENTS.md` / `CLAUDE.md` context-file loading.
- `.pi-config/context/pi-mono/packages/coding-agent/docs/sdk.md` — describes ResourceLoader behavior and context file discovery semantics.
- `.pi-config/extensions/answer.ts` — local extension example that coordinates event-driven behavior with another extension.
- `.pi-config/extensions/execute-command.ts` — local extension example for session-scoped behavior and cross-extension event usage.
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/prds/2026-04-25_12-59-32_request.md` — canonical request snapshot for this planning effort.
