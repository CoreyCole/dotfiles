---
date: 2026-04-25T20:03:44-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: af1a5b4c4b44e997d551b126a4b7cdbcf3282e35
branch: main
repository: dotfiles
stage: question
ticket: "implementation-review follow-up"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups"
question_doc: "thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/questions/2026-04-25_20-03-36_tool-hooks-config-path.md"
prev_question_docs: []
---

# Research Questions: tool-hooks config path follow-up

## Brainstorm Summary
- Desired outcome: understand the facts needed to fix the implementation-review P1 where `tool-hooks` fails to load its JSON config when Pi loads the extension through the tracked `agent/extensions -> ../extensions` symlink layout.
- Scope is intentionally narrow: focus on `tool-hooks` config path resolution, Pi extension loading paths, and verification that fresh Pi/subagent startup can load the global extensions.
- Preserve the dotfiles layout constraint that tracked source lives under `.pi-config/` while Pi runtime discovery happens under `.pi-config/agent/` through symlinks.
- Defer broader hook-extension hardening unless research shows it is directly required to explain or verify the load failure.

## Context
The implementation review found that `tool-hooks` computes `../../config/tool-hooks.json` from `import.meta.url`, which can point at the symlinked runtime path under `~/.pi/agent/extensions`. Research should establish the exact current paths, loader behavior, and verification entry points before design.

## Questions
1. How does `tool-hooks` currently derive and use its config path, and which on-disk paths exist for the extension, runtime symlink, and config file?
2. How does Pi discover and load global/settings extensions from `~/.pi/agent/extensions` and `settings.json`, especially for symlinked paths and `+extensions/...` entries?
3. What existing patterns in this repo or `context/pi-mono` show how extensions or supporting resources handle symlinked install paths, real paths, or colocated config files?
4. What verification commands or smoke tests can factually demonstrate that `tool-hooks` loads its config and that fresh Pi/subagent startup no longer fails on extension load?

## Codebase References
- `.pi-config/extensions/tool-hooks/index.ts` — config path derivation and extension registration.
- `.pi-config/extensions/tool-hooks/config.ts` — config file loading and validation.
- `.pi-config/config/tool-hooks.json` — tracked config file that should be loaded.
- `.pi-config/agent/settings.json` — configured extension loading order and `+extensions/...` entries.
- `.pi-config/README.md` and `.pi-config/AGENTS.md` — documented tracked/runtime symlink layout.
- `context/pi-mono/packages/coding-agent/docs/extensions.md` — Pi extension discovery documentation.
- `context/pi-mono/packages/coding-agent/src/core/extensions/loader.ts` — extension loader implementation.
