---
date: 2026-04-25T18:10:37-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 0519948ddddd0ef0e322af8aa3055107e29650e6
branch: main
repository: dotfiles
stage: implement
ticket: "Plan Pi extensions for tool hooks and automatic AGENTS.md reads"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read"
status: in_progress
next_stage: null
---

# Implement Handoff

## Status
Slice 1 is complete and committed in `0519948ddddd0ef0e322af8aa3055107e29650e6` (`Add tool hook config normalization`). The plan checkbox for Slice 1 is marked complete in `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/plan.md`.

Implemented files:
- `.pi-config/extensions/tool-hooks/types.ts`
- `.pi-config/extensions/tool-hooks/config.ts`
- `.pi-config/extensions/tool-hooks/matchers.ts`
- `.pi-config/config/tool-hooks.json`

Remaining unchecked slices:
- Slice 2: Wire hook runtime dispatch across Pi lifecycle events
- Slice 3: Add safe pre/post hook mutation behavior and Claude-compatible env support
- Slice 4: Build auto-agents path discovery, hashing, and persisted session state
- Slice 5: Replace `read` with the delegating auto-agents wrapper
- Slice 6: Wire tracked config, reload Pi, and run end-to-end smoke verification

## Learnings
- Slice 1 kept the config file Claude-shaped and normalized the grouped hook config into `NormalizedHookRule[]` at load time.
- `timeout` is treated as seconds in config and normalized to milliseconds in `.pi-config/extensions/tool-hooks/config.ts`.
- Matchers currently support exact Claude-style tool-name matching (`Bash`, `Read`, etc.) and regex matching against `tool_input.path`, `tool_input.file_path`, or `tool_input.command` in `.pi-config/extensions/tool-hooks/matchers.ts`.
- No durable plan memory update was needed beyond the existing `AGENTS.md` decisions.

## User Decisions
No new user decisions were made during this slice.

## Context Artifacts
Load these first when resuming implementation:
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/plan.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/research/2026-04-25_13-21-46_pi-extension-hooks-and-auto-agents-read.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/context/research/2026-04-25_13-08-30_analyzer_tool-lifecycle.md`

## Next
Resume with Slice 2 only. Read the current `tool-hooks` files before editing, then add runtime dispatch files (`index.ts`, `payload.ts`, `process.ts`, `runner.ts`) according to `plan.md`. Verify the slice before updating the Slice 2 checkbox and committing.

Verification already passed for Slice 1:
- `python - <<'PY' ... PY` fixture check: `tool-hooks config fixture looks valid`
- `python -m json.tool .pi-config/config/tool-hooks.json >/dev/null && echo 'tool-hooks.json ok'`
- `npx --yes tsx /tmp/tool-hooks-slice1-smoke.ts`: `tool-hooks matcher smoke ok`

Handoff sync note:
- `just sync-thoughts` was attempted from `/Users/coreycole/dotfiles` and failed because no `justfile` exists in this repository.
