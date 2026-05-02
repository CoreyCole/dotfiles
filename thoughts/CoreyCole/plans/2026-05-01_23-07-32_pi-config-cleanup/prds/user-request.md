---
date: 2026-05-01T23:07:32-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: question
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
---

# User request

Plan a cleanup and organization pass for `~/dotfiles/.pi-config`.

Goal: make `.pi-config` clean, portable, and easy to symlink as `~/.pi` on new machines.

Current known facts:

- `~/.pi` is intended to symlink to `~/dotfiles/.pi-config`.
- Pi’s global runtime/config root is `~/.pi/agent`, so `.pi-config/agent/` is currently the real Pi config directory.
- `.pi-config/agent/settings.json` loads packages, including `git:github.com/nicobailon/pi-subagents`.
- Runtime package caches live under `.pi-config/agent/git/` and are ignored.
- We removed the stale tracked `.pi-config/pi-subagents` copy because active code comes from `.pi-config/agent/git/github.com/nicobailon/pi-subagents`.
- We configured `nicobailon/pi-subagents` with `.pi-config/agent/extensions/subagent/config.json`:
  `{ "parallel": { "maxTasks": 16, "concurrency": 16 } }`
- `HazAT/pi-parallel` is intentional and separate; it supports Parallel.ai web/search tooling.
- `HazAT/pi-subagents` was stale and removed.
- `.pi-config/git` and unused `pi-cmux` cache were removed.
- Local agents in `.pi-config/agent/agents` may override pi-subagents builtins; review whether that is intentional.
- Root `.pi-config/package.json`/`package-lock.json` may be for local extension dev dependencies; decide whether to keep, document, or remove.
- Need decide whether `setup.sh` should install npm deps or explicitly avoid them.

Focus:

1. Whether the `agent/` split is necessary and should remain.
1. What should be tracked vs ignored.
1. What `setup.sh` should do on a fresh machine.
1. How to document package config vs package caches.
1. Whether local agent overrides should stay.
1. Any cleanup needed to make the repo portable and unsurprising.
