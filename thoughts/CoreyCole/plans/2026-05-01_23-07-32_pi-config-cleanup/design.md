---
date: 2026-05-02T00:12:07-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: design
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
---

# Design: Pi Config Cleanup and Organization

## Executive Summary

Clean up `.pi-config` by embracing the current symlinked runtime layout instead of hiding it: `~/.pi` points at `~/dotfiles/.pi-config`, and Pi's real global directory is therefore `.pi-config/agent/`.
The implementation should make the tracked-source versus runtime-cache boundary explicit, make `setup.sh` validation-only, remove stale tracked package-cache artifacts, and eliminate local agent-name collisions with `nicobailon/pi-subagents` builtins.
The main risk is accidentally changing active Pi behavior while making the directory look cleaner; the mitigation is to keep canonical runtime paths unchanged, document the cache/config distinction, and use unique local agent names plus builtin `subagents.agentOverrides` for normal builtin tweaks.

## Current State

`.pi-config` is intentionally the target of the live global Pi symlink: `.pi-config/README.md:9-11` says the live layout is `~/.pi -> ~/dotfiles/.pi-config`.
Within that symlink target, Pi resolves its global agent directory to `~/.pi/agent`; the local Pi source confirms `getAgentDir()` returns `join(homedir(), CONFIG_DIR_NAME, "agent")` when `PI_CODING_AGENT_DIR` is not set (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:207-215`).
Core Pi runtime/config files also derive from that agent directory: `settings.json`, `auth.json`, `prompts`, `themes`, and `sessions` are all joined under `getAgentDir()` (`.pi-config/context/pi-mono/packages/coding-agent/src/config.ts:220-255`).

The tracked repo already mostly follows that runtime shape.
`.pi-config/README.md:33-36` lists `agent/extensions/`, `agent/skills/`, `agent/agents/`, and `agent/mcp.json` as tracked resources.
The same README also lists `agent/settings.json` under runtime state at `.pi-config/README.md:41`, while research verified `agent/settings.json` is tracked and materially declares packages and explicit extension includes.
`.pi-config/AGENTS.md:17` repeats the same misleading runtime classification for `agent/settings.json`.

Package declarations and package caches are currently easy to confuse.
`.pi-config/agent/settings.json:11-17` declares six packages, including `git:github.com/nicobailon/pi-subagents` and `git:github.com/HazAT/pi-parallel`.
Pi installs global git packages under the agent directory at `agentDir/git/<host>/<path>` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1732-1749`).
With the symlinked layout, that makes `.pi-config/agent/git/` an ignored runtime cache, not source config.

The current setup script performs side effects that conflict with the desired portable-validation role.
It validates required files and directories at `.pi-config/setup.sh:25-41`, but then installs all configured packages at `.pi-config/setup.sh:43-54`.
It also installs `parallel-cli` by piping Parallel's installer through `curl | bash` when the binary is absent (`.pi-config/setup.sh:57-68`).
The README currently documents those install side effects at `.pi-config/README.md:62-70`.

Pi itself already knows how to resolve configured packages.
During resource resolution, missing npm/git packages are installed automatically when not in offline mode and no `onMissing` callback is provided (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1088-1121`).
`pi list` can still be used for visibility without forcing installation, according to the research artifact.
That means setup does not need to duplicate `pi install` for package caches.

Local resources have a few active surprises.
`agent/extensions/subagent/config.json` is currently untracked, but `pi-subagents` reads that exact path from `~/.pi/agent/extensions/subagent/config.json` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/index.ts:69-72`).
The local file sets parallel limits to 16 (`.pi-config/agent/extensions/subagent/config.json:1-6`), so it is intentional portable configuration rather than throwaway runtime state.

Local subagent definitions currently collide with package-provided builtins.
`pi-subagents` merges builtin, user, then project agents; later `Map.set()` calls win (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agent-selection.ts:11-22`).
The package discovers user agents from `~/.pi/agent/agents` and `~/.agents` (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:680-701`).
Because `.pi-config/agent/agents/` is the user-agent directory, local `researcher`, `reviewer`, `scout`, and `worker` override package builtins of the same names.

Some local agent defaults are stale relative to the clarified model rule.
Global defaults already use GPT 5.5 (`.pi-config/agent/settings.json:6-8`).
Several fast local codebase agents use `model: gpt-5.5:off` (`.pi-config/agent/agents/codebase-locator.md:5`, `.pi-config/agent/agents/codebase-analyzer.md:5`).
But local `researcher` uses `gpt-5.3-codex` (`.pi-config/agent/agents/researcher.md:5`), and local `worker` uses `gpt-5.3-codex-spark` with `thinking: minimal` (`.pi-config/agent/agents/worker.md:5-6`).

The root `.pi-config/package.json` is a development aid, not runtime bootstrap.
It declares the directory as a Pi package exposing `./agent/extensions` and `./agent/skills` (`.pi-config/package.json:6-14`).
It also pins Pi TypeScript dependencies used by local extension development/LSP support (`.pi-config/package.json:18-21`).
It should stay, but setup should not run `npm install` automatically.

## Desired End State

A fresh machine setup is unsurprising:

1. Clone `~/dotfiles`.
1. Symlink `~/.pi` to `~/dotfiles/.pi-config`.
1. Run `.pi-config/setup.sh`.
1. Read clear validation output and manual instructions for missing tools or auth.
1. Start Pi; Pi resolves configured packages into ignored caches as needed.

The repository should communicate three separate categories clearly:

- **Tracked source config:** files that define the desired Pi environment and should travel with dotfiles.
- **Ignored runtime state:** auth, sessions, run history, generated caches, and local node dependencies.
- **Optional local development dependencies:** `node_modules` for editing TypeScript extensions with good LSP support.

The active Pi runtime shape should stay unchanged:

```text
~/.pi -> ~/dotfiles/.pi-config
~/.pi/agent -> ~/dotfiles/.pi-config/agent
```

No extra resource symlink layer should be introduced.
Pi already discovers global resources under `~/.pi/agent/extensions`, `~/.pi/agent/skills`, and related directories (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2082`).

Local subagent names should be explicit and non-colliding.
Package builtins should keep their standard names: `researcher`, `reviewer`, `scout`, and `worker`.
Personal variants should get personal-purpose names, for example `web-researcher`, `rubric-reviewer`, `qrspi-scout`, and `todo-worker`.
Normal builtin field tweaks should live in `agent/settings.json` under `subagents.agentOverrides`, not as full copied agent files.

## Patterns to Follow

- Keep resources directly under `agent/` because Pi's global auto-discovery reads the agent-dir resource folders (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:2007-2082`).
- Keep `agent/settings.json` tracked because it declares package sources and extension includes (`.pi-config/agent/settings.json:11-22`).
- Keep ignored package caches under `agent/git/` because Pi installs global git packages under `agentDir/git/<host>/<path>` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1732-1749`).
- Keep setup's existing symlink and required-resource validation style (`.pi-config/setup.sh:5-41`).
- Keep root `package.json` as local extension-development metadata because it exposes `./agent/extensions` and `./agent/skills` and pins Pi dependencies (`.pi-config/package.json:6-21`).
- Prefer package builtin agent names for generic delegation because `pi-subagents` intentionally ships those names and documents them as the default interface.
- Prefer GPT 5.5 local/default model settings; use `gpt-5.5:off` only for deliberately fast local agents, matching existing local codebase-agent frontmatter (`.pi-config/agent/agents/codebase-locator.md:5`).

## Patterns to Avoid

- Do not move tracked resources out of `agent/` into `~/.pi/extensions`-style paths; `.pi-config/README.md:52-55` already warns that `~/.pi/extensions/` is not the global discovery path.
- Do not classify `agent/settings.json` as runtime state; that contradicts the tracked package declarations in `.pi-config/agent/settings.json:11-22`.
- Do not keep old checked-in package-cache copies such as `.pi-config/pi-subagents/`; active package code belongs in ignored `agent/git/` caches.
- Do not let setup mutate the machine by default through `pi install` or `curl | bash`; current side effects are at `.pi-config/setup.sh:43-68`.
- Do not copy package builtin agents merely to change a model or thinking level; `pi-subagents` supports builtin overrides in settings (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:347-355`, `.pi-config/agent/git/github.com/nicobailon/pi-subagents/agents.ts:398-414`).
- Do not leave local same-name agents overriding package builtins by accident; merge precedence makes those overrides active (`.pi-config/agent/git/github.com/nicobailon/pi-subagents/agent-selection.ts:11-22`).

## Recommended Approach

Treat `.pi-config/agent/` as the canonical source-and-runtime boundary and clean up around that fact.
The desired implementation is mostly reclassification, documentation, and naming cleanup rather than a layout migration.

First, update docs and ignore rules.
Move `agent/settings.json` from the README/AGENTS runtime-state bucket into tracked source config.
Add `agent/extensions/subagent/config.json` to tracked source config because it is an intentional `pi-subagents` runtime configuration file.
Keep `agent/auth.json`, `agent/sessions/`, `agent/run-history.jsonl`, `agent/git/`, `history/`, `context/`, and `node_modules/` documented as ignored runtime/local state.
Remove stale references to `.pi-config/pi-subagents/` from ignore/docs once the deleted tracked files are committed as removed.

Second, rewrite `setup.sh` into a validation/reporting script.
It should preserve the current symlink-target check and required `agent/*` path checks.
It should also check for the `pi` binary and `parallel-cli` binary without installing them.
When something is missing, it should print the manual command and explain whether the missing item is required for Pi startup, package resolution, or only `pi-parallel` tools.
Package installation guidance should point at `agent/settings.json`, `pi list`, and optional manual `pi install ...`; it should not eagerly install every configured package.

Representative setup shape:

```bash
if ! command -v pi >/dev/null 2>&1; then
  echo "pi not found; install Pi before using this config"
fi

if ! command -v parallel-cli >/dev/null 2>&1; then
  echo "parallel-cli not found; install manually for pi-parallel:"
  echo "  curl -fsSL https://parallel.ai/install.sh | bash"
fi
```

Third, normalize subagent configuration.
Keep package builtins available under their package names by removing local collisions.
Rename local custom agents to purpose-specific names:

- `researcher` -> `web-researcher` for Parallel.ai-backed web intelligence.
- `reviewer` -> `rubric-reviewer` for read-only review using the local `review-rubric` skill.
- `scout` -> `qrspi-scout` for QRSPI-aware context artifact scouting.
- `worker` -> `todo-worker` for todo/commit-oriented ad hoc implementation.

Then use `agent/settings.json` for builtin tweaks, especially the durable GPT 5.5 model rule.
Only add overrides for fields that actually need to diverge from package defaults; do not duplicate full prompts.
For local renamed agents, update their frontmatter to GPT 5.5 as well, using `gpt-5.5:off` only where fast/no-thinking behavior is intentional.

Representative settings shape:

```json
{
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.5",
  "defaultThinkingLevel": "high",
  "subagents": {
    "agentOverrides": {
      "worker": {
        "model": "openai-codex/gpt-5.5"
      }
    }
  }
}
```

Fourth, keep root npm metadata but document it narrowly.
`package.json` and `package-lock.json` are for local extension development/LSP support.
They are not required for normal Pi startup, and setup should not install `node_modules`.
The README should include an optional development section such as `cd ~/.pi && npm install` for editing local TypeScript extensions.

Fifth, verify the cleanup with read-only and syntax checks.
Use git status to ensure stale `.pi-config/pi-subagents/` tracked files are deleted, runtime caches remain ignored, and intended config files are tracked.
Use JSON parsing for `agent/settings.json`, `agent/mcp.json`, `agent/extensions/subagent/config.json`, and `package.json`.
Run the validation-only `setup.sh` after editing to prove it no longer installs dependencies.

## Decision

Going with this approach because it changes the misleading parts of the repo without fighting Pi's actual runtime model.
The active layout is already correct for Pi; the problem is stale documentation, side-effectful setup, an untracked intentional config file, stale tracked cache remnants, and accidental agent-name overrides.
Cleaning those seams makes the repo portable while preserving the same global Pi discovery paths and package-manager behavior.

## Resolved Decisions

- Keep `.pi-config/agent/` as the canonical tracked-resource and runtime boundary; classify `agent/settings.json` as tracked source config and `agent/git/` as ignored package cache. See [`adrs/2026-05-02_00-12-07_keep-agent-runtime-layout.md`](adrs/2026-05-02_00-12-07_keep-agent-runtime-layout.md).
- Make `setup.sh` validation/reporting only; do not install Pi packages, npm dependencies, or `parallel-cli`. See [`adrs/2026-05-02_00-12-07_validation-only-setup.md`](adrs/2026-05-02_00-12-07_validation-only-setup.md).
- Eliminate local `pi-subagents` builtin name collisions; use unique names for personal variants and `subagents.agentOverrides` for normal builtin tweaks. See [`adrs/2026-05-02_00-12-07_deconflict-subagent-names.md`](adrs/2026-05-02_00-12-07_deconflict-subagent-names.md).

## Open Questions

- None blocking. Human review should confirm the exact renamed local-agent labels before `/q-outline` turns them into file operations.
