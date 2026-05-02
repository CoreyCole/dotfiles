---
date: 2026-05-02T00:03:19-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: research
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
---

# Research: Pi Config Cleanup and Organization

## Brainstorm Summary

- Desired outcome from the question doc: make `~/dotfiles/.pi-config` clean, portable, and unsurprising to symlink as `~/.pi` on new machines.
- Validated context: `.pi-config` is both tracked dotfiles source and Pi's global config root via `~/.pi -> ~/dotfiles/.pi-config` (`.pi-config/README.md:9-11`).
- Validated constraint: tracked resources and ignored runtime state may coexist, but the boundary must be explicit; current docs already distinguish tracked resources from runtime state (`.pi-config/README.md:31-45`).
- Validated constraint: `setup.sh` should become validation/reporting only; current `setup.sh` still installs packages and `parallel-cli` (`.pi-config/setup.sh:44-68`).
- Validated constraint: root `.pi-config/package.json` and `package-lock.json` stay for local extension TypeScript/LSP support; they currently pin Pi packages and expose extension/skill package metadata (`.pi-config/package.json:8-20`, `.pi-config/package-lock.json:992-1051`).
- Human clarification during research: local/default agents should use GPT 5.5 throughout; fast tasks should use thinking off, not mini-model variants. Current local `worker` still uses `gpt-5.3-codex-spark` with `thinking: minimal` (`.pi-config/agent/agents/worker.md:5-6`).

## Research Question

This pass answers `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/questions/2026-05-01_23-49-21_pi-config-cleanup.md`, covering Pi's actual config/resource paths, current `.pi-config` tracked/runtime state, package cache semantics, setup dependencies, subagent collision behavior, useful/stale local resources, and documentation gaps.

## Summary

Pi's canonical global agent directory is `~/.pi/agent` unless `PI_CODING_AGENT_DIR` overrides it (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:192-215`). With `~/.pi` symlinked to `.pi-config`, Pi's global settings, auth, sessions, packages, extensions, skills, prompts, themes, and context files all resolve under `.pi-config/agent/` (`.pi-config/README.md:15-25`). Git state currently shows tracked source config mixed with ignored runtime/cache state, one untracked `agent/extensions/subagent/config.json`, one modified local `scout` agent, and 73 deleted tracked files under stale `.pi-config/pi-subagents/` cache. `agent/settings.json` is tracked even though `.pi-config/README.md` currently lists it under runtime state (`.pi-config/README.md:39-45`).

Pi startup resolves settings packages and auto-installs missing npm/git packages unless offline mode is enabled (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1071-1126`). Package git caches live under `.pi-config/agent/git/<host>/<path>` globally (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1732-1747`). `pi-subagents` builtin agents are lower priority than user agents, so local `researcher`, `reviewer`, `scout`, and `worker` override package builtins of the same names (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agent-selection.ts:4-20`).

## Detailed Findings

### 1. Pi global config, runtime, and resource discovery paths

Pi's config path authority is `src/config.ts` in the local `pi-mono` clone. `APP_NAME` defaults to `pi`, `CONFIG_DIR_NAME` defaults to `.pi`, and `ENV_AGENT_DIR` becomes `PI_CODING_AGENT_DIR` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:187-192`). `getAgentDir()` uses that env var first and otherwise returns `join(homedir(), CONFIG_DIR_NAME, "agent")`, i.e. `~/.pi/agent` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:207-215`).

Core global files under the agent dir are:

- settings: `<agentDir>/settings.json` via `getSettingsPath()` and `FileSettingsStorage` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:234-235`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/settings-manager.ts:143-148`)
- auth: `<agentDir>/auth.json` via `getAuthPath()` and `AuthStorage.create()` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:229-230`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/auth-storage.ts:195-196`)
- sessions: `<agentDir>/sessions`, with per-cwd directories beneath it (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:254-255`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/session-manager.ts:423-427`)
- prompts: `<agentDir>/prompts` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:249-250`)
- themes: `<agentDir>/themes` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:219-220`)

Settings docs match the code: global settings are `~/.pi/agent/settings.json`, project settings are `.pi/settings.json`, and resource paths in those files resolve relative to their respective settings directories (`.pi-config/context/pi-mono/packages/coding-agent/docs/settings.md:3-8`, `.pi-config/context/pi-mono/packages/coding-agent/docs/settings.md:162-173`).

Resource reload calls `packageManager.resolve()` before loading extensions, skills, prompts, and themes (`.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:318-321`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:395-461`). Auto-discovered global resource dirs are `<agentDir>/extensions`, `<agentDir>/skills`, `<agentDir>/prompts`, and `<agentDir>/themes`; project dirs are `<cwd>/.pi/extensions`, `<cwd>/.pi/skills`, `<cwd>/.pi/prompts`, and `<cwd>/.pi/themes` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2019`). Skills additionally load from global `~/.agents/skills` and ancestor `.agents/skills` directories (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2019-2021`, `.pi-config/context/pi-mono/packages/coding-agent/docs/skills.md:24-41`).

Context files are not under the package manager resource types. Pi checks `AGENTS.md` then `CLAUDE.md`, first in the global agent dir and then from cwd upward through ancestors (`.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:58-97`). System prompt replacement/appending uses project `.pi/SYSTEM.md`/`.pi/APPEND_SYSTEM.md` before global `<agentDir>/SYSTEM.md`/`APPEND_SYSTEM.md` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:834-854`).

### 2. Current tracked, ignored, untracked, and deleted `.pi-config` state

Read-only git verification on 2026-05-02 showed 75 `.pi-config` status entries: one modified file, 73 deleted tracked files under `.pi-config/pi-subagents/`, and one untracked directory/file under `.pi-config/agent/extensions/subagent/`. The modified file is `.pi-config/agent/agents/scout.md`; the untracked file is `.pi-config/agent/extensions/subagent/config.json`; the 73 deleted entries are the stale tracked `.pi-config/pi-subagents/*` files. This comes from `git status --short -- .pi-config`, `git ls-files --deleted -- .pi-config`, and `git ls-files --others --exclude-standard -- .pi-config` run during this research.

Tracked portable source config includes `.pi-config/.gitignore`, `.pi-config/AGENTS.md`, `.pi-config/README.md`, `.pi-config/setup.sh`, `.pi-config/package.json`, `.pi-config/package-lock.json`, `.pi-config/agent/settings.json`, `.pi-config/agent/mcp.json`, `.pi-config/config/tool-hooks.json`, local agents, local extensions, local skills, and local scripts, verified by `git ls-files -- .pi-config/...`. The tracked local extension list includes `answer.ts`, `branch.ts`, `cost.ts`, `execute-command.ts`, `previous-prompt.ts`, `review.ts`, `todos.ts`, `watchdog.ts`, and `tool-hooks/*`, verified by `git ls-files -- .pi-config/agent/extensions`.

Ignored runtime/cache/secret paths are currently:

- `.pi-config/agent/auth.json`
- `.pi-config/agent/git/`
- `.pi-config/agent/run-history.jsonl`
- `.pi-config/agent/sessions/`
- `.pi-config/context/`
- `.pi-config/history/`
- `.pi-config/node_modules/`

Those paths appeared as ignored in `git status --short --ignored=matching -- .pi-config`. Ignore rules come from root `.gitignore` for `.pi-config/node_modules/`, `.pi-config/agent/auth.json`, `.pi-config/agent/sessions/`, and `.pi-config/agent/run-history.jsonl` (`.gitignore:29-35`), from `.pi-config/.gitignore` for `auth.json`, `git/`, `run-history.jsonl`, `sessions/`, and `history/` (`.pi-config/.gitignore:1-6`), and from root `.gitignore` for generic `context/` (`.gitignore:36`).

`agent/settings.json` is tracked (`git ls-files -- .pi-config/agent/settings.json`) and not ignored (`git check-ignore -v .pi-config/agent/settings.json` returned no match), while `.pi-config/README.md` currently lists `agent/settings.json` under runtime state (`.pi-config/README.md:39-45`).

### 3. Package declarations, caches, and missing package behavior

`.pi-config/agent/settings.json` declares six packages: `nicobailon/pi-subagents`, `nicobailon/pi-mcp-adapter`, `HazAT/pi-smart-sessions`, `HazAT/pi-parallel`, `CoreyCole/pi-deterministic-docs`, and `algal/pi-context-inspect` (`.pi-config/agent/settings.json:11-17`). Pi package settings can be strings or filtered objects with `source`, `extensions`, `skills`, `prompts`, and `themes` keys (`.pi-config/context/pi-mono/packages/coding-agent/src/core/settings-manager.ts:53-60`, `.pi-config/context/pi-mono/packages/coding-agent/docs/settings.md:177-201`).

Package resources come from a package `pi` manifest when present, otherwise from conventional package directories `extensions/`, `skills/`, `prompts/`, and `themes/` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1786-1910`, `.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:150-155`). The `pi-subagents` cached package has a `pi` manifest exporting extension `./index.ts`, skills `./skills`, and prompts `./prompts` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/package.json:44-52`).

Global git package caches are under `<agentDir>/git/<host>/<path>`; because `<agentDir>` is `~/.pi/agent`, this repo's symlink layout makes the `pi-subagents` cache `.pi-config/agent/git/github.com/nicobailon/pi-subagents` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1732-1747`). Docs state the same git cache path and project-local `.pi/git/<host>/<path>` path (`.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:82`).

On normal startup, `main()` creates services, which creates a resource loader and awaits `resourceLoader.reload()` (`.pi-config/context/pi-mono/packages/coding-agent/src/main.ts:522-543`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/agent-session-services.ts:129-143`). `reload()` calls `packageManager.resolve()` without an `onMissing` callback (`.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:318-321`). In that mode, missing npm/git settings packages call `installParsedSource()` automatically unless `PI_OFFLINE` is set (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1071-1126`). Local paths that do not exist are ignored during resolve (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1138-1156`). Docs summarize this as: project settings can be shared and Pi installs missing packages automatically on startup (`.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:34`).

`pi install` installs then persists the package into settings (`.pi-config/context/pi-mono/packages/coding-agent/src/package-manager-cli.ts:204-205`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:897-921`). `pi list` reads configured packages and reports installed paths without installing missing packages (`.pi-config/context/pi-mono/packages/coding-agent/src/package-manager-cli.ts:220-247`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:869-899`). `pi update` updates configured unpinned packages; pinned npm/git refs are skipped, and missing git update paths call `installGit()` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:949-986`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1601-1604`).

### 4. Runtime vs local extension-development dependencies and setup checks

Runtime use of the checked-in config depends on the Pi CLI, `~/.pi` symlink, `~/.pi/agent` resource paths, `agent/settings.json`, `agent/mcp.json`, configured Pi packages, and external CLIs used by configured extensions/packages. Current `setup.sh` verifies symlink target, `agent/{extensions,skills,agents}`, `agent/settings.json`, and `agent/mcp.json` (`.pi-config/setup.sh:5-41`).

Current `setup.sh` does more than validation: it runs `pi install` for all six configured packages and installs `parallel-cli` via `curl -fsSL https://parallel.ai/install.sh | bash` when missing (`.pi-config/setup.sh:44-68`). `.pi-config/README.md` currently documents that setup installs packages and ensures `parallel-cli` (`.pi-config/README.md:62-70`).

`pi-parallel` runtime needs the external `parallel-cli`; README states the Pi package alone is not enough, gives install alternatives, login/API-key instructions, and the `spawn parallel-cli ENOENT` failure mode (`.pi-config/README.md:72-110`).

Local extension development/LSP support is represented by root `.pi-config/package.json` and `package-lock.json`. `package.json` declares this directory as a `pi-package`, exposes `./agent/extensions` and `./agent/skills`, and depends on `@mariozechner/pi-ai` and `@mariozechner/pi-coding-agent` (`.pi-config/package.json:6-20`). The lockfile pins `@mariozechner/pi-ai` and `@mariozechner/pi-coding-agent` at `0.67.68` and shows the Pi binary entry plus Node engine requirement (`.pi-config/package-lock.json:992-1051`). Pi package docs say core Pi packages imported by extensions/skills should be listed as peer dependencies for distributed packages, but local extension directories may have package dependencies and `node_modules` for imports (`.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:159-163`, `.pi-config/context/pi-mono/packages/coding-agent/docs/extensions.md:146-222`).

### 5. `pi-subagents` discovery and name collision behavior

`pi-subagents` discovers builtin agents from its package `agents/` directory, user agents from `~/.pi/agent/agents` and `~/.agents`, and project agents from nearest `.agents` and `.pi/agents` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:662-704`). The merge order for `agentScope: "both"` is builtin, then user, then project; later `Map.set()` wins on name collisions (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agent-selection.ts:4-20`). Package docs state the same priority: builtin lowest, user/project override same-name builtins (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/README.md:377-387`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/skills/pi-subagents/SKILL.md:49`).

Builtin overrides are read from `subagents.agentOverrides`, and bulk disable from `subagents.disableBuiltins` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:330-355`). Project overrides/bulk disable are applied before user overrides/bulk disable (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:388-413`). The current `.pi-config/agent/settings.json` has no `subagents` block (`.pi-config/agent/settings.json:10-22`).

Current local/package agent name collisions are:

- `researcher`: local `.pi-config/agent/agents/researcher.md` overrides package builtin; local model is `gpt-5.3-codex`, while package builtin model is `openai-codex/gpt-5.5` (`.pi-config/agent/agents/researcher.md:2-6`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/researcher.md:2-11`).
- `reviewer`: local overrides package; local model is `gpt-5.5`, thinking `medium`, tools `read,bash`; package builtin model is `openai-codex/gpt-5.5`, thinking `high`, tools include edit/write (`.pi-config/agent/agents/reviewer.md:2-9`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/reviewer.md:2-11`).
- `scout`: local overrides package; local model is already `openai-codex/gpt-5.5`, while package builtin uses `openai-codex/gpt-5.5` with `thinking: medium` and root `context.md` output (`.pi-config/agent/agents/scout.md:2-5`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/scout.md:2-11`).
- `worker`: local overrides package; local model is `gpt-5.3-codex-spark` with `thinking: minimal`, while package builtin is `openai-codex/gpt-5.3-codex` with `thinking: high` (`.pi-config/agent/agents/worker.md:2-7`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/worker.md:2-10`).

Non-colliding local agents are `codebase-analyzer`, `codebase-locator`, `codebase-pattern-finder`, `thoughts-analyzer`, and `thoughts-locator` (`.pi-config/agent/agents/codebase-analyzer.md:2`, `.pi-config/agent/agents/codebase-locator.md:2`, `.pi-config/agent/agents/codebase-pattern-finder.md:2`, `.pi-config/agent/agents/thoughts-analyzer.md:2`, `.pi-config/agent/agents/thoughts-locator.md:2`). Package builtin agents without local same-name files are `context-builder`, `delegate`, `oracle`, and `planner` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/context-builder.md:2`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/delegate.md:2`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/oracle.md:2`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents/planner.md:2`).

`pi-subagents` reads optional JSON config from `~/.pi/agent/extensions/subagent/config.json`; current local config sets `parallel.maxTasks` and `parallel.concurrency` to 16 (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/index.ts:68-77`, `.pi-config/agent/extensions/subagent/config.json:1-6`). Runtime uses `parallel.maxTasks` to cap top-level parallel tasks and uses per-call concurrency, then config concurrency, then default concurrency (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/subagent-executor.ts:568-628`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/types.ts:510-516`). Docs state config defaults are `maxTasks: 8` and `concurrency: 4` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/README.md:772-801`).

### 6. Existing local resources: active, stale, duplicated, or surprising

Active explicitly configured local extensions are `answer.ts`, `execute-command.ts`, and `tool-hooks/index.ts` (`.pi-config/agent/settings.json:19-22`). `+` entries are force-includes, not an exclusive allowlist; package-manager filtering supports include, exclude, force-include, and force-exclude (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:680-704`). Because Pi also auto-discovers `<agentDir>/extensions`, tracked unlisted direct files under `.pi-config/agent/extensions/` are still candidates for loading unless excluded (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2079`). Current tracked unlisted top-level extension files are `branch.ts`, `cost.ts`, `previous-prompt.ts`, `review.ts`, `todos.ts`, and `watchdog.ts`, verified by `git ls-files -- .pi-config/agent/extensions` and `.pi-config/agent/settings.json:19-22`.

`agent/extensions/subagent/config.json` is untracked but active for `pi-subagents` config loading because the package reads exactly `~/.pi/agent/extensions/subagent/config.json` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/index.ts:68-77`).

Local skills under `.pi-config/agent/skills` are all auto-discoverable despite `"skills": []` being present in settings; settings `skills: []` means no extra configured skill paths, while auto-discovery still includes `<agentDir>/skills` (`.pi-config/agent/settings.json:10`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2079`). Local skill names include `add-mcp-server`, `brainstorm`, `code-simplifier`, `github`, `grill-me`, `learn-codebase`, `manifest-generator`, `pi`, `pi-pr-comments`, `review-rubric`, `session-reader`, `skill-creator`, and `tmux` (`.pi-config/agent/skills/add-mcp-server/SKILL.md:2`, `.pi-config/agent/skills/brainstorm/SKILL.md:2`, `.pi-config/agent/skills/code-simplifier/SKILL.md:2`, `.pi-config/agent/skills/github/SKILL.md:2`, `.pi-config/agent/skills/grill-me/SKILL.md:2`, `.pi-config/agent/skills/learn-codebase/SKILL.md:2`, `.pi-config/agent/skills/manifest-generator/manifest-generator/SKILL.md:2`, `.pi-config/agent/skills/pi/SKILL.md:2`, `.pi-config/agent/skills/pi-pr-comments/SKILL.md:2`, `.pi-config/agent/skills/review-rubric/SKILL.md:2`, `.pi-config/agent/skills/session-reader/SKILL.md:2`, `.pi-config/agent/skills/skill-creator/SKILL.md:2`, `.pi-config/agent/skills/tmux/SKILL.md:2`). Package skill `pi-subagents` is separate (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/skills/pi-subagents/SKILL.md:2`).

The stale tracked `.pi-config/pi-subagents/` copy is deleted in the working tree but still tracked in git; `git ls-files --deleted -- .pi-config` reported 73 deleted files there. The active package cache is instead ignored under `.pi-config/agent/git/github.com/nicobailon/pi-subagents/`, matching Pi's global git package cache path (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1732-1747`).

### 7. Documentation updates implicated by current facts

The current `.pi-config/README.md` says setup installs configured Pi packages and ensures `parallel-cli` (`.pi-config/README.md:62-70`), matching current script behavior (`.pi-config/setup.sh:44-68`) but conflicting with the question-stage constraint that setup should validate and print manual commands only.

The README lists `agent/settings.json` under runtime state (`.pi-config/README.md:39-45`), while git currently tracks `.pi-config/agent/settings.json` and settings package declarations are the source of configured packages (`.pi-config/agent/settings.json:11-22`). `.pi-config/AGENTS.md` has the same runtime-state bullet for `agent/settings.json` (`.pi-config/AGENTS.md:16-20`).

The README describes `agent/git/` as runtime state (`.pi-config/README.md:39-45`) but does not explicitly distinguish tracked package declarations in `agent/settings.json` from ignored package caches in `agent/git/`; Pi docs define package settings and git cache semantics separately (`.pi-config/context/pi-mono/packages/coding-agent/docs/settings.md:168-201`, `.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:82`).

The README describes `parallel-cli` install/auth and failure mode in detail (`.pi-config/README.md:72-110`), but current repo state also has the `pi-subagents` untracked config file affecting parallel limits (`.pi-config/agent/extensions/subagent/config.json:1-6`) and `pi-subagents` docs define that config location and defaults (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/README.md:772-801`).

## Code References

- `.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:187-215` — Pi app/config names and `PI_CODING_AGENT_DIR`/`~/.pi/agent` resolution.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/settings-manager.ts:53-60` — package setting object shape.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/settings-manager.ts:143-148` — global/project settings paths.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:804-853` — package resolution order and settings-local resource path bases.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1071-1126` — missing npm/git package auto-install behavior during resolve.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1700-1747` — npm/git install roots and cache paths.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1974-2093` — auto-discovered resource directories.
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/resource-loader.ts:318-461` — resource reload sequence.
- `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agent-selection.ts:4-20` — builtin/user/project agent merge precedence.
- `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:662-704` — subagent agent discovery directories.
- `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:330-413` — `subagents.agentOverrides` and `disableBuiltins` behavior.
- `.pi-config/agent/git/github.com/nicobailon/pi-subagents/index.ts:68-77` — optional config path `~/.pi/agent/extensions/subagent/config.json`.
- `.pi-config/setup.sh:44-68` — package and `parallel-cli` install behavior currently in setup.
- `.pi-config/agent/settings.json:11-22` — configured packages and explicit local extension force-includes.

## Historical Context

- Question-stage inventory at `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/question/lightweight-inventory.md` already identified stale `.pi-config/pi-subagents/` deletion, package-cache state, local agent collisions, and the untracked `agent/extensions/subagent/config.json`.
- This research verified those points against live git commands, source code, and package docs; no `thoughts/searchable/...` paths were used.

## Surprises

- `agent/settings.json` is tracked and materially configures packages/extensions, but current `.pi-config/README.md` and `.pi-config/AGENTS.md` classify it as runtime state (`.pi-config/README.md:39-45`, `.pi-config/AGENTS.md:16-20`).
- `setup.sh` currently installs packages and downloads `parallel-cli`, although the question-stage decision says setup should be validation-only (`.pi-config/setup.sh:44-68`).
- Settings `extensions` force-includes are not an allowlist; unlisted top-level extension files are still auto-discoverable unless excluded (`.pi-config/agent/settings.json:19-22`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:680-704`, `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2079`).
- The local `worker` agent conflicts with the new human-confirmed model rule: it uses `gpt-5.3-codex-spark` with `thinking: minimal`, not GPT 5.5 with thinking off for fast mode (`.pi-config/agent/agents/worker.md:5-6`).

## Open Questions

- I could not determine from code alone whether the unlisted local extensions `branch.ts`, `cost.ts`, `previous-prompt.ts`, `review.ts`, `todos.ts`, and `watchdog.ts` are intentionally active or merely stale; Pi's auto-discovery makes them active candidates unless excluded (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2079`).
- I could not determine from code alone whether `agent/extensions/subagent/config.json` should be tracked or kept local; it is currently untracked and read by `pi-subagents` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/index.ts:68-77`).
- I could not determine from code alone which local same-name agents should remain full overrides versus become builtin `subagents.agentOverrides`; the mechanism supports both (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/README.md:113-147`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/README.md:407-420`).

## Context Artifacts Written

- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/research/2026-05-01_23-51-51_locator_pi-core-paths-packages.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/research/2026-05-01_23-51-51_locator_config_inventory.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/research/2026-05-01_23-51-51_locator_subagents_collisions.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/research/2026-05-01_23-51-51_analyzer_pi_core_paths_packages.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/research/2026-05-01_23-51-51_analyzer_config_inventory_setup.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/research/2026-05-01_23-51-51_analyzer_subagents_collisions_resources.md`
