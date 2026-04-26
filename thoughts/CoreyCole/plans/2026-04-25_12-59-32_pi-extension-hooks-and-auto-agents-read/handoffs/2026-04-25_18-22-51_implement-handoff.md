---
date: 2026-04-25T18:22:51-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 554ec506ba916dfbf484984bb5c4242ce2895d63
branch: main
repository: dotfiles
stage: implement
ticket: Plan Pi extensions for tool hooks and automatic AGENTS.md reads
plan_dir: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read
status: in_progress
next_stage:
---

# Implement Handoff

## Status

This is a fresh checkpoint after the Slice 3 handoff was synced. Slice 3 remains complete and committed in `369131996360afdafe020c710e22d1f983e454c7` (`Add safe tool hook mutation and env bridge`). The prior handoff is `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/handoffs/2026-04-25_18-22-05_implement-handoff.md`, and the current repository HEAD is `554ec506ba916dfbf484984bb5c4242ce2895d63` from syncing that handoff.

The plan checkbox for Slice 3 is marked complete in `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/plan.md`.

Implemented files from Slice 3:

- `.pi-config/extensions/tool-hooks/index.ts`
- `.pi-config/extensions/tool-hooks/process.ts`
- `.pi-config/extensions/tool-hooks/runner.ts`
- `.pi-config/extensions/tool-hooks/types.ts`

Remaining unchecked slices:

- Slice 4: Build auto-agents path discovery, hashing, and persisted session state
- Slice 5: Replace `read` with the delegating auto-agents wrapper
- Slice 6: Wire tracked config, reload Pi, and run end-to-end smoke verification

## Learnings

- No new implementation work occurred after the previous Slice 3 checkpoint.
- Carry forward the Slice 3 learnings from `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/handoffs/2026-04-25_18-22-05_implement-handoff.md`: per-session `CLAUDE_ENV_FILE`, bash env-file sourcing, safe malformed-JSON handling, shallow input patch filtering, and Pi-supported result patch filtering are implemented.
- There are unrelated working-tree changes outside this plan visible in `git status`; do not include or revert them while continuing this plan unless the user explicitly asks.

## User Decisions

No new user decisions were made after the previous checkpoint.

## Context Artifacts

Load these first when resuming implementation:

- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/plan.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/research/2026-04-25_13-21-46_pi-extension-hooks-and-auto-agents-read.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/context/research/2026-04-25_13-08-30_analyzer_tool-lifecycle.md`
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/handoffs/2026-04-25_18-22-05_implement-handoff.md`

## Next

Resume with Slice 4 only. Build the `auto-agents` path discovery, hashing, and persisted session state modules according to `plan.md`. Verify the slice before updating the Slice 4 checkbox and committing.

Verification already passed for Slice 3:

- `npx --yes tsx /tmp/tool-hooks-slice3-smoke.ts`: `tool-hooks slice3 process/env smoke ok`
- `npx --yes tsx /tmp/tool-hooks-slice3-runner-smoke.ts`: `tool-hooks slice3 runner filtering smoke ok`
- env-file directory check confirmed `pi-tool-hooks-*` directories are created under this macOS `os.tmpdir()` path.
