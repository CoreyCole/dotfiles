---
source: ~/.agents/skills/qrspi-planning/AGENTS.md
copied_by: /q-question
note: This is a template. The copy in each plan dir is a living, curated memory. Keep it short and prune stale items.
---

# Plan Directory

This directory follows the QRSPI planning pipeline. It grows over time as stages complete and loops add new artifacts.

## Role of this AGENTS.md

The copy of this file inside a specific plan dir is the long-term memory for that plan.
Use it to preserve only the durable context that future agents should load before diving back into the stage artifacts and code.

Capture things like:

- approved decisions that must not be accidentally undone
- important tradeoffs and rejected paths
- non-obvious invariants, gotchas, or review learnings
- scope boundaries, naming choices, or sequencing changes that now define the work
- pointers to the canonical artifact or code location for more detail

This file complements the primary artifacts:

- `questions/`, `research/`, `design.md`, `outline.md`, `plan.md`, and `reviews/` remain the canonical stage records
- handoffs are short-term checkpoints
- this AGENTS.md is the curated cross-session memory for long plan / implement / review loops

## Keep it curated

Context is expensive. Do **not** turn this file into a diary or dump.

Add an item only when it is likely to matter to a future agent after the current context window is gone.

Good candidates:

- stable decisions with downstream impact
- nuance that took real effort to learn
- review feedback that changed the accepted approach
- "watch out" details that are easy to miss from the happy-path artifacts

Bad candidates:

- raw command output or stack traces
- temporary debugging notes
- status updates or task lists already covered by `plan.md` checkboxes or handoffs
- long summaries of artifacts that already exist
- facts likely to go stale unless you are also updating or removing them when they change

When adding content:

- prefer short bullets over prose
- include exact artifact paths or `file:line` references where useful
- update or delete stale items instead of appending contradictions
- keep the highest-signal items near the top
- if in doubt, leave it out

## How to orient yourself

1. **Read this file's plan-specific memory first** if it has been filled in.
1. **Read the pipeline overview**: `~/.agents/skills/qrspi-planning/SKILL.md`
1. **Determine what stage you're in** by checking which artifacts exist below.
1. **Read the skill for that stage** to understand the process, templates, and rules.

Use this file to prioritize what matters. Do not treat it as a replacement for the stage artifacts.

## Suggested sections for the copied file

Keep only the sections that earn their place.

- **Current focus** — what loop or checkpoint we are in right now
- **Decisions to preserve** — approved choices, scope boundaries, naming, sequencing changes
- **Important tradeoffs / rejected paths** — only when future agents might otherwise re-open them
- **Invariants / gotchas** — non-obvious rules, edge cases, or traps discovered during implementation or review
- **Canonical artifacts** — the few docs or context files future agents should open first

## Stages and their skills

| Artifact | Stage | Skill | Human gate? |
|----------|-------|-------|-------------|
| `questions/*.md` | Question | `~/.agents/skills/q-question/SKILL.md` | Yes |
| `research/*.md` | Research | `~/.agents/skills/q-research/SKILL.md` | Yes |
| `design.md` | Design | `~/.agents/skills/q-design/SKILL.md` | Yes |
| `outline.md` | Outline | `~/.agents/skills/q-outline/SKILL.md` | Yes |
| `plan.md` | Plan | `~/.agents/skills/q-plan/SKILL.md` | No |
| code changes | Implement | `~/.agents/skills/q-implement/SKILL.md` | No |
| `reviews/*.md` | Review | `~/.agents/skills/q-review/SKILL.md` | Yes — human reads the review and decides next action |

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
- `context/` for supporting codebase context artifacts
  - `context/question/`
  - `context/research/`
  - `context/design/`
  - `context/outline/`
  - `context/plan/`
  - `context/implement/`
- `questions/` for timestamped question docs
- `research/` for timestamped research docs
- `reviews/` for timestamped `/q-review` artifacts

## Key constraints

- **Stage-specific read-only discovery.** Within QRSPI, use the stage skill's preferred discovery/analyzer flow and write its outputs under `context/[stage]/`.
- **Separate context windows.** Question and Research run in fresh contexts. Research is blind to the ticket.
- **Instruction budget.** Stay under ~40 instructions per stage. Don't combine stages.
- **Read the code, not the plan.** The plan is a machine doc for the coding agent. Human reviews code.

## Handoffs

If you need to preserve context between sessions: `~/.agents/skills/q-handoff/SKILL.md`
If you're resuming from a handoff: `~/.agents/skills/q-resume/SKILL.md`

Use handoffs for checkpoint status. Promote only durable, high-signal learnings into this AGENTS.md.

## Current focus

- Plan two separate Pi extensions for the dotfiles Pi config:
  - Claude-Code-style pre/post tool hooks configuration
  - automatic `AGENTS.md` reading on `read` tool usage

## Decisions to preserve

- Use `context/pi-mono` as the local ground-truth source for Pi behavior during research and design.
- Also load the `pi` skill for Pi-specific work.
- The hook work should support everything currently needed for `cn-hooks` inside Pi, not just a generic pre/post tool demo.
- Hook command payloads must expose full structured tool arguments so scripts can inspect values like `read.input.path` and `bash.input.command`, while preserving Claude-compatible top-level stdin keys such as `cwd`, `tool_name`, and `tool_input` for existing `cn-hooks` parsers.
- The `AGENTS.md` auto-read behavior should trigger only around `read` tool usage and inspect ancestor `AGENTS.md` files on every read call, regardless of the requested file type.
- Relevant instruction files are ancestor `AGENTS.md` files from the target file's directory upward.
- Auto-read should stay on the normal `read` tool path, not a custom-message side channel.
- Any read should trigger delegated reads of relevant `AGENTS.md` files first if they have not been read yet in the session or changed since the last read.
- Session dedupe key should be exact absolute path.
- Re-read an `AGENTS.md` when its file contents change; use hashing to detect changes.
- Implement `tool-hooks` before `auto-agents`, and load `tool-hooks` first in `.pi-config/agent/settings.json`, so the hook extension owns Claude-compat behavior before the `read` override lands.
- Pi does not expose a first-class nested tool execution API for extensions; preserve the approved compromise that `auto-agents` delegates through the built-in read implementation and surfaces what it auto-loaded through the wrapped read tool’s own result/details rather than inventing separate custom messages.

## Review learnings

- Outline review (2026-04-25): Slice 5 must explicitly surface which `AGENTS.md` files were auto-loaded through the wrapped `read` result/renderer; delegated `originalRead.execute()` calls alone will not create separate visible tool rows under Pi’s current tool execution flow.
- Outline review (2026-04-25): the hook plan still needs an explicit compatibility adapter for the current Chestnut Flake contract — existing grouped hook config, Claude-style block response (`{"decision":"block"}`), required env/runtime affordances like `CLAUDE_ENV_FILE`, and Claude-compatible top-level stdin keys (`cwd`, `tool_name`, `tool_input`) — rather than only a new flat Pi-local schema. In practice that means a per-session env file plus a bash wrapper/spawn-hook bridge so `SessionStart` exports affect later bash tool executions.
