---
date: 2026-04-25T21:29:54-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: af1a5b4c4b44e997d551b126a4b7cdbcf3282e35
branch: main
repository: dotfiles
stage: plan
ticket: "implementation-review follow-up P1"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups"
---

# Implementation Plan: Fix tool-hooks Config Path Under Pi Agent Symlink

## Status
- [x] Slice 1: Resolve `tool-hooks` config from Pi agent-dir parent and smoke-test fresh extension loading

## Source Artifacts
- `context/question/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read_implementation-review.md` — implementation review that found the P1 startup failure.
- `questions/2026-04-25_20-03-36_tool-hooks-config-path.md` — narrow research questions for this follow-up.
- `research/2026-04-25_20-06-47_tool-hooks-config-path.md` — canonical path-resolution facts.
- `context/research/2026-04-25_20-03-36_locator-subagent-failure.md` — current fresh-subagent startup failure evidence.

This plan intentionally fast-paths directly from research because the follow-up scope is a single reviewed P1: `tool-hooks` must load `.pi-config/config/tool-hooks.json` even when Pi imports the extension through `~/.pi/agent/extensions -> ../extensions`.

## Slice 1: Resolve `tool-hooks` config from Pi agent-dir parent and smoke-test fresh extension loading

### Files
- `.pi-config/extensions/tool-hooks/index.ts` (modify)

### Changes

**Do not** create `.pi-config/agent/config/`, `~/.pi/agent/config/`, or a symlink there. That would hide the reviewed bug and violate the tracked/runtime layout documented in `.pi-config/AGENTS.md`.

**`.pi-config/extensions/tool-hooks/index.ts`** (modify):

Replace the current imports and config-path constants at the top of the file:

```ts
import { createBashToolDefinition, type ExtensionAPI, type SessionStartEvent } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadToolHooksConfig } from "./config";
import { buildHookPayload } from "./payload";
import { createClaudeEnvFile, runHookRules, shellQuote } from "./runner";

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(EXTENSION_DIR, "../../config/tool-hooks.json");
```

with this code:

```ts
import { createBashToolDefinition, getAgentDir, type ExtensionAPI, type SessionStartEvent } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import path from "node:path";
import { loadToolHooksConfig } from "./config";
import { buildHookPayload } from "./payload";
import { createClaudeEnvFile, runHookRules, shellQuote } from "./runner";

const CONFIG_PATH = path.join(path.dirname(getAgentDir()), "config", "tool-hooks.json");
```

Leave the rest of the file unchanged. In particular, keep this line inside `toolHooks()` as-is so config validation still fails fast on malformed/missing config:

```ts
const rules = loadToolHooksConfig(CONFIG_PATH);
```

Expected post-edit top of file:

```ts
import { createBashToolDefinition, getAgentDir, type ExtensionAPI, type SessionStartEvent } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import path from "node:path";
import { loadToolHooksConfig } from "./config";
import { buildHookPayload } from "./payload";
import { createClaudeEnvFile, runHookRules, shellQuote } from "./runner";

const CONFIG_PATH = path.join(path.dirname(getAgentDir()), "config", "tool-hooks.json");

function sessionStartSource(reason: SessionStartEvent["reason"]): "startup" | "resume" | undefined {
  if (reason === "resume") return "resume";
  if (reason === "startup" || reason === "reload" || reason === "new" || reason === "fork") return "startup";
  return undefined;
}
```

Rationale locked by research:
- `getAgentDir()` returns Pi's runtime agent dir (`~/.pi/agent` in this repo).
- `path.dirname(getAgentDir())` is the tracked config root (`~/.pi`, symlinked to `.pi-config`).
- The config file already exists at `~/.pi/config/tool-hooks.json` / `.pi-config/config/tool-hooks.json`.
- `import.meta.url` can preserve the symlinked extension path (`~/.pi/agent/extensions/tool-hooks/index.ts`), making `../../config/tool-hooks.json` incorrectly point to missing `~/.pi/agent/config/tool-hooks.json`.

### Tests

No persistent test harness exists for `.pi-config/extensions/tool-hooks`. Run this inline regression smoke test after the edit:

```bash
node --input-type=module <<'JS'
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const indexPath = ".pi-config/extensions/tool-hooks/index.ts";
const source = readFileSync(indexPath, "utf8");

if (!source.includes("getAgentDir")) {
  throw new Error("tool-hooks index.ts must import/use getAgentDir()");
}
if (source.includes("fileURLToPath(import.meta.url)")) {
  throw new Error("tool-hooks index.ts must not resolve config from import.meta.url");
}
if (source.includes("../../config/tool-hooks.json")) {
  throw new Error("tool-hooks index.ts still contains the symlink-sensitive ../../config path");
}

const agentDir = path.join(process.env.HOME, ".pi", "agent");
const expectedConfigPath = path.join(path.dirname(agentDir), "config", "tool-hooks.json");
const oldBrokenConfigPath = path.join(agentDir, "config", "tool-hooks.json");

if (!existsSync(expectedConfigPath)) {
  throw new Error(`expected config is missing: ${expectedConfigPath}`);
}
if (existsSync(oldBrokenConfigPath)) {
  throw new Error(`do not satisfy the bug by creating the old broken path: ${oldBrokenConfigPath}`);
}

const config = JSON.parse(readFileSync(expectedConfigPath, "utf8"));
if (!config.hooks || typeof config.hooks !== "object") {
  throw new Error("tool-hooks config JSON must contain a hooks object");
}

console.log(`tool-hooks config root OK: ${expectedConfigPath}`);
console.log(`old symlink-derived config path remains absent: ${oldBrokenConfigPath}`);
JS
```

### Verify

Run these checks in order:

1. Confirm the implementation diff is exactly the intended path-resolution change:

```bash
git diff -- .pi-config/extensions/tool-hooks/index.ts
```

The diff should only:
- add `getAgentDir` to the `@mariozechner/pi-coding-agent` import;
- remove `fileURLToPath` from `node:url`;
- remove `EXTENSION_DIR`;
- replace `CONFIG_PATH = path.resolve(EXTENSION_DIR, "../../config/tool-hooks.json")` with `CONFIG_PATH = path.join(path.dirname(getAgentDir()), "config", "tool-hooks.json")`.

2. Run the inline regression smoke test from the **Tests** section.

3. Reload the current Pi session:

```text
/reload
```

The reload must not report:
- `Failed to load extension "/Users/coreycole/.pi/agent/extensions/tool-hooks/index.ts"`;
- `open '/Users/coreycole/.pi/agent/config/tool-hooks.json'`.

4. Run one fresh subagent startup smoke test. Use any lightweight read-only task; this exact task is sufficient:

```text
subagent codebase-locator: In /Users/coreycole/dotfiles, identify the files relevant to tool-hooks config loading. Return only file paths and do not modify files.
```

The subagent must start and return paths. It must not fail before execution with the `tool-hooks` extension load error.

5. Finish with repository hygiene checks:

```bash
git diff --check -- .pi-config/extensions/tool-hooks/index.ts thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups
```
