# Intent-Fit Lane Report

Verdict: concerns

## Findings
- [P2] Preserve the existing package declarations explicitly — `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md:39`
  - Evidence: The design states that `.pi-config/agent/settings.json` currently declares six packages, including both `nicobailon/pi-subagents` and `HazAT/pi-parallel`, and frames the work as documentation/setup/name cleanup rather than package removal (`design.md:32-45`, `design.md:176-179`). The outline's settings shape shows `"packages": ["git:github.com/nicobailon/pi-subagents"]` and the slices only say to add `subagents.agentOverrides`, without explicitly preserving the existing package list.
  - Impact: An implementer could treat the outline JSON as the target config and accidentally drop configured packages, which would be scope drift and could break pi-parallel-backed tooling that the same outline still documents.
  - Suggested fix: Change the outline example to use an ellipsis/commented placeholder for existing packages, or add a slice requirement that `.pi-config/agent/settings.json` must preserve all existing package declarations while adding only the minimal subagent overrides.

## What I Read
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/AGENTS.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md`

## Verification
- `nl -ba thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md | sed -n '1,260p'`
- `nl -ba thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md | sed -n '1,360p'`

## Notes for Main Reviewer
- The outline otherwise tracks the design's core decisions: keep the `.pi-config/agent` runtime layout, make setup validation-only, track `agent/extensions/subagent/config.json`, delete stale `.pi-config/pi-subagents/**`, deconflict local agent names, and keep npm metadata as optional development support.
