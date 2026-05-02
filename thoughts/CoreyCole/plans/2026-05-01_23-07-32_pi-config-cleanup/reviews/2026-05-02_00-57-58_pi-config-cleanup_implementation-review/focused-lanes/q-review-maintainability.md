# Maintainability Lane Report

Verdict: concerns

## Findings

- [P2] Package declaration drift is mixed into the cleanup — `.pi-config/agent/settings.json:11`
  - Evidence: `b55fe11:.pi-config/agent/settings.json` and the approved plan at `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/plan.md:514`-`534` preserve six package declarations, including `git:github.com/algal/pi-context-inspect`; HEAD's `packages` array now has five entries and ends at `.pi-config/agent/settings.json:16` without that package.
  - Impact: This cleanup is primarily about documenting and organizing the config boundary, so an unrelated, undocumented package removal makes the tracked `settings.json` source of truth harder to reason about and can leave future maintainers unsure whether the tool was intentionally retired or accidentally dropped during a rewrite.
  - Suggested fix: Restore the missing package entry, or split/document the removal as an intentional package-retirement decision with the plan/docs updated to match.

## What I Read

- `/Users/coreycole/dotfiles/progress.md`
- `/Users/coreycole/dotfiles/.agents/skills/q-review/agents/q-review-maintainability.md`
- `/Users/coreycole/.pi/agent/skills/review-rubric/SKILL.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/plan.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/handoffs/2026-05-02_00-56-54_implement-handoff.md`
- `.pi-config/README.md`
- `.pi-config/AGENTS.md`
- `.pi-config/setup.sh`
- `.pi-config/agent/settings.json`
- `.pi-config/.gitignore`
- `.gitignore`
- `.pi-config/agent/extensions/subagent/config.json`
- `.pi-config/agent/agents/web-researcher.md`
- `.pi-config/agent/agents/rubric-reviewer.md`
- `.pi-config/agent/agents/qrspi-scout.md`
- `.pi-config/agent/agents/todo-worker.md`

## Verification

- `git diff --stat b55fe11..HEAD -- .pi-config .gitignore && git diff --name-status b55fe11..HEAD -- .pi-config .gitignore`
- `git show b55fe11:.pi-config/agent/settings.json && git diff b55fe11..HEAD -- .pi-config/agent/settings.json`
- `rg -n "\b(researcher|reviewer|scout|worker)\b" .pi-config -g '!node_modules/**' -g '!agent/git/**' -g '!pi-subagents/**'`
- `! rg -n "^name: (researcher|reviewer|scout|worker)$" .pi-config/agent/agents && ! rg -n "gpt-5\.3|codex-spark|thinking: minimal" .pi-config/agent/agents .pi-config/agent/settings.json && python3 -m json.tool .pi-config/agent/settings.json >/dev/null && bash -n .pi-config/setup.sh`
- `~/dotfiles/.pi-config/setup.sh`
- `git log --oneline b55fe11..HEAD -- .pi-config .gitignore thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup`

## Notes for Main Reviewer

- `/Users/coreycole/dotfiles/plan.md` was requested as input but does not exist; I used the plan directory's `plan.md` as the canonical plan artifact.
