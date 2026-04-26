---
date: 2026-04-25T20:06:47-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: af1a5b4c4b44e997d551b126a4b7cdbcf3282e35
branch: main
repository: dotfiles
stage: research
ticket: "implementation-review follow-up"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups"
---

# Research: tool-hooks config path

## Brainstorm Summary
- Desired outcome: understand the facts needed to fix the implementation-review P1 where `tool-hooks` fails to load its JSON config when Pi loads the extension through the tracked `agent/extensions -> ../extensions` symlink layout.
- Scope is intentionally narrow: focus on `tool-hooks` config path resolution, Pi extension loading paths, and verification that fresh Pi/subagent startup can load the global extensions.
- Preserve the dotfiles layout constraint that tracked source lives under `.pi-config/` while Pi runtime discovery happens under `.pi-config/agent/` through symlinks.
- Defer broader hook-extension hardening unless research shows it is directly required to explain or verify the load failure.

## Research Question
Answers `questions/2026-04-25_20-03-36_tool-hooks-config-path.md`: current `tool-hooks` config path behavior, Pi extension loading path behavior, existing path-resolution patterns, and verification entry points for the startup failure.

## Summary
`tool-hooks` computes its config path from `import.meta.url` and loads it during extension factory execution. Pi's global resource model uses `~/.pi/agent/extensions` as the auto-discovery root, and this dotfiles repo intentionally exposes `.pi-config/extensions` through `.pi-config/agent/extensions -> ../extensions`. With the current settings `+extensions/tool-hooks/index.ts`, Pi treats the entry as a force-include override for the auto-discovered extension under the agent extensions root, not as a standalone plain configured file path. Therefore the extension can execute as `/Users/coreycole/.pi/agent/extensions/tool-hooks/index.ts`, making `../../config/tool-hooks.json` resolve to `/Users/coreycole/.pi/agent/config/tool-hooks.json`; the tracked config exists at `.pi-config/config/tool-hooks.json`, not under `agent/config`. Subagent locator/analyzer startup currently fails on that missing file before research subagents can run.

## Detailed Findings

### 1. Current `tool-hooks` config derivation and file layout

`tool-hooks` derives `EXTENSION_DIR` from `fileURLToPath(import.meta.url)` and sets `CONFIG_PATH` with `path.resolve(EXTENSION_DIR, "../../config/tool-hooks.json")` (`.pi-config/extensions/tool-hooks/index.ts:9-10`). The extension loads this file immediately inside the exported factory via `loadToolHooksConfig(CONFIG_PATH)` (`.pi-config/extensions/tool-hooks/index.ts:18-19`).

`loadToolHooksConfig()` resolves the passed path, reads it synchronously, parses JSON, validates the shape, and returns normalized rules (`.pi-config/extensions/tool-hooks/config.ts:81-104`). Missing files therefore fail extension startup before any hooks are registered (`.pi-config/extensions/tool-hooks/config.ts:81-84`).

The tracked config file is `.pi-config/config/tool-hooks.json` and contains `SessionStart` and `PreToolUse` hooks (`.pi-config/config/tool-hooks.json:1-26`). The repo layout documents top-level `extensions/`, `skills/`, and `agents/` as tracked source directories and `agent/` as the runtime path Pi expects (`.pi-config/README.md:11-15`). It also documents `agent/extensions -> ../extensions` as the bridge from runtime discovery to tracked source (`.pi-config/README.md:27-31`, `.pi-config/README.md:51-56`). The same invariant is repeated in `.pi-config/AGENTS.md`: Pi auto-discovers resources under `~/.pi/agent/`, and `agent/extensions -> ../extensions` mirrors tracked resources into that runtime layout (`.pi-config/AGENTS.md:7-21`).

Observed filesystem state matches the docs: `~/.pi` is a symlink to `/Users/coreycole/dotfiles/.pi-config`; `.pi-config/agent/extensions` is a symlink to `../extensions`; `~/.pi/config/tool-hooks.json` exists; `~/.pi/agent/config/tool-hooks.json` does not exist.

### 2. Pi global/settings extension discovery path behavior

Pi docs state that global auto-discovered extensions live at `~/.pi/agent/extensions/*.ts` and `~/.pi/agent/extensions/*/index.ts` (`context/pi-mono/packages/coding-agent/docs/extensions.md:107-118`). The docs also state that extensions in `~/.pi/agent/extensions/` or `.pi/extensions/` can be hot-reloaded with `/reload` (`context/pi-mono/packages/coding-agent/docs/extensions.md:7`).

The core config uses `CONFIG_DIR_NAME` of `.pi` by default and `getAgentDir()` returns `~/.pi/agent` unless `PI_CODING_AGENT_DIR` overrides it (`context/pi-mono/packages/coding-agent/src/config.ts:306-335`). The package manager sets `globalBaseDir` to `this.agentDir`, resolves global settings entries relative to that base, and then also adds auto-discovered resources from `join(globalBaseDir, "extensions")` (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:857-888`, `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2137-2145`, `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2200-2206`).

The current global settings list `+extensions/tool-hooks/index.ts` and `+extensions/auto-agents/index.ts` (`.pi-config/agent/settings.json:15-20`). In package-manager semantics, entries starting with `+` are patterns/overrides, not plain paths (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:240-245`). Override handling strips `+` into `forceIncludes` (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:667-674`), and exact matching compares the stripped pattern against either the relative path from the base directory or the absolute path (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:646-659`). Auto extension entries under the user extensions directory are collected from `join(globalBaseDir, "extensions")` (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:545-596`, `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2200-2206`).

That means `+extensions/tool-hooks/index.ts` force-includes the auto-discovered path relative to `globalBaseDir` (`~/.pi/agent`), producing a runtime extension path under `~/.pi/agent/extensions/tool-hooks/index.ts`, not the top-level `~/.pi/extensions/tool-hooks/index.ts` path.

The extension loader imports the resolved extension path through jiti (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:341-350`), creates extension metadata using `path.dirname(resolvedPath)` as `baseDir` (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:358-368`), calls the extension factory, and wraps factory errors as `Failed to load extension: ...` (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:386-400`). `loadExtensions()` continues through paths and records errors when `loadExtension()` returns an error (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:422-439`).

### 3. Existing path/resource patterns

`context/pi-mono` examples commonly resolve extension-adjacent global support files from `getAgentDir()`, not from `import.meta.url`. The sandbox example sets its global config path to `join(getAgentDir(), "extensions", "sandbox.json")` (`context/pi-mono/packages/coding-agent/examples/extensions/sandbox/index.ts:79-82`). The GitLab Duo test reads auth from `join(getAgentDir(), "extensions", "auth.json")` (`context/pi-mono/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/test.ts:30-32`). These examples place supporting files under the agent directory hierarchy.

The loader itself does not canonicalize extension import paths through `realpath` before loading. It expands `~`, resolves relative paths against `cwd`, and imports that resolved path (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:109-126`, `context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:341-350`, `context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:378-388`). Separately, `context/pi-mono` does use canonicalization in other file-path-sensitive areas: the extension docs say `withFileMutationQueue()` canonicalizes existing files through `realpath()` so symlink aliases share one queue (`context/pi-mono/packages/coding-agent/docs/extensions.md:1636-1642`), and package-manager deduplicates skill paths using `realpathSync()` (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2288-2295`).

### 4. Verification facts and smoke-test entry points

Current subagent startup is a reproducer: three `codebase-locator` runs failed before execution with `Failed to load extension "/Users/coreycole/.pi/agent/extensions/tool-hooks/index.ts" ... open '/Users/coreycole/.pi/agent/config/tool-hooks.json'` (`thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/research/2026-04-25_20-03-36_locator-subagent-failure.md:1-9`). A follow-up `codebase-analyzer` run failed with the same startup error (`thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/research/2026-04-25_20-03-36_locator-subagent-failure.md:11-17`).

Path calculation is also directly reproducible from the current source formula: using `/Users/coreycole/.pi/agent/extensions/tool-hooks/index.ts` as the importing file maps `../../config/tool-hooks.json` to `/Users/coreycole/.pi/agent/config/tool-hooks.json`; using `/Users/coreycole/.pi/extensions/tool-hooks/index.ts` or `/Users/coreycole/dotfiles/.pi-config/extensions/tool-hooks/index.ts` maps to the existing top-level config path.

For post-change verification, the facts above imply these smoke checks cover the failure boundary:

- A direct path-calculation/config-load check for `.pi-config/extensions/tool-hooks/index.ts` should show the config path resolves to an existing `tool-hooks.json` and `loadToolHooksConfig()` can parse it (`.pi-config/extensions/tool-hooks/index.ts:9-19`, `.pi-config/extensions/tool-hooks/config.ts:81-104`, `.pi-config/config/tool-hooks.json:1-26`).
- A fresh subagent run is a valid extension-load smoke test because subagent startup currently fails before its task begins on the global `tool-hooks` load error (`thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/research/2026-04-25_20-03-36_locator-subagent-failure.md:1-17`).
- A Pi reload/startup smoke test exercises the documented hot-reload/global extension path (`context/pi-mono/packages/coding-agent/docs/extensions.md:7`, `context/pi-mono/packages/coding-agent/docs/extensions.md:107-118`) and the loader code path that imports extension modules and calls factories (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:341-400`).

## Code References
- `.pi-config/extensions/tool-hooks/index.ts:9-19` — derives config path from `import.meta.url` and loads config during factory execution.
- `.pi-config/extensions/tool-hooks/config.ts:81-104` — synchronously resolves, reads, parses, validates, and normalizes the config file.
- `.pi-config/config/tool-hooks.json:1-26` — tracked hook config that exists outside `agent/`.
- `.pi-config/agent/settings.json:15-20` — force-includes local `tool-hooks` and `auto-agents` extensions.
- `.pi-config/README.md:27-31` — documents tracked source vs runtime discovery path and the `agent/extensions -> ../extensions` bridge.
- `.pi-config/AGENTS.md:7-21` — documents the same Pi config layout constraint for agents.
- `context/pi-mono/packages/coding-agent/src/config.ts:306-335` — default `getAgentDir()` is `~/.pi/agent`.
- `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:240-245` — `+` entries are treated as patterns/overrides.
- `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:545-596` — auto-discovered extension entries are collected from the extensions directory.
- `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:857-888` — global settings are resolved with `globalBaseDir = this.agentDir` and auto resources are added.
- `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:667-674` — `+` overrides become force-includes.
- `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:646-659` — force-include exact matching compares against relative and absolute paths.
- `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2200-2206` — user/global auto extension discovery uses `userDirs.extensions`.
- `context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:341-400` — jiti imports the resolved path and factory errors become extension load errors.
- `thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/research/2026-04-25_20-03-36_locator-subagent-failure.md:1-17` — current subagent locator/analyzer startup failure.

## Historical Context
- The research pass could not use normal `codebase-locator`/`codebase-analyzer` delegation because each subagent failed at global extension load before starting (`thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/research/2026-04-25_20-03-36_locator-subagent-failure.md:1-17`).

## Surprises
- The `+extensions/tool-hooks/index.ts` settings entry is not a plain configured path in package-manager semantics; it is an override/force-include pattern applied to auto-discovered resources (`context/pi-mono/packages/coding-agent/src/core/package-manager.ts:240-245`, `context/pi-mono/packages/coding-agent/src/core/package-manager.ts:667-674`, `.pi-config/agent/settings.json:15-20`).
- The loader imports the resolved extension path as provided by discovery and does not canonicalize through `realpath` before jiti import (`context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:341-350`, `context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts:378-388`).

## Open Questions
- I could not determine from static code alone whether jiti always preserves the symlinked file path in `import.meta.url`; the current subagent failure shows that the active runtime path did preserve `/Users/coreycole/.pi/agent/extensions/tool-hooks/index.ts` for this environment (`thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/research/2026-04-25_20-03-36_locator-subagent-failure.md:1-17`).
