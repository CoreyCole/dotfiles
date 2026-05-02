# Local Best-Practices Lane Report

Verdict: pass

## Findings
None.

## Guidance Read
- `AGENTS.md` — root Pi config layout, extension ownership, and pi-mono ground-truth rules are directly relevant to the outline's `.pi-config` cleanup.
- `.pi-config/AGENTS.md` — package-local Pi guidance for resource paths, setup behavior, and project conventions near the target files.
- `.pi-config/agent/skills/pi/SKILL.md` — relevant local skill for Pi config, settings, extensions, AGENTS.md behavior, skills, packages, and verification.
- `.agents/skills/q-outline/SKILL.md` — outline-stage requirements for structure, vertical slices, and test checkpoints.
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/AGENTS.md` — plan-specific durable decisions for validation-only setup, agent deconfliction, GPT 5.5 normalization, and retained QRSPI skills.
- `.agents/skills/q-review/agents/q-review-local-best-practices.md` — lane prompt and required report format.

## Target Files Read
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md`

## Verification
- `find . -path './.git' -prune -o -path './.pi-config/context' -prune -o -path './.pi-config/agent/git' -prune -o -name AGENTS.md -print -o -name CLAUDE.md -print -o -name .cursorrules -print -o -name .clinerules -print -o -name COPILOT.md -print; find .agents .cursor .claude -type f ...` — listed local guidance candidates with heavy cache paths pruned.
- `find .pi-config/agent/skills .agents/skills -maxdepth 2 -type f ... | rg '(^|/)pi|q-outline|qrspi|review'` — identified the Pi and QRSPI guidance relevant to this outline review.
- `nl -ba AGENTS.md .pi-config/AGENTS.md ...` — captured line references for reviewed guidance and target evidence.

## Notes for Main Reviewer
- The outline follows the local hard rules I checked: it keeps Pi resources under `.pi-config/agent/`, does not introduce `~/.pi/extensions/`, preserves local ownership of `answer.ts`/`execute-command.ts`, uses `context/pi-mono`-backed behavior from the design, keeps setup validation-only, deconflicts local subagent names, and gives every slice a test checkpoint.
