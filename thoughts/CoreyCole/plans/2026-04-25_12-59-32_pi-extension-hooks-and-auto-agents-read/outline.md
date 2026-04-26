---
date: 2026-04-25T14:20:30-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: d0dbb0f2257b6def9ab813a2834ddf53a883613a
branch: main
repository: dotfiles
stage: outline
ticket: Plan Pi extensions for tool hooks and automatic AGENTS.md reads
plan_dir: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read
---

# Outline: Pi extensions for tool hooks and automatic AGENTS.md reads

## Overview

Build two independent Pi extensions under `.pi-config/extensions/`: `tool-hooks` for Claude-compatible declarative hook dispatch over Pi lifecycle events, and `auto-agents` for read-triggered ancestor `AGENTS.md` loading. The implementation preserves Pi's startup context loading, keeps auto-AGENTS on the normal `read` tool path by composing newly discovered `AGENTS.md` content into the wrapped `read` result in-turn, and persists exact-absolute-path content hashes so each unchanged `AGENTS.md` is read at most once per session.

## Type Definitions

```ts
// .pi-config/extensions/tool-hooks/types.ts
export type ClaudeHookEventName =
  | "SessionStart"
  | "PreToolUse"
  | "PostToolUse";

export interface ToolHooksConfig {
  hooks: Partial<Record<ClaudeHookEventName, ClaudeHookMatcherGroup[]>>;
}

export interface ClaudeHookMatcherGroup {
  matcher: string;
  hooks: HookCommandSpec[];
}

export interface HookCommandSpec {
  type: "command";
  command: string;
  timeoutMs?: number;
}

export interface CompiledHookRule {
  event: ClaudeHookEventName;
  matcher?: HookMatcher;
  command: string;
  timeoutMs?: number;
}

export interface HookMatcher {
  tools?: string[];
  paths?: string[];
  commands?: string[];
}

export interface HookCommandPayload {
  hook_event_name: ClaudeHookEventName;
  cwd: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_call_id?: string;
  tool_response?: {
    content: unknown;
    details?: Record<string, unknown>;
    is_error?: boolean;
  };
  pi: {
    event: string;
    session: {
      branchId?: string;
      envFile: string;
      reason?: string;
    };
  };
}

export interface HookCommandResult {
  decision?: "block";
  block?: boolean;
  reason?: string;
  inputPatch?: unknown;
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}
```

```ts
// .pi-config/extensions/auto-agents/types.ts
export interface AutoAgentsStateEntry {
  path: string;
  hash: string;
  loadedAt: string;
  triggerPath: string;
}

export interface AutoAgentsStateSnapshot {
  byPath: Map<string, AutoAgentsStateEntry>;
}

export interface ResolvedReadTarget {
  requestedPath: string;
  absolutePath: string;
  isDirectoryLike: boolean;
}

export interface AgentsCandidate {
  path: string;
  hash: string;
}

export interface AutoLoadedAgentsRead {
  path: string;
  result: {
    content: unknown[];
    details?: unknown;
  };
}

export interface AutoAgentsReadDetails {
  autoLoadedAgents: string[];
  targetPath: string;
}
```

## Package / File Structure

- `.pi-config/extensions/tool-hooks/index.ts`
- `.pi-config/extensions/tool-hooks/types.ts`
- `.pi-config/extensions/tool-hooks/config.ts`
- `.pi-config/extensions/tool-hooks/matchers.ts`
- `.pi-config/extensions/tool-hooks/payload.ts`
- `.pi-config/extensions/tool-hooks/env.ts`
- `.pi-config/extensions/tool-hooks/runner.ts`
- `.pi-config/extensions/tool-hooks/process.ts`
- `.pi-config/extensions/auto-agents/index.ts`
- `.pi-config/extensions/auto-agents/types.ts`
- `.pi-config/extensions/auto-agents/state.ts`
- `.pi-config/extensions/auto-agents/paths.ts`
- `.pi-config/extensions/auto-agents/hash.ts`
- `.pi-config/extensions/auto-agents/render.ts` or inline renderer passthrough in `index.ts`
- `.pi-config/config/tool-hooks.json`
- `.pi-config/agent/settings.json`

## API Surface

```ts
export function loadToolHooksConfig(configPath: string): ToolHooksConfig;
export function validateToolHooksConfig(input: unknown): ToolHooksConfig;
export function compileHookRules(config: ToolHooksConfig): CompiledHookRule[];
export function matchesHookRule(rule: CompiledHookRule, ctx: HookCommandPayload): boolean;
export function ensureHookEnvFile(): Promise<string>;
export function buildHookPayload(args: {
  event: ClaudeHookEventName;
  piEvent: string;
  cwd: string;
  envFile: string;
  reason?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
}): HookCommandPayload;
export async function runHookRule(
  rule: CompiledHookRule,
  payload: HookCommandPayload,
): Promise<HookCommandResult>;
```

```ts
export function restoreAutoAgentsState(session: AgentSessionLike): AutoAgentsStateSnapshot;
export function resolveReadTarget(cwd: string, inputPath: string): ResolvedReadTarget;
export function findAncestorAgentsFiles(targetPath: string): string[];
export function hashAgentsFile(path: string): string;
export function shouldReadAgentsFile(
  state: AutoAgentsStateSnapshot,
  candidate: AgentsCandidate,
): boolean;
export function composeReadResult(args: {
  autoLoaded: AutoLoadedAgentsRead[];
  targetResult: ToolResult;
  targetPath: string;
}): ToolResult;
export async function persistAutoAgentsState(
  appendEntry: AppendEntryFn,
  entry: AutoAgentsStateEntry,
): Promise<void>;
```

Clarification: Slice 1 locks the config + matcher vocabulary only. The actual hook subprocess API surface is established in Slice 2, where Pi `tool_call` / `tool_result` events are mapped into `HookCommandPayload`, preserving runtime fields like `tool_input.path` for `read` and `tool_input.command` for `bash`.

## Slices

### Slice 1: Tool-hooks config surface and matcher compilation from Claude-style grouped config

**Files:**

- `.pi-config/extensions/tool-hooks/types.ts` (new)
- `.pi-config/extensions/tool-hooks/config.ts` (new)
- `.pi-config/extensions/tool-hooks/matchers.ts` (new)
- `.pi-config/config/tool-hooks.json` (new)

```ts
export function loadToolHooksConfig(configPath: string): ToolHooksConfig;
export function validateToolHooksConfig(input: unknown): ToolHooksConfig;
export function compileHookRules(config: ToolHooksConfig): CompiledHookRule[];
export function matchesHookRule(rule: CompiledHookRule, ctx: HookCommandPayload): boolean;
```

**Test checkpoint:** The current Chestnut Flake Claude hook fixture loads successfully, `SessionStart` / `PreToolUse` groups compile into internal rules, and matcher tests prove compiled `PreToolUse` rules can target `read` and `bash` by tool name plus path/command patterns. This slice does not by itself guarantee the hook subprocess stdin contract; Slice 2 does.

### Slice 2: Tool-hooks runtime dispatch on Pi lifecycle events

**Files:**

- `.pi-config/extensions/tool-hooks/index.ts` (new)
- `.pi-config/extensions/tool-hooks/payload.ts` (new)
- `.pi-config/extensions/tool-hooks/env.ts` (new)
- `.pi-config/extensions/tool-hooks/process.ts` (new)
- `.pi-config/extensions/tool-hooks/runner.ts` (new)

```ts
export default function toolHooks(pi: ExtensionAPI): void;
export function buildHookPayload(...): HookCommandPayload;
export async function runHookRule(...): Promise<HookCommandResult>;
```

Runtime contract: hook subprocess stdin preserves Claude-compatible top-level fields such as `hook_event_name`, `cwd`, `tool_name`, and `tool_input`, while Pi-only metadata lives under `pi`. For built-in Pi tools, this mapping must preserve the underlying typed event input shape, so hooks can rely on `tool_input.path` for `read` and `tool_input.command` for `bash`.
Runtime adapter: this slice also owns the per-session `CLAUDE_ENV_FILE` bridge for later bash tool executions, ideally by re-registering or wrapping `bash` through Pi’s existing spawn-hook seam so SessionStart exports affect subsequent bash calls.

**Test checkpoint:** A session-start hook runs the existing `direnv export bash >> "$CLAUDE_ENV_FILE"` command with a concrete `CLAUDE_ENV_FILE`, later bash executions source the accumulated env file before running the user command, and a `tool_call` hook receives Claude-compatible top-level input where `tool_input.path` and `tool_input.command` still expose the values existing scripts need, with Claude-style block output mapped to Pi `tool_call` blocking behavior.

### Slice 3: Post-tool hook result patching and safety boundaries

**Files:**

- `.pi-config/extensions/tool-hooks/runner.ts` (modify)
- `.pi-config/extensions/tool-hooks/process.ts` (modify)
- `.pi-config/extensions/tool-hooks/types.ts` (modify if needed)

```ts
export interface HookCommandResult {
  decision?: "block";
  block?: boolean;
  reason?: string;
  inputPatch?: unknown;
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}
```

**Test checkpoint:** A hook returning `{ "decision": "block" }` is accepted for pre-tool blocking, any `inputPatch` is schema-validated before mutating `event.input` or rejected deterministically, and a `PostToolUse` hook can annotate or patch result content/details while invalid or unsafe patch output is rejected or ignored consistently.

### Slice 4: Auto-agents path discovery and exact-path hash state

**Files:**

- `.pi-config/extensions/auto-agents/types.ts` (new)
- `.pi-config/extensions/auto-agents/paths.ts` (new)
- `.pi-config/extensions/auto-agents/hash.ts` (new)
- `.pi-config/extensions/auto-agents/state.ts` (new)

```ts
export function findAncestorAgentsFiles(targetPath: string): string[];
export function hashAgentsFile(path: string): string;
export function restoreAutoAgentsState(...): AutoAgentsStateSnapshot;
export function shouldReadAgentsFile(...): boolean;
export async function persistAutoAgentsState(...): Promise<void>;
```

**Test checkpoint:** A target file resolves to the expected ancestor `AGENTS.md` list, unchanged files are skipped, changed hashes force re-read, and restored session state survives reload.

### Slice 5: Replace `read` with delegating auto-agents wrapper

**Files:**

- `.pi-config/extensions/auto-agents/index.ts` (new)
- `.pi-config/extensions/auto-agents/render.ts` or inline renderer passthrough (new)
- `.pi-config/agent/settings.json` (modify)

```ts
export default function autoAgents(pi: ExtensionAPI): void;
async execute(toolCallId, params, signal, onUpdate): Promise<ToolResult>;
```

Execution shape:

1. Resolve the requested target path.
1. Find ancestor `AGENTS.md` files.
1. Hash and compare against restored in-session state.
1. Delegate unseen or changed `AGENTS.md` files to the original `read` tool and collect their returned content/details.
1. Persist new hash entries.
1. Delegate the requested read to the original `read` tool.
1. Return a single composed read result that prepends clearly labeled newly auto-loaded `AGENTS.md` sections, appends the requested file’s original content blocks, records the auto-loaded paths in `details.autoLoadedAgents`, and renders those paths explicitly in the wrapped `read` row.

**Test checkpoint:** Reading a normal file returns one wrapped `read` result that visibly lists newly auto-loaded ancestor `AGENTS.md` paths in the wrapped result/renderer, includes their labeled content in-turn before the requested file content, and a repeated read skips unchanged AGENTS files.

### Slice 6: Config wiring and end-to-end verification in tracked Pi config

**Files:**

- `.pi-config/agent/settings.json` (modify)
- optional `.pi-config/README.md` or `.pi-config/AGENTS.md` pointer update if needed

```json
{
  "extensions": [
    "+extensions/answer.ts",
    "+extensions/execute-command.ts",
    "+extensions/tool-hooks/index.ts",
    "+extensions/auto-agents/index.ts"
  ]
}
```

**Test checkpoint:** `/reload` succeeds, both extensions register cleanly, hook config is active, the Chestnut Flake `CLAUDE_ENV_FILE` flow works end-to-end for hook commands plus bash execution, and a manual `read` in a nested directory returns the composed auto-AGENTS + target result with visible auto-loaded path labels while skipping unchanged AGENTS files on repeat reads.

## Out of Scope

- Pi core patches for a native hooks DSL
- changing `ResourceLoader` startup context behavior
- broad Claude event parity beyond the Chestnut-Flake-needed subset
- dedupe by inode or realpath instead of exact absolute path
- hidden side-channel context injection for auto-agents
