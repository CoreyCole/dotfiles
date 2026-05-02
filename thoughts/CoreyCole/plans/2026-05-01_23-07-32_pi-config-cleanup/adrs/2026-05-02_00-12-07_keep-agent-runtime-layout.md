---
date: 2026-05-02T00:12:07-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: design
artifact: adr
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
related_artifact: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md
---

# ADR: Keep Agent Runtime Layout

## Status

Accepted

## Context

The repo symlinks `~/.pi` to `~/dotfiles/.pi-config`, and Pi resolves the global agent directory as `~/.pi/agent` unless `PI_CODING_AGENT_DIR` overrides it.
That means tracked resources and ignored runtime state naturally coexist below `.pi-config/agent/`.
The current docs mostly describe this shape, but they incorrectly classify `agent/settings.json` as runtime state even though it is tracked and declares package/resource configuration.

## Decision Drivers

- Pi auto-discovers global resources under the agent directory, including `extensions`, `skills`, `prompts`, and `themes`.
- Global git package caches are generated under `agent/git/`.
- `agent/settings.json` is portable source config because it declares configured packages and local extension includes.
- Adding another symlink or mirror layer would make the layout harder to reason about without changing Pi behavior.

## Decision

Keep `.pi-config/agent/` as the canonical runtime-shaped config root.
Document `agent/settings.json`, `agent/mcp.json`, local agents, local skills, local extensions, scripts, and intentional package config files as tracked source config.
Document `agent/auth.json`, `agent/sessions/`, `agent/run-history.jsonl`, `agent/git/`, `history/`, `context/`, and `node_modules/` as ignored runtime/cache/local state.
Track `agent/extensions/subagent/config.json` because it is intentional `pi-subagents` configuration.
Remove stale checked-in package-cache remnants such as `.pi-config/pi-subagents/`.

## Alternatives Considered

### Alternative A: Move tracked resources outside `agent/`

**Status:** Rejected

This would make the repo look cleaner but would fight Pi's actual global discovery paths.
It would require extra symlinks or settings paths and create another layer future maintainers would have to remember.

### Alternative B: Treat all of `agent/` as runtime state

**Status:** Rejected

This contradicts how the dotfiles repo is used.
`agent/settings.json`, local resources, and MCP config are the source of truth for the desired global Pi environment.

### Alternative C: Track package caches

**Status:** Rejected

Package caches under `agent/git/` are generated from `agent/settings.json` and can be reinstalled or refreshed.
Tracking them creates stale duplicated source copies and obscures which package version Pi is actually loading.

## Consequences

- The repo keeps matching Pi's runtime model directly.
- Documentation must be precise about source config versus runtime state under the same `agent/` directory.
- Generated package code remains ignored and reproducible from settings rather than reviewed as source.
