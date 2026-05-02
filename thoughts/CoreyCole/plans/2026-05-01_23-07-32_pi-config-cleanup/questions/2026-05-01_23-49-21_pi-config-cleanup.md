---
date: 2026-05-01T23:49:21-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: question
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
question_doc: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/questions/2026-05-01_23-49-21_pi-config-cleanup.md
prev_question_docs: []
---

# Research Questions: Pi Config Cleanup and Organization

## Brainstorm Summary

- Desired outcome: make `~/dotfiles/.pi-config` clean, portable, and unsurprising to symlink as `~/.pi` on new machines.
- Tracked config and ignored runtime state may coexist under `.pi-config`; the boundary must be explicit and documented.
- `setup.sh` should not install Pi packages, npm packages, or external dependencies; it should validate the layout and report missing dependencies with manual commands.
- Root `.pi-config/package.json` and `package-lock.json` should stay because they support TypeScript/LSP for local extension development, not because setup should run npm install.
- Local agent names should not collide with package-provided `nicobailon/pi-subagents` agents. The local pi-parallel researcher should be renamed to `web-researcher`; unused/stale local collisions should be identified.
- QRSPI skills are intentionally retained as `q-*` skills and are not part of the local-agent collision problem.

## Context

`.pi-config` is both the tracked dotfiles source of truth and the symlink target for Pi's global config root. Research should establish the actual Pi loading/cache behavior, the current tracked/ignored state, and the minimum cleanup/documentation changes needed before design.

## Questions

1. What are Pi's actual global config, runtime, and resource discovery paths for settings, extensions, skills, agents, prompts, themes, sessions, auth, and package caches, especially when `~/.pi` is a symlink to `.pi-config`?
1. What files and directories under `.pi-config` are currently tracked, ignored, untracked, or deleted, and which entries are portable source config versus generated runtime/cache/secret state?
1. How do Pi package declarations in `agent/settings.json` relate to installed package caches under `agent/git/`, and what does Pi do on startup or `pi install/list/update` when configured packages are missing?
1. Which local dependencies are required for runtime use versus local extension development/LSP support, and what should a non-installing `setup.sh` check and print on a fresh machine?
1. How does `nicobailon/pi-subagents` discover agent definitions and resolve name collisions between package-provided agents and local `.pi-config/agent/agents/*.md` files?
1. Which existing local agents, skills, extensions, scripts, docs, and package configs are still actively useful, stale, duplicated, or surprising in the current `.pi-config` layout?
1. What documentation updates are needed so future readers can distinguish tracked package configuration from ignored package caches, intentional local resources from third-party packages, and setup validation from installation?

## Codebase References

- `.pi-config/README.md` — current layout, setup, and package-cache documentation.
- `.pi-config/setup.sh` — current setup behavior that installs Pi packages and `parallel-cli`.
- `.pi-config/.gitignore` and `.gitignore` — current tracked/ignored boundary for runtime state and caches.
- `.pi-config/agent/settings.json` — configured Pi packages and explicit local extension loads.
- `.pi-config/package.json` and `.pi-config/package-lock.json` — root npm metadata kept for extension TypeScript/LSP support.
- `.pi-config/agent/agents/` — local agent definitions, including possible name collisions.
- `.pi-config/agent/extensions/subagent/config.json` — currently untracked local config for `nicobailon/pi-subagents` parallel limits.
- `.pi-config/agent/git/github.com/nicobailon/pi-subagents/` — ignored runtime package cache containing package-provided agents and code.
- `.pi-config/context/pi-mono/packages/coding-agent/README.md` — local source-of-truth docs for Pi paths and package behavior.
- `.pi-config/context/pi-mono/packages/coding-agent/docs/settings.md` — settings precedence and path-resolution behavior.
- `.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md` — package install/cache semantics and package configuration behavior.
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/context/question/lightweight-inventory.md` — question-stage inventory already gathered.
