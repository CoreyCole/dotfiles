---
date: 2026-04-25T13:28:28-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: d0dbb0f2257b6def9ab813a2834ddf53a883613a
branch: main
repository: dotfiles
stage: design
ticket: Plan Pi extensions for tool hooks and automatic AGENTS.md reads
plan_dir: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read
---

# Design: Pi extensions for tool hooks and automatic AGENTS.md reads

## Executive Summary

We will add two separate extensions to the tracked Pi config under `.pi-config/extensions/`: a declarative Claude-hooks compatibility extension and a read-focused `auto-agents` extension.
The hooks extension should be broad enough to cover the current Chestnut Flake Claude hook setup and its future siblings, not just an abstract pre/post tool demo; that means passing full structured tool arguments to hook commands so rules can inspect values like `read.input.path` and `bash.input.command` (`/Users/coreycole/cn/chestnut-flake/.claude/settings.json:42-57`, `context/pi-mono/packages/coding-agent/src/core/extensions/types.ts:804-811`).
The automatic instructions feature will not piggyback on Pi’s startup-only `ResourceLoader` context assembly; it will replace the built-in `read` tool with a delegating wrapper so every `read` call inspects ancestor `AGENTS.md` files and, when needed, invokes the original read implementation for those files too rather than emitting a separate custom output format (`context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:58-113`, `context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:14-18`).
The main design risk is balancing strict Claude-hook compatibility goals with Pi’s different extension API surface.
We mitigate that by treating Claude compatibility as an extension-owned config/runtime adapter, and by keeping auto-AGENTS behavior inside the normal read-tool implementation path while persisting dedupe/hash state in custom entries (`context/pi-mono/packages/coding-agent/src/core/session-manager.ts:91-135`, `context/pi-mono/packages/coding-agent/src/core/extensions/runner.ts:710-777`).

## Current State

Pi already exposes the essential hook primitives we need.
`AgentSession` wires pre-tool interception through `tool_call` and post-tool interception through `tool_result`, while `ExtensionRunner` handles mutation chaining and blocking semantics in extension load order (`context/pi-mono/packages/coding-agent/src/core/agent-session.ts:373-416`, `context/pi-mono/packages/coding-agent/src/core/extensions/runner.ts:710-777`).
This means the runtime can already express the core behavior of Claude Code’s pre/post tool hooks without any Pi core patch.

Pi does not currently expose a built-in declarative hooks DSL.
The local settings file only lists extension entry points, which means any Claude-Code-style configuration surface has to be implemented by an extension-owned config format and loader instead of native settings semantics (`.pi-config/agent/settings.json:12-17`).
Chestnut Flake’s Claude config already depends on hook configuration in settings, with at least `SessionStart` and `PreToolUse` wired today, so the Pi extension needs a compatibility-oriented schema rather than a toy event mapper (`/Users/coreycole/cn/chestnut-flake/.claude/settings.json:42-57`).

Pi also already has startup-time instruction loading, but it is a different mechanism than the requested behavior.
`loadProjectContextFiles()` reads at most one context file per directory, prefers `AGENTS.md` over `CLAUDE.md`, dedupes by exact path string, and assembles the result into the system prompt when the session or resources are rebuilt (`context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:58-113`, `context/pi-mono/packages/coding-agent/src/core/agent-session.ts:909-926`, `context/pi-mono/packages/coding-agent/src/core/system-prompt.ts:149-169`).
That behavior is cwd-based and startup-oriented.
It is not tied to the `read` tool.
It is not limited to `AGENTS.md`.
It does not create visible per-read history.

The built-in `read` tool is currently a normal built-in tool with no special extension seam beyond generic tool events or full replacement.
Pi’s own example shows that registering another tool named `read` fully replaces the built-in while still allowing delegation to `createReadTool(cwd)` (`context/pi-mono/packages/coding-agent/src/core/tools/read.ts:121-267`, `context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:37-94`).
That replacement seam is the cleanest way to keep the trigger strictly on `read`, inspect the incoming file path arguments on every call, and execute ordinary read behavior for both the requested file and any qualifying `AGENTS.md` files.

Pi already provides the persistence mode needed for extension state.
`appendEntry()` persists non-context custom state and is well suited for dedupe/hash tracking, while the local `review.ts` extension confirms the pattern of reconstructing durable extension state from custom entries on session start (`context/pi-mono/packages/coding-agent/src/core/session-manager.ts:91-135`, `context/pi-mono/packages/coding-agent/src/core/session-manager.ts:897-905`, `.pi-config/extensions/review.ts:42-77`, `.pi-config/extensions/review.ts:1055-1138`).

Pi does not appear to have a first-class equivalent of Claude Code’s `CLAUDE_ENV_FILE` runtime contract today.
However, the built-in bash tool already exposes the seam we need: `createBashTool()` can prepend a command prefix or apply a `spawnHook` that rewrites command/env before execution (`context/pi-mono/packages/coding-agent/src/core/tools/bash.ts:145-160`, `context/pi-mono/packages/coding-agent/src/core/tools/bash.ts:274-295`).
Pi’s own `bash-spawn-hook.ts` example shows the pattern in practice by re-registering `bash` and injecting both sourced shell setup and extra env (`context/pi-mono/packages/coding-agent/examples/extensions/bash-spawn-hook.ts:13-29`).

## Desired End State

After this work lands, the tracked Pi config should have two new extensions and one small config file family:

- `.pi-config/extensions/tool-hooks/...`
- `.pi-config/extensions/auto-agents/...`
- `.pi-config/config/tool-hooks.json` or equivalent extension-owned config file
- `.pi-config/agent/settings.json` updated to load both extensions

In the end state, the hooks extension should let the user run the same Chestnut Flake Claude hook intent from Pi in a stable config format rather than writing TypeScript for every rule.
V1 should support everything currently needed for `cn-hooks`, including Claude-compatible stdin and env affordances instead of a Pi-only payload rewrite.
Hook commands must still see top-level fields like `cwd`, `tool_name`, and `tool_input` in stdin so the existing Chestnut Flake parser keeps working, while Pi-specific extras can be added under a nested namespace.
Session-start commands must also inherit runtime env like `CLAUDE_ENV_FILE`, because the current workflow appends `direnv` exports into that file before the session proceeds.
That bridge is only complete if later bash tool executions source or otherwise apply the accumulated env file too; otherwise the `SessionStart` export command would succeed while subsequent tool runs still miss the intended direnv state.

Also in the end state, every `read` call should inspect ancestor `AGENTS.md` files starting from the target file’s directory and walking upward.
Each exact absolute `AGENTS.md` path should still be read at most once per unchanged content hash per session.
When a previously seen file changes on disk, the next qualifying `read` should re-read it.
Those auto-loads should happen by invoking the normal read tool for the `AGENTS.md` paths and composing their returned content into the same wrapped `read` result as the requested target.
The wrapped result should expose the auto-loaded paths in `details`, visibly label those paths in the wrapped read output / renderer, and include their content in-turn before the requested file’s own content blocks, so both the user and the model can see what was auto-loaded without fake extra tool rows or a custom message side channel.

## Patterns to Follow

- Use Pi’s existing pre/post tool lifecycle events instead of inventing a new interception layer in the dotfiles repo (`context/pi-mono/packages/coding-agent/src/core/agent-session.ts:373-416`, `context/pi-mono/packages/coding-agent/src/core/extensions/types.ts:804-811`, `context/pi-mono/packages/coding-agent/src/core/extensions/types.ts:974-991`).
- Follow the built-in replacement pattern when behavior must be attached specifically to `read` and not to all tool events (`context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:14-18`, `context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:37-94`).
- Persist session-scoped extension state through custom entries and reconstruct it on `session_start`, as the local review extension already does (`.pi-config/extensions/review.ts:42-77`, `.pi-config/extensions/review.ts:812-812`, `.pi-config/extensions/review.ts:1055-1138`).
- Pass complete structured hook payloads to external commands so Claude-hook-compatible scripts can inspect exact tool arguments such as `read.input.path` (`/Users/coreycole/cn/chestnut-flake/.claude/hooks/AGENTS.md:39-44`, `/Users/coreycole/cn/chestnut-flake/.claude/settings.json:42-57`).
- Match Pi’s current exact-path dedupe semantics for instruction files so the new behavior aligns with existing resource loading expectations (`context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:84-101`).

## Patterns to Avoid

- Do not wire the feature into startup-only resource loading; that would blur the requested `read`-only trigger and silently change prompt assembly semantics (`context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:58-113`, `context/pi-mono/packages/coding-agent/src/core/agent-session.ts:909-926`).
- Do not overload `tool_call` / `tool_result` for the auto-read feature if the implementation needs read-specific orchestration; the generic hooks can mutate/block but they are not the right place to execute ancestor file reads (`context/pi-mono/packages/coding-agent/src/core/extensions/runner.ts:710-777`).
- Do not store dedupe/hash tracking only in module memory; that would break across reloads or session restoration and lose the “once per session unless changed” invariant (`context/pi-mono/packages/coding-agent/src/core/session-manager.ts:897-905`).
- Do not add another duplicate owner of `answer` or `execute_command`; this repo intentionally keeps those names locally owned (`AGENTS.md`, `.pi-config/agent/settings.json:12-17`).
- Do not silently inject instruction text without a visible artifact; the request explicitly wants visible reads/history rather than hidden behavior (`thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/questions/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read.md:8-13`).

## Recommended Approach

### 1. Keep the work split into two independent extensions

The request describes two separate capabilities and they should remain separate in code and configuration.
That keeps each extension easy to load, test, and disable independently.
It also avoids coupling generic hook semantics to the read-specific instruction-loading workflow.

Recommended structure:

- `.pi-config/extensions/tool-hooks/index.ts`
- `.pi-config/extensions/tool-hooks/config.ts`
- `.pi-config/extensions/tool-hooks/matchers.ts`
- `.pi-config/extensions/tool-hooks/runner.ts`
- `.pi-config/extensions/auto-agents/index.ts`
- `.pi-config/extensions/auto-agents/state.ts`
- `.pi-config/extensions/auto-agents/paths.ts`
- `.pi-config/extensions/auto-agents/render.ts`
- `.pi-config/config/tool-hooks.json`

This keeps the source of truth in tracked config, while still fitting Pi’s standard extension discovery and settings loading flow.

### 2. Implement hook configuration as a Claude-compatible wrapper over Pi lifecycle events

The hooks extension should translate a tracked config file into Pi event handlers.
This should aim to support the Chestnut Flake Claude hook setup directly, then generalize outward.
The extension can register Pi handlers for the relevant lifecycle events and dispatch configured rules internally.

The config should be compatibility-first in v1.
It only needs to support the Claude hook behavior actually required by `cn-hooks` and the Chestnut Flake workflow, but it should fully support that required subset.
At minimum it should cover:

- `SessionStart`
- `PreToolUse`
- `PostToolUse` when `cn-hooks` needs it
- room for other Claude-style events later, without promising full parity on day one

That means the extension should accept the current Chestnut Flake Claude-style grouped config shape first, then compile it into internal rules.
It should be able to read event buckets such as `hooks.SessionStart[]` and `hooks.PreToolUse[]`, preserve nested `hooks` command arrays, and map them onto Pi lifecycle handlers instead of forcing an immediate rewrite to a flat Pi-local schema.
Session-start commands must also preserve the env/runtime affordances the existing workflow already depends on, including `CLAUDE_ENV_FILE`.

The payload contract matters as much as the matcher shape.
Every hook command should receive structured JSON on stdin with:

- top-level Claude-compatible fields such as `hook_event_name`, `cwd`, `tool_name`, and `tool_input`
- top-level tool identifiers and post-tool payload fields when a pre/post tool hook is running
- a nested `pi` object for mapped Pi event metadata and any extra session fields Pi wants to expose

The config/matcher layer alone does not prove that runtime stdin shape.
The runtime adapter has to preserve Pi’s real typed tool event input when it builds hook subprocess payloads.
Pi already exposes `ReadToolCallEvent.input: ReadToolInput` and `BashToolCallEvent.input: BashToolInput`, and those concrete input types already contain `path` and `command` respectively (`context/pi-mono/packages/coding-agent/src/core/extensions/types.ts:767-774`, `context/pi-mono/packages/coding-agent/src/core/tools/read.ts:17-23`, `context/pi-mono/packages/coding-agent/src/core/tools/bash.ts:33-36`).
So the implementation target here is explicit: preserve those fields as `tool_input.path` for `read` and `tool_input.command` for `bash`, not just some looser Pi-specific summary.

The subprocess environment matters too.
Hook commands should inherit the current process env plus Claude-compatible variables such as `CLAUDE_ENV_FILE`, so existing session-start commands like `direnv export bash >> "$CLAUDE_ENV_FILE"` keep working unchanged.
Because Pi does not already replay that file into later bash calls, the extension should also own a small runtime adapter: create a per-session env file, expose its path to hook subprocesses as `CLAUDE_ENV_FILE`, and re-register or wrap `bash` so later executions source that file before the user command runs.
Using `createBashTool(..., { spawnHook })` or an equivalent command-prefix wrapper is the intended seam here, because Pi already supports command/env rewriting at bash-execution time without a core patch (`context/pi-mono/packages/coding-agent/src/core/tools/bash.ts:145-160`, `context/pi-mono/packages/coding-agent/src/core/tools/bash.ts:274-295`, `context/pi-mono/packages/coding-agent/examples/extensions/bash-spawn-hook.ts:13-29`).

That argument visibility and env compatibility are required for the auto-agents-adjacent and Chestnut Flake use cases, because hook commands need to inspect values like `tool_input.path` and `tool_input.command` before deciding what to do.

Pre-hook behavior maps cleanly to Pi’s `tool_call` return contract.
A pre-hook script can inspect the payload and request blocking.
The adapter should accept the existing Claude-style block response `{ "decision": "block", "reason": "..." }` and normalize it internally to Pi’s blocking result.
Any Pi-specific shorthand such as `{ block: true }` should be optional sugar rather than the only supported contract.
Argument mutation should stay extension-owned and explicit.
If we support argument rewrites at all, they should come only from validated JSON stdout and only for the matched tool family, because Pi does not re-validate after `event.input` mutation (`context/pi-mono/packages/coding-agent/src/core/extensions/types.ts:804-811`).

Post-hook behavior maps to `tool_result`.
A post-hook script can observe the final tool payload and optionally return structured patches for `content`, `details`, or `isError`.
Non-tool events such as `SessionStart` should be adapter-owned mappings onto the nearest Pi lifecycle events rather than a promise of one-to-one upstream parity.

### 3. Implement automatic `AGENTS.md` loading as a `read` replacement that reuses the original read tool

The auto-agents extension should register a replacement tool named `read`.
Internally it should delegate all actual file reads to the original built-in `read` implementation.
This is the only extension seam that gives us end-to-end control over the read-triggered workflow while keeping everything on the normal read-tool path.

Flow for each `read` call:

1. Inspect the incoming read arguments and resolve the target path exactly as the built-in read tool would.
1. Walk ancestor directories from the target file’s directory upward on every read call.
1. Collect `AGENTS.md` files only.
1. For each candidate absolute path, compute current file hash.
1. Compare against session state keyed by exact absolute path.
1. For each path never seen or seen with a different hash, invoke the original read tool for that `AGENTS.md` path, capture its returned content/details, and record the path as auto-loaded.
1. Persist the updated `{ absolutePath -> hash }` map via custom entries.
1. Invoke the original read tool for the requested target path.
1. Return a single composed read result whose content starts with a short label enumerating the auto-loaded `AGENTS.md` paths, then prepends the newly auto-loaded `AGENTS.md` text blocks, and finally appends the requested file’s original content blocks, while `details` carries the same path list for the wrapped renderer.

This keeps auto-AGENTS on the same semantic rail as ordinary reads: every read, regardless of the requested file type, triggers delegated reads of relevant `AGENTS.md` files first when they are unseen or changed, and then the originally requested read proceeds normally in the same tool result.
The explicit labels and renderer surfacing matter because Pi’s current tool history only creates one visible row for the outer wrapped `read`, and the stock text-output path otherwise just concatenates text blocks (`context/pi-mono/packages/agent/src/agent-loop.ts:371-401`, `context/pi-mono/packages/coding-agent/src/core/tools/render-utils.ts:30-40`).

### 4. Persist dedupe and change detection as extension-owned session state

The extension should maintain an in-memory map for speed and restore it on `session_start` by replaying the session’s custom entries.
Each persisted state snapshot should contain only the minimum durable data needed for the invariant:

- absolute path
- content hash
- last loaded timestamp
- triggering read path

That state should be stored under a dedicated custom type such as `auto-agents-state`.
The current state in memory should be treated as authoritative during the session.
Persisted entries are the recovery log.

Hashing should use file content, not mtime.
That directly matches the stated requirement and avoids false positives from timestamp-only changes.
Exact absolute path should remain the dedupe identity even if symlinks point to the same inode, because that matches the decision already preserved in the plan AGENTS and aligns with Pi’s existing path-string dedupe style.

### 5. Keep startup context loading unchanged

This feature should not replace Pi’s existing `AGENTS.md` / `CLAUDE.md` startup loading.
The new extension behavior is additive and more specific.
Startup context still covers the session cwd and agent dir.
The new auto-agents behavior covers files the agent reads later that may live outside the original cwd ancestry or require visible per-read context surfacing.

This avoids risky core-behavior drift and preserves a clean mental model:

- startup loader = baseline context
- auto-agents extension = read-triggered incremental context

## Representative code

```ts
export default function autoAgents(pi: ExtensionAPI) {
  const originalRead = createReadTool(process.cwd());
  const state = restoreState();

  pi.registerTool({
    name: "read",
    label: "read",
    description: originalRead.description,
    parameters: originalRead.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      const targetPath = resolveReadTarget(params.path);
      const autoLoaded: Array<{ path: string; result: Awaited<ReturnType<typeof originalRead.execute>> }> = [];

      for (const file of findAncestorAgentsFiles(targetPath)) {
        const hash = sha256(readFileSync(file, "utf8"));
        if (state.get(file) !== hash) {
          const result = await originalRead.execute(toolCallId, { path: file }, signal, onUpdate);
          autoLoaded.push({ path: file, result });
          state.set(file, hash);
          pi.appendEntry("auto-agents-state", { file, hash, trigger: targetPath });
        }
      }

      const targetResult = await originalRead.execute(toolCallId, params, signal, onUpdate);
      return composeReadResult(autoLoaded, targetResult);
    },
  });
}
```

The important part is the shape, not the exact helper names.
The real implementation should centralize path resolution, hashing, renderer registration, and state restoration in separate modules.

## Decision

Go with a split-extension design: a Claude-hooks compatibility extension that exposes full structured tool arguments to hook commands, and a `read` replacement extension that triggers real delegated reads of ancestor `AGENTS.md` files before the requested file while persisting exact-path content hashes as session state.
This is the best fit because it uses stable Pi extension seams that already exist, keeps the request’s two capabilities independent, preserves current startup context loading, and keeps auto-AGENTS behavior as plain read-tool execution rather than inventing a side-channel output format.

## Resolved Decisions

- Build Claude-Code-style hooks as a Chestnut-Flake-compatible declarative layer over Pi lifecycle events, with structured stdin payloads that include full tool arguments. See [`adrs/2026-04-25_13-28-28_hook-config-surface.md`](adrs/2026-04-25_13-28-28_hook-config-surface.md).
- Implement automatic `AGENTS.md` loading as a delegating `read` replacement that executes the original read tool for qualifying ancestor `AGENTS.md` files, not as a `ResourceLoader` change or custom-message sidecar. See [`adrs/2026-04-25_13-28-28_auto-agents-read-integration.md`](adrs/2026-04-25_13-28-28_auto-agents-read-integration.md).
- Persist auto-read dedupe state as exact-absolute-path content hashes in custom session entries, with in-memory caching restored on `session_start`. See [`adrs/2026-04-25_13-28-28_auto-agents-session-state.md`](adrs/2026-04-25_13-28-28_auto-agents-session-state.md).

## Consequences and Rollout Shape

This design keeps the first implementation focused and reversible.
The hook extension can be developed and validated independently from the auto-agents extension.
The auto-agents extension can be enabled without changing Pi core behavior or upstream packages.

It also keeps future options open.
If Pi later adds first-class nested tool execution or a native hooks DSL, the local extensions can be simplified or retired.
Because this design isolates each capability behind a dedicated extension boundary, migration would be straightforward.

The main cost is that the extension has to trigger multiple delegated reads during one high-level read action because Pi does not expose a first-class nested-tool API for extensions.
That is an intentional tradeoff in favor of keeping the behavior on the normal read tool path and avoiding a custom side-channel message type.
If Pi later exposes nested tool execution, the same design intent can be upgraded to literal additional read rows without changing the user-facing semantics.

## Verification Strategy

The implementation stage should verify four layers:

1. Config parsing and matcher behavior for the hook extension.
1. Hook runtime compatibility: `SessionStart` commands receive a working `CLAUDE_ENV_FILE`, later bash executions source that file, and Claude-style block responses still map cleanly onto Pi blocking semantics.
1. Auto-agents path discovery, hash dedupe, and replay/restoration behavior.
1. Same-turn composed read visibility: unseen or changed ancestor `AGENTS.md` files are read first, their labeled content is included before the requested file’s content, and the wrapped `read` renderer visibly lists which paths were auto-loaded.

Relevant upstream references for tests and behavior checks:

- hook blocking and result mutation tests (`context/pi-mono/packages/coding-agent/test/suite/agent-session-model-extension.test.ts:96-175`)
- AGENTS discovery ordering (`context/pi-mono/packages/coding-agent/test/resource-loader.test.ts:269-287`)
- visible context ordering in the interactive UI (`context/pi-mono/packages/coding-agent/test/interactive-mode-status.test.ts:788-825`)
- read replacement example (`context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts:37-94`)
- local persistence reconstruction pattern (`.pi-config/extensions/review.ts:42-77`)
- current Chestnut Flake Claude hook config (`/Users/coreycole/cn/chestnut-flake/.claude/settings.json:42-57`)
- current Chestnut Flake Claude hook contract notes (`/Users/coreycole/cn/chestnut-flake/.claude/hooks/AGENTS.md:39-44`)

## Open Questions

- None currently.
