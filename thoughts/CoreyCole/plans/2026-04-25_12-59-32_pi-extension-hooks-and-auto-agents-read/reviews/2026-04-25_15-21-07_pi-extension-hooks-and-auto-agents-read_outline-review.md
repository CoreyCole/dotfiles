---
date: 2026-04-25T15:21:07-07:00
reviewer: OpenAI Codex
git_commit: d0dbb0f2257b6def9ab813a2834ddf53a883613a
branch: main
repository: dotfiles
plan_dir: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read
review_mode: outline
reviewed_artifact: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md
design_reviewed: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md
status: complete
type: outline_review
verdict: needs_attention
---

# Outline Review: pi-extension-hooks-and-auto-agents-read

### Summary
The outline is directionally aligned with the design, but two acceptance-critical details are still underspecified: how the wrapped `read` tool will visibly surface auto-loaded `AGENTS.md` files, and how the hook layer will preserve the current Chestnut Flake Claude hook contract instead of introducing a Pi-only schema that existing hooks cannot consume.

### Findings Summary
- [P1] Slice 5 does not define a visible surfacing path for auto-loaded `AGENTS.md` reads, even though Pi will not create separate tool-history rows for delegated `originalRead.execute()` calls inside the wrapper.
- [P1] The hook outline drifts from the approved Chestnut-Flake-compatible contract by defining new config/result shapes without an explicit adapter for the existing Claude-style hook config, block response, and env/runtime affordances.

### Findings
1. **[P1] Auto-agents visibility is not actually planned yet.** The design requires the `read`-triggered loads to stay visible and explicitly rejects silent instruction injection (`thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md:56-60`, `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md:166-175`), but Slice 5 only says to call `originalRead.execute()` for ancestor `AGENTS.md` files and then return the requested file’s normal result (`thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md:229-250`). Under Pi’s current execution flow, tool-history rows are emitted only for the outer tool call that runs through the agent loop (`context/pi-mono/packages/agent/src/agent-loop.ts:371-401`), and the built-in read renderer only displays file content plus truncation metadata (`context/pi-mono/packages/coding-agent/src/core/tools/read.ts:88-118`). Without an explicit result/details or renderer contract for listing the auto-loaded `AGENTS.md` paths, an implementation can satisfy this slice while still hiding those reads from the user.
2. **[P1] The hook plan no longer guarantees compatibility with the existing Chestnut Flake workflow it is supposed to support.** The design says V1 should cover the current `cn-hooks` setup and be compatibility-first for the Chestnut Flake Claude hook model (`thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md:53-55`, `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md:95-124`), but the outline switches to a flat `ToolHooksConfig { hooks: HookRule[] }` plus `HookCommandResult { block?: ... }` contract (`thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md:26-75`). The live Chestnut Flake config instead uses Claude-style event buckets with nested `hooks` arrays and a `SessionStart` command that depends on `CLAUDE_ENV_FILE` (`/Users/coreycole/cn/chestnut-flake/.claude/settings.json:47-69`), and the current hook scripts return `{ "decision": "block" }`, not `{ block: true }` (`/Users/coreycole/cn/chestnut-flake/.claude/hooks/AGENTS.md:52-56`). Unless the outline explicitly adds a compatibility adapter for those existing inputs/outputs, V1 can pass the listed checkpoints while still requiring the current hook workflow to be rewritten first.

### Questions / Decisions Needed
None.

### What's Good
- The two-extension split is still the right boundary and keeps hook dispatch separate from read-specific orchestration.
- The exact-path hash dedupe decision is well supported by both the research and the existing Pi session-state APIs.
- Load order in `.pi-config/agent/settings.json` is correctly preserved so `tool-hooks` lands before the `read` override.

### Verification
- Ran `~/dotfiles/spec_metadata.sh` — captured timestamp, commit, branch, and repository metadata for the review artifact.
- Read `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md` — verified preserved decisions and updated it with durable review learnings.
- Read `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md` and `outline.md` — compared the outline against the approved design.
- Read `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/questions/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read.md` and `research/2026-04-25_13-21-46_pi-extension-hooks-and-auto-agents-read.md` — checked the original request constraints and codebase findings.
- Read `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/adrs/2026-04-25_13-28-28_auto-agents-read-integration.md`, `adrs/2026-04-25_13-28-28_auto-agents-session-state.md`, and `adrs/2026-04-25_13-28-28_hook-config-surface.md` — verified the decision trail around hook compatibility and auto-agents behavior.
- Read `context/pi-mono/packages/coding-agent/src/core/tools/read.ts`, `context/pi-mono/packages/agent/src/agent-loop.ts`, and `context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts` — verified read-tool replacement behavior and why delegated inner reads do not create separate visible tool rows.
- Read `/Users/coreycole/cn/chestnut-flake/.claude/settings.json` and `/Users/coreycole/cn/chestnut-flake/.claude/hooks/AGENTS.md` — verified the currently deployed Claude hook config and stdout contract that the outline says V1 should support.

### Recommended Next Steps
- Revise Slice 5 so the wrapper has an explicit user-visible contract for which `AGENTS.md` files were auto-loaded on a given read, and add a checkpoint that proves this visibility in the wrapped read result/UI.
- Revise the hook slices so they explicitly preserve or adapt the current Chestnut Flake config/output/env contract instead of only defining a new Pi-local schema.
- Rerun `/q-review` once the updated design/outline pair makes those two behaviors testable.
