---
date: 2026-04-18T23:21:03-07:00
researcher: creative-mode-agent
git_commit: fd6bcf48b48eb26fc10bb582247751a1c892f8ac
branch: main
repository: cn-agents
topic: "Pi subagent timeout and SQLite-backed Q-research handoff"
tags: [pi, subagents, timeout, q-research, sqlite, temporal]
status: complete
last_updated: 2026-04-18
last_updated_by: creative-mode-agent
type: implementation_strategy
---

# Handoff: pi-subagent timeout + q-research

## Task(s)
- **Pi subagent timeout/frontmatter investigation — completed.** Investigated whether the active subagent system supports an agent frontmatter timeout field. It does **not** in the currently installed `pi-subagents` package; timeout is not a recognized frontmatter field or tool parameter.
- **No-match vs timeout semantics investigation — completed.** Determined that a timeout should be treated as an execution-budget failure, not as proof that nothing exists. Recommended explicit bounded “no confident match found” responses plus a separate timeout status.
- **`/q-research` for SQLite-backed Pi session tree chat — work in progress.** Gathered findings for questions 1-7 via subagents and main-session verification, but did **not** write the final research artifact under `thoughts/.../research/`. Resume from the question doc below.

## Critical References
- `thoughts/creative-mode-agent/plans/2026-04-19_01-47-47_pkg-agents-sdk-pi-temporal-datastar-chat/questions/2026-04-19_02-30-51_sqlite-backed-pi-session-tree-chat.md:1-51`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agents.ts:17-34`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/execution.ts:198-409`

## Recent changes
- None — no repository files were modified in this session.

## Learnings
- The active subagent system is **not** core pi; it comes from the installed package list in `/home/ruby/.pi/agent/settings.json:5-19`, specifically `git:github.com/HazAT/pi-subagents`.
- `codebase-pattern-finder` is currently misconfigured: `/home/ruby/.pi/agent/agents/codebase-pattern-finder.md:1-9` sets `tools: Grep, Glob, Read, LS`, which do not match pi builtin tool names. This explains the observed “Unknown tool” failures. The prompt itself already says to use `read`, `grep`, `find`, `ls`.
- In the active `pi-subagents` package, recognized agent frontmatter fields are limited to `name`, `description`, `tools`, `model`, `thinking`, `skill/skills`, `extensions`, `output`, `defaultReads`, `defaultProgress`, and `interactive`: `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agent-serializer.ts:4-17`.
- Unknown frontmatter keys are preserved as `extraFields` but are not used for execution. Parsing/collection happens in `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agents.ts:61-88` and `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agents.ts:161-183`. So adding `timeout:` today would be inert metadata.
- The `subagent` tool schema does not expose any timeout parameter. See `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/schemas.ts:62-96`.
- Execution currently supports **abort**, not wall-clock timeout. Child pi processes are spawned in `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/execution.ts:199-205`, and abort handling kills them with `SIGTERM` then `SIGKILL` in `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/execution.ts:366-372`.
- Current failure surfacing is generic: single-run failures return `r.error || "Failed"` from `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/index.ts:823-852`. That means a future timeout without better semantics will look like a generic retryable failure.
- Recommendation from analysis only (not implemented): keep **both** bounded no-match behavior and timeout. Use three states conceptually: `found`, `no_confident_match`, `timeout/incomplete`. Timeout alone is not enough to conclude “nothing exists”.
- For the SQLite-backed Pi session tree chat research, the highest-signal findings already gathered were:
  - Pi session storage is tree-based (`id`/`parentId`) and branch context is ancestry-based, not time-range-based.
  - Current continuation in `pkg/agents` is review-stage and `session_path`/filesystem coupled, not SQLite-head driven.
  - Existing chat DB tables are linear (`thread -> ordered messages`) and do not model Pi branch ancestry.
  - Existing Datastar chat and pipeline panes are reusable as UI building blocks, but the route/service wiring is still host-specific.

## Artifacts
- `thoughts/creative-mode-agent/plans/2026-04-19_01-47-47_pkg-agents-sdk-pi-temporal-datastar-chat/questions/2026-04-19_01-47-47_pi-temporal-datastar-chat-sdk.md`
- `thoughts/creative-mode-agent/plans/2026-04-19_01-47-47_pkg-agents-sdk-pi-temporal-datastar-chat/questions/2026-04-19_02-30-51_sqlite-backed-pi-session-tree-chat.md:1-51`
- `/home/ruby/.pi/agent/settings.json:5-19`
- `/home/ruby/.pi/agent/agents/codebase-pattern-finder.md:1-11`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/README.md:19-59`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agent-serializer.ts:4-17`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agents.ts:17-34`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agents.ts:61-88`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/agents.ts:124-183`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/schemas.ts:62-96`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/execution.ts:198-409`
- `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/index.ts:807-859`
- `thoughts/creative-mode-agent/handoffs/general/2026-04-18_23-21-03_pi-subagent-timeout-and-q-research.md`

## Action Items & Next Steps
1. **Fix the broken agent config first**: update `/home/ruby/.pi/agent/agents/codebase-pattern-finder.md:1-9` to use pi tool names (`read, grep, find, ls`) instead of `Grep, Glob, Read, LS`.
2. If pursuing timeout support, patch the active package at `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/`:
   - add `timeoutMs` (or `timeout`) to recognized frontmatter fields,
   - parse it in `agents.ts`,
   - expose it in `schemas.ts` for single/parallel/chain,
   - implement an internal `AbortController + setTimeout(...)` that feeds the existing abort/kill path in `execution.ts`.
3. Separately tighten `codebase-pattern-finder`’s prompt so it returns a bounded semantic result such as “No confident pattern found; searched X/Y/Z” instead of wandering.
4. If timeout is implemented, ensure the surfaced result says **incomplete/timed out**, not “didn’t find anything”.
5. Resume the paused `/q-research` work by writing the actual research doc under `thoughts/creative-mode-agent/plans/2026-04-19_01-47-47_pkg-agents-sdk-pi-temporal-datastar-chat/research/`. The question doc at `.../2026-04-19_02-30-51_sqlite-backed-pi-session-tree-chat.md` is the primary input.
6. If resuming research, reuse the already established conclusions above instead of re-litigating the timeout discussion.

## Other Notes
- No research artifact was written during this session; the `/q-research` stage is still incomplete despite significant fact gathering.
- The subagent package path you should edit is the installed package under `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents/`, not the example extension in `context/pi-mono/packages/coding-agent/examples/extensions/subagent/`.
- Timeout alone should not be used as a signal to “not try again.” It should be used as a signal to **not repeat the same broad search unchanged**. Explicit `no_confident_match` output is the non-retry signal.
