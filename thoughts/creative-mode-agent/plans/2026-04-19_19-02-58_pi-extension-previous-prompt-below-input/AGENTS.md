---
source: ~/.agents/skills/qrspi-planning/AGENTS.md
copied_by: /q-question
note: This is a template. Edit the copy freely for plan-specific context.
---

# Plan Directory

This directory follows the QRSPI planning pipeline. It grows over time as stages complete and loops add new artifacts.

## How to orient yourself

1. **Read the pipeline overview**: `~/.agents/skills/qrspi-planning/SKILL.md`
2. **Determine what stage you're in** by checking which artifacts exist below.
3. **Read the skill for that stage** to understand the process, templates, and rules.

## Stages and their skills

| Artifact | Stage | Skill | Human gate? |
|----------|-------|-------|-------------|
| `questions/*.md` | Question | `~/.agents/skills/q-question/SKILL.md` | Yes |
| `research/*.md` | Research | `~/.agents/skills/q-research/SKILL.md` | Yes |
| `design.md` | Design | `~/.agents/skills/q-design/SKILL.md` | Yes |
| `outline.md` | Outline | `~/.agents/skills/q-outline/SKILL.md` | Yes |
| `plan.md` | Plan | `~/.agents/skills/q-plan/SKILL.md` | No |
| code changes | Implement | `~/.agents/skills/q-implement/SKILL.md` | No |

Every stage through outline requires human review before proceeding. Do not outsource the thinking.

## This process is not linear

You may loop back to earlier stages at any time. If research reveals missed questions, write new question docs. If design surfaces unknowns, do more research. The directory accumulates artifacts from these loops — multiple question docs and research docs are expected.

## Path convention

Plan directory paths always start with `thoughts/` and follow this structure:

```
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
```

All `/q-*` commands take this path as their argument. Use the full relative path starting from `thoughts/`.

When creating a new plan directory or markdown artifact inside it, run `~/dotfiles/spec_metadata.sh` first. Use it as the source of truth for `git_username`, `Timestamp For Filename`, and frontmatter fields such as `date`, `researcher`, `git_commit`, `branch`, and `repository`.

Recommended subdirectories inside a plan directory:
- `prds/` for PRDs, ticket exports, screenshots, and related product context
- `context/` for scout-produced supporting artifacts
  - `context/question/`
  - `context/research/`
  - `context/design/`
  - `context/outline/`
  - `context/plan/`
  - `context/implement/`
- `questions/` for timestamped question docs
- `research/` for timestamped research docs

## Key constraints

- **Scout-only reconnaissance.** Within QRSPI, use `scout` for discovery and write its outputs under `context/[stage]/`.
- **Separate context windows.** Question and Research run in fresh contexts. Research is blind to the ticket.
- **Instruction budget.** Stay under ~40 instructions per stage. Don't combine stages.
- **Read the code, not the plan.** The plan is a machine doc for the coding agent. Human reviews code.

## Handoffs

If you need to preserve context between sessions: `~/.agents/skills/q-handoff/SKILL.md`
If you're resuming from a handoff: `~/.agents/skills/q-resume/SKILL.md`
