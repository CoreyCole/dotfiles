---
date: 2026-04-25T16:14:45-07:00
reviewer: OpenAI Codex
git_commit: d0dbb0f2257b6def9ab813a2834ddf53a883613a
branch: main
repository: dotfiles
plan_dir: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read
review_mode: outline
reviewed_artifact: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md
design_reviewed: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md
status: complete
type: outline_review
verdict: correct
---

# Outline Review: pi-extension-hooks-and-auto-agents-read

### Summary
The design/outline pair is now aligned with the approved Chestnut Flake compatibility goals and Pi runtime constraints. I updated the docs to make the Claude-compatible hook stdin/env contract explicit, to call out the bash env-file bridge needed for `CLAUDE_ENV_FILE`, and to make the wrapped `read` visibility contract explicit for auto-loaded `AGENTS.md` files.

### Findings Summary
- The work looks good after the doc edits below.

### Findings
The work looks good.

### Questions / Decisions Needed
None.

### Applied Edits
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md` — clarified that hook subprocesses must preserve Claude-compatible top-level stdin keys, inherit `CLAUDE_ENV_FILE`, bridge that env file into later bash executions, and visibly label auto-loaded `AGENTS.md` paths in the wrapped read output.
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md` — changed the hook payload shape to a Claude-compatible top-level contract with Pi metadata nested under `pi`, added the `CLAUDE_ENV_FILE`/bash runtime bridge requirement, and made auto-agents path visibility explicit in Slice 5 checkpoints.
- `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md` — recorded the durable review learning about Claude-compatible stdin keys plus the bash env-file bridge.

### Follow-up Plan Dir
None.

### Follow-up Context Review
None.

### What's Good
- The two-extension split remains the right boundary and keeps hook orchestration independent from read-specific AGENTS loading.
- The outline now matches the compatibility-first design: existing Chestnut Flake hooks can keep consuming `cwd`, `tool_name`, `tool_input`, Claude-style block responses, and `CLAUDE_ENV_FILE` semantics.
- The auto-agents slice now makes user-visible surfacing part of the contract instead of leaving it implicit in delegated inner reads.
- Exact-path hash dedupe and session-entry restoration are still well grounded in Pi’s existing state model.

### Verification
- Ran `~/dotfiles/spec_metadata.sh` to capture timestamp, commit, branch, and repository metadata for the review artifact.
- Read `thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md`, `design.md`, `outline.md`, `questions/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read.md`, and `research/2026-04-25_13-21-46_pi-extension-hooks-and-auto-agents-read.md`.
- Read `context/pi-mono/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts`, `context/pi-mono/packages/coding-agent/src/core/extensions/types.ts`, `context/pi-mono/packages/coding-agent/src/core/extensions/runner.ts`, `context/pi-mono/packages/coding-agent/src/core/tools/read.ts`, `context/pi-mono/packages/coding-agent/src/core/resource-loader.ts`, `context/pi-mono/packages/coding-agent/src/core/session-manager.ts`, and `context/pi-mono/packages/coding-agent/src/core/agent-session.ts` to verify the relevant Pi seams.
- Read `/Users/coreycole/cn/chestnut-flake/.claude/settings.json`, `/Users/coreycole/cn/chestnut-flake/.claude/hooks/AGENTS.md`, `/Users/coreycole/cn/chestnut-flake/.agents/hooks/pkg/claudejson/claudejson.go`, and `/Users/coreycole/cn/chestnut-flake/.agents/hooks/pkg/claudejson/init.go` to verify the live Chestnut Flake contract the hook adapter must preserve.
- Ran `git diff -- thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/outline.md thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/AGENTS.md` to confirm the applied review edits.

### Recommended Next Steps
The outline is ready for the next stage.
