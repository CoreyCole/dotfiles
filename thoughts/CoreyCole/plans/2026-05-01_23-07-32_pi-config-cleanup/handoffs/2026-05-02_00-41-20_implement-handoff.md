---
date: 2026-05-02T00:41:20-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: e934577a051977413c45c223c6950295a2eeeeec
branch: main
repository: dotfiles
stage: implement
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
status: in_progress
next_stage:
---

# Implement Handoff

## Status

Slice 2 is complete and committed in `e934577a051977413c45c223c6950295a2eeeeec`.

Completed:

- Rewrote `.pi-config/setup.sh` as validation/reporting only.
- Removed setup-time `pi install`, external installer, and auto-install behavior.
- Kept symlink validation and required `agent/{extensions,skills,agents,settings.json,mcp.json}` checks.
- Added non-mutating checks for `pi` and `parallel-cli` availability.
- Confirmed `.pi-config/README.md` already says setup validates and prints manual guidance only.
- Updated Slice 2 in `plan.md` as checked.
- Adjusted the Slice 2 script text in `plan.md` so installer command literals stay out of `setup.sh`; detailed manual install commands remain in `.pi-config/README.md`.

Remaining:

- Slice 3: subagent name deconfliction and model normalization.
- Slices 4-5 remain unchecked in `plan.md`.

## Learnings

- This repo still works directly on `main`; no Graphite branch was created because root `AGENTS.md` and `plan.md` say this dotfiles repo does not use branches.
- `.pi-config/agent/agents/scout.md` still has a pre-existing unstaged modification and was intentionally not included in the Slice 2 commit.
- The original Slice 2 script block in `plan.md` included installer command literals inside `echo` statements, but the Slice 2 verification command rejects those strings anywhere in `.pi-config/setup.sh`. The implemented script points to `.pi-config/README.md` for exact manual install/auth commands instead.

## User Decisions

- Setup must validate and report only; no install side effects.
- Preserve the active Pi layout: `~/.pi -> ~/dotfiles/.pi-config` with resources under `.pi-config/agent/`.
- Keep manual external dependency guidance in documentation rather than executing installers from setup.

## Context Artifacts

- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/plan.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/research/2026-05-02_00-03-19_pi-config-cleanup.md`

## Next

Resume implementation from this handoff and execute only Slice 3. Rename the four local colliding agent files, update their frontmatter, add the minimal `subagents.agentOverrides.worker.model` block to `.pi-config/agent/settings.json`, run the Slice 3 verify commands, update the Slice 3 checkbox, commit, then create the next implement handoff.
