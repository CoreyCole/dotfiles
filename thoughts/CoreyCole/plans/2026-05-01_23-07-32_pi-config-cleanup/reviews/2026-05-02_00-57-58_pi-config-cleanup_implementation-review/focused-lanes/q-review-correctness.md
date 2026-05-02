# Correctness Lane Report

Verdict: concerns

## Findings

- [P2] `algal/pi-context-inspect` package was dropped from tracked settings — `.pi-config/agent/settings.json:11`
  - Evidence: `b55fe11:.pi-config/agent/settings.json` and the implementation plan both include `"git:github.com/algal/pi-context-inspect"` in `packages`, but the current package array ends after `"git:git@github.com:CoreyCole/pi-deterministic-docs.git"` at line 16. `git diff b55fe11..HEAD -- .pi-config/agent/settings.json` shows that entry was removed while adding the `subagents` override block.
  - Impact: Pi will no longer resolve or load the configured `algal/pi-context-inspect` package on startup, so any tools/resources from that package disappear from the global config despite the plan's preserve-existing-settings contract.
  - Suggested fix: Re-add `"git:github.com/algal/pi-context-inspect"` to the `packages` array after the deterministic-docs entry, preserving valid JSON.

## What I Read

- `/Users/coreycole/dotfiles/.agents/skills/q-review/agents/q-review-correctness.md`
- `/Users/coreycole/.pi/agent/skills/review-rubric/SKILL.md`
- `/Users/coreycole/dotfiles/progress.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/plan.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/research/2026-05-02_00-03-19_pi-config-cleanup.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/handoffs/2026-05-02_00-56-54_implement-handoff.md`
- `.pi-config/setup.sh`
- `.pi-config/agent/settings.json`
- `.pi-config/.gitignore`
- `.gitignore`
- `.pi-config/README.md`
- `.pi-config/AGENTS.md`
- `.pi-config/agent/agents/web-researcher.md`
- `.pi-config/agent/agents/rubric-reviewer.md`
- `.pi-config/agent/agents/qrspi-scout.md`
- `.pi-config/agent/agents/todo-worker.md`
- `.pi-config/agent/extensions/subagent/config.json`

## Verification

- `git diff --stat --name-status b55fe11..HEAD -- .pi-config .gitignore`
- `git show b55fe11:.pi-config/agent/settings.json && git diff b55fe11..HEAD -- .pi-config/agent/settings.json`
- `nl -ba .pi-config/agent/settings.json | sed -n '1,35p'`
- `rg -n "\\b(researcher|reviewer|scout|worker)\\b" .pi-config -g '!node_modules/**' -g '!agent/git/**' -g '!pi-subagents/**'`
- `python3 -m json.tool .pi-config/agent/settings.json >/dev/null && python3 -m json.tool .pi-config/agent/mcp.json >/dev/null && python3 -m json.tool .pi-config/agent/extensions/subagent/config.json >/dev/null && python3 -m json.tool .pi-config/package.json >/dev/null && bash -n .pi-config/setup.sh && ! rg -n "agent/settings.json.*runtime state|installs the configured Pi packages|ensures parallel-cli is installed" .pi-config/README.md .pi-config/AGENTS.md && ! rg -n "^name: (researcher|reviewer|scout|worker)$" .pi-config/agent/agents && ! rg -n "gpt-5\\.3|codex-spark|thinking: minimal" .pi-config/agent/agents .pi-config/agent/settings.json && ! rg -n "pi install|npm install|curl .*\\| *bash|brew install" .pi-config/setup.sh`
- `~/dotfiles/.pi-config/setup.sh`
- `git check-ignore -v .pi-config/node_modules .pi-config/agent/auth.json .pi-config/agent/sessions .pi-config/agent/run-history.jsonl .pi-config/agent/git .pi-config/history .pi-config/context && ! git check-ignore -q .pi-config/agent/settings.json && ! git check-ignore -q .pi-config/agent/extensions/subagent/config.json`
- `git status --short -- .pi-config .gitignore`
- `test ! -e .pi-config/pi-subagents && test ! -e .pi-config/agent/agents/researcher.md && test ! -e .pi-config/agent/agents/reviewer.md && test ! -e .pi-config/agent/agents/scout.md && test ! -e .pi-config/agent/agents/worker.md && find .pi-config/agent/agents -maxdepth 1 -type f -name '*.md' -print | sort`

## Notes for Main Reviewer

- `/Users/coreycole/dotfiles/plan.md` was not present; I used the referenced QRSPI plan directory artifacts as the plan evidence.
