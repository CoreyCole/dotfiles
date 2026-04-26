---
date: 2026-04-25T14:27:45-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: d0dbb0f2257b6def9ab813a2834ddf53a883613a
branch: main
repository: dotfiles
stage: plan
ticket: "Plan Pi extensions for tool hooks and automatic AGENTS.md reads"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read"
---

# Implementation Plan: Pi extensions for tool hooks and automatic AGENTS.md reads

## Status
- [x] Slice 1: Normalize Claude-style hook config and matcher evaluation
- [ ] Slice 2: Wire hook runtime dispatch across Pi lifecycle events
- [ ] Slice 3: Add safe pre/post hook mutation behavior and Claude-compatible env support
- [ ] Slice 4: Build auto-agents path discovery, hashing, and persisted session state
- [ ] Slice 5: Replace `read` with the delegating auto-agents wrapper
- [ ] Slice 6: Wire tracked config, reload Pi, and run end-to-end smoke verification

## Slice 1: Normalize Claude-style hook config and matcher evaluation

### Files
- `.pi-config/extensions/tool-hooks/types.ts` (new)
- `.pi-config/extensions/tool-hooks/config.ts` (new)
- `.pi-config/extensions/tool-hooks/matchers.ts` (new)
- `.pi-config/config/tool-hooks.json` (new)

### Changes

**`.pi-config/extensions/tool-hooks/types.ts`** (new):
```ts
export type ClaudeHookEventName = "SessionStart" | "PreToolUse" | "PostToolUse";

export type ClaudeToolName = "Bash" | "Read" | "Write" | "Edit" | "Grep" | "Find" | "Ls";

export interface ClaudeHooksConfigFile {
  hooks: Partial<Record<ClaudeHookEventName, ClaudeHookMatcherGroup[]>>;
}

export interface ClaudeHookMatcherGroup {
  matcher?: string;
  hooks: ClaudeHookCommand[];
}

export interface ClaudeHookCommand {
  type: "command";
  command: string;
  async?: boolean;
  timeout?: number;
}

export interface NormalizedHookRule {
  id: string;
  event: ClaudeHookEventName;
  matcher?: string;
  command: string;
  async: boolean;
  timeoutMs: number;
}

export interface HookCommandPayload {
  session_id: string;
  transcript_path: string | null;
  cwd: string;
  hook_event_name: ClaudeHookEventName;
  tool_name?: ClaudeToolName;
  tool_input?: Record<string, unknown>;
  tool_response?: {
    content: unknown;
    details?: unknown;
    isError?: boolean;
  };
  tool_use_id?: string;
  duration_ms?: number;
  source?: "startup" | "resume" | "clear" | "compact";
  model?: string;
  pi_event: string;
}

export interface HookCommandJsonResult {
  decision?: "block";
  reason?: string;
  inputPatch?: Record<string, unknown>;
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
  hookSpecificOutput?: {
    hookEventName?: ClaudeHookEventName;
    additionalContext?: string;
  };
}

export interface HookExecutionResult {
  block?: boolean;
  reason?: string;
  additionalContext?: string;
  inputPatch?: Record<string, unknown>;
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}
```

Implementation notes:
- Keep the config file Claude-shaped and normalize into `NormalizedHookRule[]` at load time.
- Use Claude-style names (`Bash`, `Read`) in matcher/payload space and Pi names (`bash`, `read`) only inside runtime adapters.
- Treat `timeout` in the config as seconds and normalize to `timeoutMs`.

**`.pi-config/extensions/tool-hooks/config.ts`** (new):
```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ClaudeHookCommand,
  ClaudeHookEventName,
  ClaudeHooksConfigFile,
  ClaudeHookMatcherGroup,
  NormalizedHookRule,
} from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const SUPPORTED_EVENTS: ClaudeHookEventName[] = ["SessionStart", "PreToolUse", "PostToolUse"];

function assertCommand(hook: ClaudeHookCommand, event: ClaudeHookEventName, groupIndex: number, hookIndex: number) {
  if (hook.type !== "command") {
    throw new Error(`tool-hooks: ${event}[${groupIndex}].hooks[${hookIndex}] only supports type=command in v1`);
  }
  if (!hook.command?.trim()) {
    throw new Error(`tool-hooks: ${event}[${groupIndex}].hooks[${hookIndex}] requires a non-empty command`);
  }
}

function assertGroup(group: ClaudeHookMatcherGroup, event: ClaudeHookEventName, groupIndex: number) {
  if (!Array.isArray(group.hooks) || group.hooks.length === 0) {
    throw new Error(`tool-hooks: ${event}[${groupIndex}] must contain at least one hook`);
  }
}

export function validateToolHooksConfig(input: unknown): ClaudeHooksConfigFile {
  if (!input || typeof input !== "object" || !("hooks" in input)) {
    throw new Error("tool-hooks: expected { hooks: { ... } }");
  }

  const file = input as ClaudeHooksConfigFile;
  const hooks = file.hooks ?? {};

  for (const event of Object.keys(hooks)) {
    if (!SUPPORTED_EVENTS.includes(event as ClaudeHookEventName)) {
      throw new Error(`tool-hooks: unsupported event ${event}`);
    }
  }

  for (const event of SUPPORTED_EVENTS) {
    const groups = hooks[event] ?? [];
    groups.forEach((group, groupIndex) => {
      assertGroup(group, event, groupIndex);
      group.hooks.forEach((hook, hookIndex) => assertCommand(hook, event, groupIndex, hookIndex));
    });
  }

  return { hooks };
}

export function loadToolHooksConfig(configPath: string): NormalizedHookRule[] {
  const absolutePath = resolve(configPath);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  const file = validateToolHooksConfig(parsed);
  const normalized: NormalizedHookRule[] = [];

  for (const event of SUPPORTED_EVENTS) {
    const groups = file.hooks[event] ?? [];
    groups.forEach((group, groupIndex) => {
      group.hooks.forEach((hook, hookIndex) => {
        normalized.push({
          id: `${event}:${groupIndex}:${hookIndex}`,
          event,
          matcher: group.matcher?.trim() || undefined,
          command: hook.command,
          async: Boolean(hook.async),
          timeoutMs: Math.max(1, hook.timeout ?? 30) * 1000,
        });
      });
    });
  }

  return normalized;
}
```

**`.pi-config/extensions/tool-hooks/matchers.ts`** (new):
```ts
import type { ClaudeToolName, HookCommandPayload, NormalizedHookRule } from "./types";

const TOOL_NAME_MAP: Record<string, ClaudeToolName> = {
  bash: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  grep: "Grep",
  find: "Find",
  ls: "Ls",
};

export function toClaudeToolName(piToolName: string): ClaudeToolName | undefined {
  return TOOL_NAME_MAP[piToolName];
}

function matcherParts(matcher?: string): string[] {
  return matcher
    ?.split("|")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];
}

function matchesToolName(matcher: string, payload: HookCommandPayload): boolean {
  if (!payload.tool_name) return false;
  return matcher === payload.tool_name;
}

function matchesPath(matcher: string, payload: HookCommandPayload): boolean {
  const pathValue = payload.tool_input?.path ?? payload.tool_input?.file_path;
  return typeof pathValue === "string" && new RegExp(matcher).test(pathValue);
}

function matchesCommand(matcher: string, payload: HookCommandPayload): boolean {
  const command = payload.tool_input?.command;
  return typeof command === "string" && new RegExp(matcher).test(command);
}

export function matchesHookRule(rule: NormalizedHookRule, payload: HookCommandPayload): boolean {
  const parts = matcherParts(rule.matcher);
  if (parts.length === 0) return true;

  return parts.some((matcher) => {
    if (matchesToolName(matcher, payload)) return true;
    if (matchesPath(matcher, payload)) return true;
    if (matchesCommand(matcher, payload)) return true;
    return false;
  });
}
```

Implementation notes:
- Use literal matcher equality for tool names and regex matching for path/command payload fields.
- Do not try to replicate all Claude matcher semantics in v1; only implement what current `cn-hooks` usage needs plus the `Edit|Write` / `Read` / path/command patterns from the outline.
- Fail fast on invalid JSON or unsupported hook types.

**`.pi-config/config/tool-hooks.json`** (new):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "direnv export bash >> \"$CLAUDE_ENV_FILE\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".agents/hooks/cn-hooks.sh graphite"
          }
        ]
      }
    ]
  }
}
```

### Tests
Use temporary inline smoke checks while implementing this slice:

```bash
python - <<'PY'
import json, pathlib
p = pathlib.Path('.pi-config/config/tool-hooks.json')
data = json.loads(p.read_text())
assert 'hooks' in data
assert 'SessionStart' in data['hooks']
assert data['hooks']['PreToolUse'][0]['matcher'] == 'Bash'
print('tool-hooks config fixture looks valid')
PY
```

Manual matcher cases to verify once the module exists:
- `PreToolUse` + `tool_name=Bash` matches `matcher: "Bash"`
- `PreToolUse` + `tool_input.command="git status"` matches a command regex rule
- `PreToolUse` + `tool_input.path="/tmp/foo.ts"` matches a path regex rule
- `SessionStart` with empty matcher always matches

### Verify
```bash
python -m json.tool .pi-config/config/tool-hooks.json >/dev/null && echo 'tool-hooks.json ok'
```

---

## Slice 2: Wire hook runtime dispatch across Pi lifecycle events

### Files
- `.pi-config/extensions/tool-hooks/index.ts` (new)
- `.pi-config/extensions/tool-hooks/payload.ts` (new)
- `.pi-config/extensions/tool-hooks/process.ts` (new)
- `.pi-config/extensions/tool-hooks/runner.ts` (new)

### Changes

**`.pi-config/extensions/tool-hooks/payload.ts`** (new):
```ts
import type { ExtensionContext, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import type { ClaudeHookEventName, HookCommandPayload } from "./types";
import { toClaudeToolName } from "./matchers";

function getSessionId(ctx: ExtensionContext): string {
  return ctx.sessionManager.getLeafId() ?? "unknown-session";
}

function getTranscriptPath(ctx: ExtensionContext): string | null {
  const anyManager = ctx.sessionManager as { getSessionPath?: () => string | undefined };
  return anyManager.getSessionPath?.() ?? null;
}

export function buildHookPayload(args: {
  event: ClaudeHookEventName;
  piEvent: string;
  ctx: ExtensionContext;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: Pick<ToolResultEvent, "content" | "details" | "isError">;
  durationMs?: number;
  source?: "startup" | "resume" | "clear" | "compact";
}): HookCommandPayload {
  return {
    session_id: getSessionId(args.ctx),
    transcript_path: getTranscriptPath(args.ctx),
    cwd: process.cwd(),
    hook_event_name: args.event,
    tool_name: args.toolName ? toClaudeToolName(args.toolName) : undefined,
    tool_input: args.toolInput,
    tool_response: args.toolResult
      ? {
          content: args.toolResult.content,
          details: args.toolResult.details,
          isError: args.toolResult.isError,
        }
      : undefined,
    tool_use_id: args.toolCallId,
    duration_ms: args.durationMs,
    source: args.source,
    model: args.ctx.getModel()?.id,
    pi_event: args.piEvent,
  };
}
```

**`.pi-config/extensions/tool-hooks/process.ts`** (new):
```ts
import { spawn } from "node:child_process";
import type { HookCommandPayload, HookExecutionResult, NormalizedHookRule } from "./types";

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(rule: NormalizedHookRule, payload: HookCommandPayload, env: NodeJS.ProcessEnv): Promise<CommandRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(rule.command, {
      cwd: process.cwd(),
      env,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`tool-hooks: ${rule.id} timed out after ${rule.timeoutMs}ms`));
    }, rule.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export function parseHookOutput(result: CommandRunResult): HookExecutionResult {
  if (result.exitCode === 2) {
    return { block: true, reason: result.stderr || "blocked by hook" };
  }

  if (result.exitCode !== 0) {
    return {};
  }

  if (!result.stdout) return {};

  const parsed = JSON.parse(result.stdout) as {
    decision?: "block";
    reason?: string;
    inputPatch?: Record<string, unknown>;
    resultPatch?: { content?: unknown; details?: Record<string, unknown>; isError?: boolean };
    hookSpecificOutput?: { additionalContext?: string };
  };

  return {
    block: parsed.decision === "block",
    reason: parsed.reason,
    inputPatch: parsed.inputPatch,
    resultPatch: parsed.resultPatch,
    additionalContext: parsed.hookSpecificOutput?.additionalContext,
  };
}
```

**`.pi-config/extensions/tool-hooks/runner.ts`** (new):
```ts
import type { ExtensionContext, ToolResultEventResult } from "@mariozechner/pi-coding-agent";
import type { ClaudeHookEventName, HookCommandPayload, NormalizedHookRule } from "./types";
import { matchesHookRule } from "./matchers";
import { parseHookOutput, runCommand } from "./process";

function buildHookEnv(payload: HookCommandPayload, claudeEnvFile: string | undefined): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLAUDE_HOOK_EVENT_NAME: payload.hook_event_name,
    CLAUDE_PROJECT_DIR: payload.cwd,
    CLAUDE_SESSION_ID: payload.session_id,
    CLAUDE_TOOL_NAME: payload.tool_name,
    CLAUDE_TOOL_USE_ID: payload.tool_use_id,
    CLAUDE_ENV_FILE: claudeEnvFile,
  };
}

export async function runHookRules(args: {
  rules: NormalizedHookRule[];
  event: ClaudeHookEventName;
  payload: HookCommandPayload;
  ctx: ExtensionContext;
  claudeEnvFile?: string;
}): Promise<{
  block?: boolean;
  reason?: string;
  inputPatch?: Record<string, unknown>;
  resultPatch?: ToolResultEventResult;
  additionalContext: string[];
}> {
  const matching = args.rules.filter((rule) => rule.event === args.event && matchesHookRule(rule, args.payload));
  const additionalContext: string[] = [];
  let inputPatch: Record<string, unknown> | undefined;
  let resultPatch: ToolResultEventResult | undefined;

  for (const rule of matching) {
    const outcome = parseHookOutput(await runCommand(rule, args.payload, buildHookEnv(args.payload, args.claudeEnvFile)));

    if (outcome.additionalContext) additionalContext.push(outcome.additionalContext);
    if (outcome.inputPatch) inputPatch = { ...(inputPatch ?? {}), ...outcome.inputPatch };
    if (outcome.resultPatch) resultPatch = { ...(resultPatch ?? {}), ...outcome.resultPatch };
    if (outcome.block) return { block: true, reason: outcome.reason, inputPatch, resultPatch, additionalContext };
  }

  return { inputPatch, resultPatch, additionalContext };
}
```

**`.pi-config/extensions/tool-hooks/index.ts`** (new):
```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadToolHooksConfig } from "./config";
import { buildHookPayload } from "./payload";
import { runHookRules } from "./runner";

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(EXTENSION_DIR, "../../config/tool-hooks.json");

export default function toolHooks(pi: ExtensionAPI) {
  const rules = loadToolHooksConfig(CONFIG_PATH);
  let claudeEnvFile: string | undefined;

  pi.on("session_start", async (event, ctx) => {
    const payload = buildHookPayload({
      event: "SessionStart",
      piEvent: "session_start",
      ctx,
      source: event.source === "resume" ? "resume" : "startup",
    });

    const result = await runHookRules({ rules, event: "SessionStart", payload, ctx, claudeEnvFile });
    if (result.additionalContext.length > 0) {
      return {
        message: {
          customType: "tool-hooks-session-start",
          display: true,
          content: result.additionalContext.join("\n\n"),
          details: { lines: result.additionalContext.length },
        },
      };
    }
    return undefined;
  });

  pi.on("tool_call", async (event, ctx) => {
    const payload = buildHookPayload({
      event: "PreToolUse",
      piEvent: "tool_call",
      ctx,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      toolInput: event.input,
    });

    const result = await runHookRules({ rules, event: "PreToolUse", payload, ctx, claudeEnvFile });
    if (result.inputPatch) Object.assign(event.input, result.inputPatch);
    if (result.block) return { block: true, reason: result.reason ?? "Blocked by hook" };
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    const payload = buildHookPayload({
      event: "PostToolUse",
      piEvent: "tool_result",
      ctx,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      toolInput: event.input,
      toolResult: event,
    });

    const result = await runHookRules({ rules, event: "PostToolUse", payload, ctx, claudeEnvFile });
    return result.resultPatch;
  });
}
```

Implementation notes:
- Keep config loading at extension startup; if config changes, `/reload` will pick it up.
- Use a single runner for SessionStart / PreToolUse / PostToolUse so command execution, JSON parsing, and env mapping live in one place.
- Return a visible `before_agent_start`/`session_start` message only for SessionStart additional context; do not spam the transcript for ordinary pre/post tool hooks.

### Tests
Session-start and tool-call smoke test steps after the files exist:

```text
1. Add a temporary PreToolUse hook for Bash that prints stdin to /tmp/pi-hook.json and exits 0.
2. Run /reload.
3. Trigger a bash tool call from Pi.
4. Confirm /tmp/pi-hook.json contains hook_event_name=PreToolUse, tool_name=Bash, and tool_input.command.
```

```text
1. Replace the temporary hook with one that exits 2 and writes "blocked by test" to stderr.
2. Trigger a bash tool call.
3. Confirm the tool call is blocked and the error reason surfaces back to the model.
```

### Verify
```bash
rg -n '"hooks"|"PreToolUse"|"SessionStart"' .pi-config/config/tool-hooks.json
```

---

## Slice 3: Add safe pre/post hook mutation behavior and Claude-compatible env support

### Files
- `.pi-config/extensions/tool-hooks/index.ts` (modify)
- `.pi-config/extensions/tool-hooks/process.ts` (modify)
- `.pi-config/extensions/tool-hooks/runner.ts` (modify)
- `.pi-config/extensions/tool-hooks/types.ts` (modify)

### Changes

**`.pi-config/extensions/tool-hooks/types.ts`** (modify):
Add explicit guardrail comments and narrow patch shapes:
```ts
export interface HookExecutionResult {
  block?: boolean;
  reason?: string;
  additionalContext?: string;
  inputPatch?: Record<string, unknown>;
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}
```

**`.pi-config/extensions/tool-hooks/process.ts`** (modify):
Harden output parsing so malformed JSON does not crash the extension or silently mutate tool behavior.
```ts
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseHookOutput(result: CommandRunResult): HookExecutionResult {
  if (result.exitCode === 2) {
    return { block: true, reason: result.stderr || "blocked by hook" };
  }
  if (result.exitCode !== 0 || !result.stdout) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return {};
  }

  if (!isPlainObject(parsed)) return {};

  const inputPatch = isPlainObject(parsed.inputPatch) ? parsed.inputPatch : undefined;
  const resultPatch = isPlainObject(parsed.resultPatch) ? parsed.resultPatch : undefined;
  const hookSpecificOutput = isPlainObject(parsed.hookSpecificOutput) ? parsed.hookSpecificOutput : undefined;

  return {
    block: parsed.decision === "block",
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    inputPatch,
    resultPatch: resultPatch as HookExecutionResult["resultPatch"],
    additionalContext:
      typeof hookSpecificOutput?.additionalContext === "string"
        ? hookSpecificOutput.additionalContext
        : undefined,
  };
}
```

**`.pi-config/extensions/tool-hooks/runner.ts`** (modify):
Add env-file lifecycle plus patch filtering.
```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function createClaudeEnvFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pi-tool-hooks-"));
  const file = path.join(dir, "session.env");
  writeFileSync(file, "", "utf8");
  return file;
}

function filterInputPatch(inputPatch: Record<string, unknown> | undefined, originalInput: Record<string, unknown>) {
  if (!inputPatch) return undefined;
  return Object.fromEntries(
    Object.entries(inputPatch).filter(([key, value]) => key in originalInput && value !== undefined),
  );
}

function filterResultPatch(resultPatch: HookExecutionResult["resultPatch"]): ToolResultEventResult | undefined {
  if (!resultPatch) return undefined;
  const next: ToolResultEventResult = {};
  if (Array.isArray(resultPatch.content)) next.content = resultPatch.content as ToolResultEventResult["content"];
  if (resultPatch.details && typeof resultPatch.details === "object") next.details = resultPatch.details;
  if (typeof resultPatch.isError === "boolean") next.isError = resultPatch.isError;
  return Object.keys(next).length > 0 ? next : undefined;
}
```

Then apply those filters inside `runHookRules()` before returning patches.

**`.pi-config/extensions/tool-hooks/index.ts`** (modify):
Create one env file per session and surface SessionStart additional context without custom protocol drift.
```ts
import { createClaudeEnvFile } from "./runner";

pi.on("session_start", async (event, ctx) => {
  claudeEnvFile = createClaudeEnvFile();
  // existing payload + runHookRules call
});

pi.registerMessageRenderer("tool-hooks-session-start", (message, _options, theme) => {
  const text = typeof message.content === "string" ? message.content : "";
  return new Text(theme.fg("muted", `[tool-hooks session context]\n${text}`), 0, 0);
});
```

Implementation notes:
- `CLAUDE_ENV_FILE` must exist before the SessionStart hook runs because the current Chestnut Flake config appends exports into it.
- Ignore malformed JSON stdout and non-zero non-blocking exits instead of crashing the session.
- Only allow shallow input patching of keys already present on the tool input object; do not accept arbitrary shape replacement.
- Only allow `content`, `details`, and `isError` result patch keys because those map directly to Pi’s `ToolResultEventResult`.

### Tests
Manual mutation safety checks:

```text
1. Temporary PreToolUse hook prints {"inputPatch":{"command":"echo patched"}} for Bash.
2. Trigger bash with command "echo original".
3. Confirm the executed command becomes "echo patched".
4. Repeat with an invalid patch key and confirm it is ignored.
```

```text
1. Temporary PostToolUse hook prints {"resultPatch":{"details":{"patched":true},"content":[{"type":"text","text":"patched result"}]}}.
2. Trigger a bash or read tool call.
3. Confirm the model sees "patched result" and the tool result details include patched=true.
```

```text
1. Temporary SessionStart hook appends `export TOOL_HOOKS_TEST=1` to "$CLAUDE_ENV_FILE".
2. Run /reload.
3. Trigger bash `echo $TOOL_HOOKS_TEST`.
4. Confirm the env variable is available in subsequent bash commands.
```

### Verify
```bash
ls /tmp | rg 'pi-tool-hooks-' || true
```

---

## Slice 4: Build auto-agents path discovery, hashing, and persisted session state

### Files
- `.pi-config/extensions/auto-agents/types.ts` (new)
- `.pi-config/extensions/auto-agents/paths.ts` (new)
- `.pi-config/extensions/auto-agents/hash.ts` (new)
- `.pi-config/extensions/auto-agents/state.ts` (new)

### Changes

**`.pi-config/extensions/auto-agents/types.ts`** (new):
```ts
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
}

export interface AgentsCandidate {
  path: string;
  hash: string;
}

export interface AutoAgentsReadDetails {
  autoAgents?: {
    loaded: AutoAgentsStateEntry[];
    skipped: string[];
  };
}
```

**`.pi-config/extensions/auto-agents/paths.ts`** (new):
```ts
import path from "node:path";
import { existsSync } from "node:fs";
import { resolveReadPath } from "@mariozechner/pi-coding-agent/dist/core/tools/path-utils.js";
import type { ResolvedReadTarget } from "./types";

export function resolveReadTarget(cwd: string, inputPath: string): ResolvedReadTarget {
  return {
    requestedPath: inputPath,
    absolutePath: resolveReadPath(inputPath, cwd),
  };
}

export function findAncestorAgentsFiles(targetPath: string): string[] {
  const startDir = path.dirname(targetPath);
  const files: string[] = [];
  let current = startDir;

  while (true) {
    const candidate = path.join(current, "AGENTS.md");
    if (existsSync(candidate)) files.unshift(candidate);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return files;
}
```

If the direct `resolveReadPath` import proves unstable, inline the same resolution logic in this file instead of reaching into a deep compiled path.

**`.pi-config/extensions/auto-agents/hash.ts`** (new):
```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function hashAgentsFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
```

**`.pi-config/extensions/auto-agents/state.ts`** (new):
```ts
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentsCandidate, AutoAgentsStateEntry, AutoAgentsStateSnapshot } from "./types";

export const AUTO_AGENTS_STATE_TYPE = "auto-agents-state";

export function restoreAutoAgentsState(ctx: ExtensionContext): AutoAgentsStateSnapshot {
  const byPath = new Map<string, AutoAgentsStateEntry>();

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "custom" || entry.customType !== AUTO_AGENTS_STATE_TYPE) continue;
    const data = entry.data as AutoAgentsStateEntry | undefined;
    if (data?.path && data.hash) byPath.set(data.path, data);
  }

  return { byPath };
}

export function shouldReadAgentsFile(state: AutoAgentsStateSnapshot, candidate: AgentsCandidate): boolean {
  return state.byPath.get(candidate.path)?.hash !== candidate.hash;
}

export function rememberAgentsFile(
  state: AutoAgentsStateSnapshot,
  entry: AutoAgentsStateEntry,
  appendEntry: (customType: string, data?: unknown) => void,
) {
  state.byPath.set(entry.path, entry);
  appendEntry(AUTO_AGENTS_STATE_TYPE, entry);
}
```

Implementation notes:
- Preserve exact absolute path identity; do not collapse symlinks with `realpath`.
- Walk every ancestor directory on each read call, starting from the target file’s directory and ordering results outermost to innermost.
- Persist only durable dedupe facts: path, hash, timestamp, and trigger path.

### Tests
Inline path/hash checks after implementation:

```text
1. Point `resolveReadTarget()` at a known nested file under the repo.
2. Confirm `findAncestorAgentsFiles()` returns ancestor AGENTS paths in outermost-to-innermost order.
3. Hash one AGENTS file, store state, then change the file contents and confirm `shouldReadAgentsFile()` flips back to true.
```

### Verify
```bash
find . -name AGENTS.md | head
```

---

## Slice 5: Replace `read` with the delegating auto-agents wrapper

### Files
- `.pi-config/extensions/auto-agents/index.ts` (new)
- `.pi-config/extensions/auto-agents/render.ts` (new)
- `.pi-config/agent/settings.json` (modify)

### Changes

**`.pi-config/extensions/auto-agents/render.ts`** (new):
```ts
import { Text } from "@mariozechner/pi-tui";
import type { ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import type { AutoAgentsReadDetails } from "./types";

export function renderAutoAgentsSummary(
  result: { details?: AutoAgentsReadDetails },
  options: ToolRenderResultOptions,
  theme: typeof import("@mariozechner/pi-coding-agent").theme,
) {
  const loaded = result.details?.autoAgents?.loaded ?? [];
  const skipped = result.details?.autoAgents?.skipped ?? [];
  if (loaded.length === 0 && skipped.length === 0) return undefined;

  let text = theme.fg("muted", `[auto-agents loaded ${loaded.length}, skipped ${skipped.length}]`);
  if (options.expanded && loaded.length > 0) {
    for (const entry of loaded) {
      text += `\n${theme.fg("accent", entry.path)}`;
    }
  }
  return new Text(text, 0, 0);
}
```

**`.pi-config/extensions/auto-agents/index.ts`** (new):
```ts
import type { ExtensionAPI, ReadToolDetails } from "@mariozechner/pi-coding-agent";
import { createReadTool } from "@mariozechner/pi-coding-agent";
import { restoreAutoAgentsState, rememberAgentsFile, shouldReadAgentsFile } from "./state";
import { findAncestorAgentsFiles, resolveReadTarget } from "./paths";
import { hashAgentsFile } from "./hash";
import { renderAutoAgentsSummary } from "./render";
import type { AutoAgentsStateEntry, AutoAgentsReadDetails } from "./types";

export default function autoAgents(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const originalRead = createReadTool(cwd);
  let state = { byPath: new Map<string, AutoAgentsStateEntry>() };

  pi.on("session_start", async (_event, ctx) => {
    state = restoreAutoAgentsState(ctx);
  });

  pi.registerTool({
    name: "read",
    label: originalRead.label,
    description: originalRead.description,
    promptSnippet: originalRead.promptSnippet,
    promptGuidelines: originalRead.promptGuidelines,
    parameters: originalRead.parameters,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const target = resolveReadTarget(cwd, params.path);
      const candidates = findAncestorAgentsFiles(target.absolutePath);
      const loaded: AutoAgentsStateEntry[] = [];
      const skipped: string[] = [];

      for (const agentsPath of candidates) {
        const hash = hashAgentsFile(agentsPath);
        if (!shouldReadAgentsFile(state, { path: agentsPath, hash })) {
          skipped.push(agentsPath);
          continue;
        }

        await originalRead.execute(toolCallId, { path: agentsPath }, signal, onUpdate, ctx);
        const entry: AutoAgentsStateEntry = {
          path: agentsPath,
          hash,
          loadedAt: new Date().toISOString(),
          triggerPath: target.absolutePath,
        };
        rememberAgentsFile(state, entry, pi.appendEntry);
        loaded.push(entry);
      }

      const result = await originalRead.execute(toolCallId, params, signal, onUpdate, ctx);
      return {
        ...result,
        details: {
          ...(result.details as ReadToolDetails | undefined),
          autoAgents: { loaded, skipped },
        } as ReadToolDetails & AutoAgentsReadDetails,
      };
    },

    renderCall: originalRead.renderCall,
    renderResult(result, options, theme, context) {
      const base = originalRead.renderResult?.(result, options, theme, context);
      const auto = renderAutoAgentsSummary(result as { details?: AutoAgentsReadDetails }, options, theme);
      if (!auto) return base;
      if (!base) return auto;
      const baseText = "render" in base ? base : undefined;
      if (baseText && "setText" in baseText) {
        const existing = (baseText as unknown as { getText?: () => string; setText: (text: string) => void }).getText?.() ?? "";
        (baseText as unknown as { setText: (text: string) => void }).setText(`${existing}\n${auto.render(200).lines.join("\n")}`);
        return base;
      }
      return base;
    },
  });
}
```

Implementation notes:
- Keep the wrapper tool named `read`; Pi will replace the built-in registration with this one.
- Delegate actual file reading to `createReadTool(cwd)` so truncation/image behavior stays identical.
- The `autoAgents` summary belongs in `details` and renderer output, not a separate custom message.
- Reuse the same `toolCallId` because Pi does not expose a nested tool execution API; the auto-loaded AGENTS reads are delegated internal reads, not separate assistant-issued tool calls.

**`.pi-config/agent/settings.json`** (modify):
Insert the new extensions after the locally owned ones and keep `tool-hooks` before `auto-agents`:
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

### Tests
Manual end-to-end checks after this slice:

```text
1. Run /reload.
2. Ask Pi to read `thoughts/.../outline.md`.
3. Confirm the read tool succeeds.
4. Expand the tool result and verify the auto-agents summary lists ancestor AGENTS files.
5. Read the same file again and confirm the summary shows zero newly loaded files and the previous paths under skipped.
```

```text
1. Edit one ancestor AGENTS.md.
2. Read the same target file again.
3. Confirm the changed AGENTS path moves back into loaded.
```

### Verify
```bash
python - <<'PY'
import json
p = '.pi-config/agent/settings.json'
obj = json.load(open(p))
assert '+extensions/tool-hooks/index.ts' in obj['extensions']
assert '+extensions/auto-agents/index.ts' in obj['extensions']
print('settings wired for tool-hooks + auto-agents')
PY
```

---

## Slice 6: Wire tracked config, reload Pi, and run end-to-end smoke verification

### Files
- `.pi-config/agent/settings.json` (modify if not already done in slice 5)
- `.pi-config/AGENTS.md` (modify only if a short pointer for these extensions is genuinely needed)
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md` (already updated during planning; preserve as-is unless implementation forces another durable change)

### Changes

**Tracked config wiring and verification steps:**
- Ensure `.pi-config/config/` exists and is tracked.
- Ensure the new extension directories are committed under `.pi-config/extensions/`.
- If `.pi-config/AGENTS.md` needs a note, keep it to one short bullet: `tool-hooks` and `auto-agents` are locally owned tracked extensions loaded from `agent/settings.json`.
- Do not add package-managed duplicates of `tool-hooks` or `auto-agents`.

**Optional `.pi-config/AGENTS.md` pointer** (modify only if implementation experience shows it matters):
```md
## Extension ownership

- `extensions/tool-hooks/index.ts` and `extensions/auto-agents/index.ts` are local tracked extensions loaded explicitly from `agent/settings.json`.
- Keep `tool-hooks` before `auto-agents` in load order.
```

### Tests
Run the real smoke sequence inside Pi after `/reload`:

```text
1. /reload
2. Trigger a Bash tool call that the configured PreToolUse hook should observe.
3. Confirm the hook command receives Claude-style stdin JSON and can inspect tool_input.command.
4. Trigger a read on a deeply nested file.
5. Confirm the read result's expanded renderer shows ancestor AGENTS activity.
6. Trigger the same read again.
7. Confirm unchanged AGENTS files are skipped.
8. Modify one ancestor AGENTS.md, repeat the read, and confirm hash-based re-read.
9. Trigger a Bash command that reads an env variable exported via SessionStart and confirm the env propagation works.
```

### Verify
```text
/reload
```
Then manually run the smoke checks above in the live Pi session. This slice is not complete until `/reload` succeeds and the smoke checks pass.
