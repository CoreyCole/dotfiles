---
date: 2026-04-25T19:18:43-07:00
reviewer: CoreyCole
git_commit: e8923eedd6d3375d47e2ec8a1a22f82692314f30
branch: main
repository: dotfiles
plan_dir: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read
review_mode: implementation
reviewed_artifact: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/handoffs/2026-04-25_18-49-17_implement-handoff.md
design_reviewed: thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md
status: complete
type: implementation_review
verdict: needs_attention
---

# Implementation Review: pi-extension-hooks-and-auto-agents-read

### Summary

The implementation is close in structure, but the committed `tool-hooks` extension currently fails to load from Pi's configured runtime path. Because `.pi-config/agent/settings.json` loads `+extensions/tool-hooks/index.ts` through the `agent/extensions -> ../extensions` symlink, `import.meta.url` can be the symlinked `~/.pi/agent/extensions/tool-hooks/index.ts` path. The extension then resolves `../../config/tool-hooks.json` to `~/.pi/agent/config/tool-hooks.json`, which does not exist. This blocks fresh Pi extension loading, including reviewer subagents in this session.

### Findings Summary

- [P1] `tool-hooks` resolves its config relative to the symlinked `agent/extensions` path and fails extension startup.

### Findings

1. [P1] `tool-hooks` cannot load from the configured runtime path — `.pi-config/extensions/tool-hooks/index.ts:9`
   - Evidence: the extension computes `CONFIG_PATH` with `path.resolve(EXTENSION_DIR, "../../config/tool-hooks.json")`, where `EXTENSION_DIR` comes from `fileURLToPath(import.meta.url)`. The configured settings path is `+extensions/tool-hooks/index.ts` under `.pi-config/agent/settings.json:15-19`, and `agent/extensions` is a symlink. A fresh focused-review subagent run failed before execution with: `Failed to load extension "/Users/coreycole/.pi/agent/extensions/tool-hooks/index.ts": Failed to load extension: ENOENT: no such file or directory, open '/Users/coreycole/.pi/agent/config/tool-hooks.json'`.
   - Impact: fresh Pi sessions, reloads, and subagent sessions can fail while loading the global config. The tracked config file exists at `~/.pi/config/tool-hooks.json` / `.pi-config/config/tool-hooks.json`, but the runtime lookup currently points at the missing `~/.pi/agent/config/tool-hooks.json`.
   - Suggested fix: resolve the config path through the real extension file path before applying `../../config`, or otherwise make the runtime lookup independent of the `agent/extensions` symlink path. Keep the fix compatible with the tracked layout documented in `AGENTS.md`.

### Focused Review Lanes

- `q-review-correctness` — verdict: fail to start; included findings: 0; notes: subagent extension loading failed with the same `tool-hooks` config path error.
- `q-review-tests-verification` — verdict: fail to start; included findings: 0; notes: subagent extension loading failed with the same `tool-hooks` config path error.
- `q-review-integration-ops` — verdict: fail to start; included findings: 0; notes: subagent extension loading failed with the same `tool-hooks` config path error.
- `q-review-security-invariants` — verdict: fail to start; included findings: 0; notes: subagent extension loading failed with the same `tool-hooks` config path error.
- `q-review-maintainability` — verdict: fail to start; included findings: 0; notes: subagent extension loading failed with the same `tool-hooks` config path error.
- `q-review-local-best-practices` — verdict: fail to start; included findings: 0; notes: subagent extension loading failed with the same `tool-hooks` config path error.

### Questions / Decisions Needed

None.

### Applied Edits

None.

### Follow-up Plan Dir

thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups

### Follow-up Context Review

thoughts/CoreyCole/plans/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read-review-followups/context/question/2026-04-25_19-18-43_pi-extension-hooks-and-auto-agents-read_implementation-review.md

### What's Good

- The implementation keeps the two requested capabilities split into `tool-hooks` and `auto-agents` extensions.
- The `auto-agents` wrapper is active in this session and visibly surfaces loaded/skipped `AGENTS.md` files in read results.
- The final implementation moved the bash wrapper to the public `createBashToolDefinition()` API, which matches the intended public extension surface.

### Verification

- `~/dotfiles/spec_metadata.sh` — captured review metadata: timestamp `2026-04-25_19-18-43`, commit `e8923eedd6d3375d47e2ec8a1a22f82692314f30`, branch `main`, repository `dotfiles`.
- Read the implement handoff, plan-specific `AGENTS.md`, `plan.md`, `design.md`, `outline.md`, and changed extension/config files.
- `git status --short` and `git log --oneline --decorate -12 -- ...` — confirmed current branch state and implementation commits; noted unrelated working-tree changes remain outside this review target.
- `python - <<'PY' ...` JSON checks — `.pi-config/agent/settings.json` and `.pi-config/config/tool-hooks.json` parse, and settings includes `+extensions/tool-hooks/index.ts` before `+extensions/auto-agents/index.ts`.
- `git diff --check -- .pi-config/extensions/tool-hooks .pi-config/extensions/auto-agents .pi-config/config/tool-hooks.json .pi-config/agent/settings.json thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read` — passed with no output.
- Focused review subagent chain — failed before lane execution because `tool-hooks` could not load `'/Users/coreycole/.pi/agent/config/tool-hooks.json'`; this is the review finding.
- Symlink/path inspection — confirmed `.pi-config/agent/extensions -> ../extensions` and the config file is tracked at `.pi-config/config/tool-hooks.json`, not `.pi-config/agent/config/tool-hooks.json`.

### Recommended Next Steps

Start a follow-up QRSPI loop from the copied implementation review context. The follow-up should fix the `tool-hooks` config path resolution and then re-run the original extension load/typecheck/smoke verification, including a fresh subagent or fresh Pi session startup check.
