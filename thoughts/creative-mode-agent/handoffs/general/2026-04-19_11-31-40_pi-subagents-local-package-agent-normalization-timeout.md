---
date: 2026-04-19T11:31:40-07:00
researcher: creative-mode-agent
git_commit: 2c3f3a19df60f099009e789e09e8db13e492e0f4
branch: feat/cctl-contrib-export-local-v2
repository: dotfiles
topic: "Pi subagents local package + agent normalization + timeout Implementation Strategy"
tags: [implementation, strategy, pi, subagents, timeout, agents]
status: complete
last_updated: 2026-04-19
last_updated_by: creative-mode-agent
type: implementation_strategy
---

# Handoff: general pi-subagents local package + timeout

## Task(s)
- **Move `pi-subagents` to a locally-owned package path — completed.** Pi was switched from the managed git package entry to a local-path package at `/home/ruby/dotfiles/.pi-config/pi-subagents`, so future edits should happen there instead of in the managed checkout.
- **Validate whether the local-path package is active — completed.** After `/reload`, a `scout` subagent run succeeded from `/home/ruby/dotfiles`, confirming the current Pi session can execute subagents with the new package path.
- **Plan agent normalization work — completed.** Agreed next work is to normalize local agent markdown files to Pi-native frontmatter/instructions, starting with `codebase-pattern-finder`.
- **Plan timeout support in subagents — discussed, not started.** The intended implementation is a clean `timeoutMs` feature across frontmatter, tool schema, sync/async execution, and surfaced timeout semantics.

## Critical References
- `thoughts/creative-mode-agent/handoffs/general/2026-04-18_23-21-03_pi-subagent-timeout-and-q-research.md`
- `.pi-config/settings.json:5-19`
- `.pi-config/pi-subagents/{agent-serializer.ts,agents.ts,schemas.ts,settings.ts,types.ts,execution.ts,chain-execution.ts,async-execution.ts,subagent-runner.ts,agent-management.ts,agent-manager-edit.ts,agent-manager-detail.ts}`

## Recent changes
- `.pi-config/settings.json:5-19` now points the first package entry at `/home/ruby/dotfiles/.pi-config/pi-subagents` instead of the managed git package source.
- `thoughts/creative-mode-agent/handoffs/general/2026-04-18_23-21-03_pi-subagent-timeout-and-q-research.md:1-77` was moved into `dotfiles/thoughts/...` so future sessions can resume from dotfiles instead of `.hermes`.
- `.pi-config/pi-subagents/` was added as a nested local git checkout at commit `91ce1a47868be1b1d5a080052ede097f25e3042a`; no package source files have been edited yet.

## Learnings
- `~/.pi/agent/settings.json` resolves to `.pi-config/settings.json` inside this repo, so changing the global Pi settings changes the tracked dotfiles file as well.
- Pi’s git package updater is destructive for local edits: docs say `pi update` updates non-pinned packages (`.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:29-34`), and the implementation does `git fetch`, `git reset --hard`, `git clean -fdx`, then `npm install` (`.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1601-1633`). That is why the package was moved to a local-path source first.
- The active editable package is now `/home/ruby/dotfiles/.pi-config/pi-subagents`; the old managed checkout remains at `/home/ruby/dotfiles/.pi-config/git/github.com/HazAT/pi-subagents` as a reference only.
- A post-reload `scout` run worked with `output:false`, which confirms the local package path is active and the subagent tool still functions.
- The inner repo currently has untracked `node_modules/`, and the outer `dotfiles` repo sees `.pi-config/pi-subagents/` as an untracked nested repo. Be deliberate about which repo you are committing in.
- Several local agent markdown files are already dirty in the outer repo (`.pi-config/agents/codebase-analyzer.md`, `codebase-locator.md`, `codebase-pattern-finder.md`, `thoughts-analyzer.md`, `thoughts-locator.md`). Inspect their existing diffs before making new edits so you do not overwrite unrelated pending work.

## Artifacts
- `.pi-config/settings.json:1-31`
- `.pi-config/pi-subagents/`
- `.pi-config/pi-subagents/README.md`
- `.pi-config/pi-subagents/agent-serializer.ts`
- `.pi-config/pi-subagents/agents.ts`
- `.pi-config/pi-subagents/schemas.ts`
- `.pi-config/pi-subagents/settings.ts`
- `.pi-config/pi-subagents/types.ts`
- `.pi-config/pi-subagents/execution.ts`
- `.pi-config/pi-subagents/chain-execution.ts`
- `.pi-config/pi-subagents/async-execution.ts`
- `.pi-config/pi-subagents/subagent-runner.ts`
- `.pi-config/pi-subagents/parallel-utils.ts`
- `.pi-config/pi-subagents/agent-management.ts`
- `.pi-config/pi-subagents/agent-manager-edit.ts`
- `.pi-config/pi-subagents/agent-manager-detail.ts`
- `.pi-config/agents/codebase-analyzer.md`
- `.pi-config/agents/codebase-locator.md`
- `.pi-config/agents/codebase-pattern-finder.md`
- `.pi-config/agents/thoughts-analyzer.md`
- `.pi-config/agents/thoughts-locator.md`
- `thoughts/creative-mode-agent/handoffs/general/2026-04-18_23-21-03_pi-subagent-timeout-and-q-research.md`
- `.pi-config/context/pi-mono/packages/coding-agent/docs/packages.md:29-34,67-83`
- `.pi-config/context/pi-mono/packages/coding-agent/src/core/package-manager.ts:1580-1633`

## Action Items & Next Steps
1. Inspect the existing diffs in `.pi-config/agents/*.md`, then normalize the local agent files to Pi-native frontmatter/instructions.
2. Start with `.pi-config/agents/codebase-pattern-finder.md`: fix invalid tool names, tighten the prompt, and add a bounded “no confident match found” output contract.
3. Normalize the related locator/analyzer agents next (`codebase-analyzer`, `codebase-locator`, `thoughts-analyzer`, `thoughts-locator`), keeping tool names/instructions consistent with Pi’s actual builtins.
4. Implement `timeoutMs` in `.pi-config/pi-subagents`:
   - add it to frontmatter parsing/serialization (`agent-serializer.ts`, `agents.ts`),
   - expose it in tool schemas for single/parallel/chain step overrides (`schemas.ts`),
   - plumb it through settings/types (`settings.ts`, `types.ts`, `parallel-utils.ts`),
   - enforce it in sync and async execution (`execution.ts`, `chain-execution.ts`, `async-execution.ts`, `subagent-runner.ts`),
   - optionally expose it in agent management/TUI (`agent-management.ts`, `agent-manager-edit.ts`, `agent-manager-detail.ts`).
5. Keep timeout semantics separate from search semantics: timeout should surface as incomplete/timed out, never as proof that nothing exists.
6. After package edits, `/reload` and verify with at least four runs: normal success, forced timeout in single mode, timeout in a chain step, and timeout in async execution.

## Other Notes
- The current branch is `feat/cctl-contrib-export-local-v2`, but the subagents implementation work will happen inside the nested repo at `.pi-config/pi-subagents` on its own `main` branch unless you create a feature branch there.
- `pi list` already shows the local-path package, so no further package-manager work is needed before editing code.
- The earlier timeout/research handoff already captured the conceptual timeout/no-match distinction and the most relevant subagent files. Reuse it rather than redoing that investigation.
