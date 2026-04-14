---
date: 2026-04-09T17:25:00+0000
researcher: CoreyCole
stage: question
ticket: "Create a Go CLI (cctl) invoked as 'c', with a 'claude' subcommand that loads a Claude Code session as context when launching pi"
plan_dir: "thoughts/CoreyCole/plans/2026-04-09_claude-session-reader-skill"
---

# Research Questions: cctl — Corey CTL CLI with Claude-to-Pi Loader

## Context
We want to build a Go CLI using Cobra, packaged as `cctl` in the dotfiles repo, invoked as `c` (nothing shadows this). The first subcommand will load a Claude Code session and launch pi with that context. The session list should be scoped to the current working directory. This lives in the dotfiles repo and gets added to `$PATH`.

## Questions

1. **How should the Go module and Cobra CLI be structured in the dotfiles repo?** What directory layout — `cctl/cmd/root.go`, `cctl/cmd/claude.go`, `cctl/main.go`? How does it get built and added to PATH (go install, symlink, Makefile)?

2. **How does Claude Code map working directories to session storage paths?** Sessions live in `~/.claude/projects/<encoded-path>/`. The encoding appears to be the project path with `/` replaced by `-` and prefixed with `-` (e.g., `/Users/coreycole/dotfiles` → `-Users-coreycole-dotfiles`). Is this encoding consistent? How do we reliably map `$PWD` to the correct project directory?

4. **What is the exact JSONL schema for Claude Code sessions?** Claude sessions have top-level types like `user`, `assistant`, `progress`, `system`, `file-history-snapshot`, `last-prompt`, `queue-operation`. How are user messages structured (text vs tool_result content)? How are assistant messages structured (text, tool_use, thinking)? What metadata is available (model, timestamps, cost)?

5. **How reliable is `sessions-index.json` vs scanning actual `.jsonl` files?** The index contains rich metadata (summary, firstPrompt, messageCount, gitBranch, dates) but can be stale — index entries reference files that no longer exist, and actual `.jsonl` files may not appear in the index. What discovery strategy works?

6. **What content from a Claude session is useful as pi context, and what is noise?** Sessions contain `progress` events (hook execution), `file-history-snapshot`, `queue-operation`, `system:bridge_status` — all noise. Thinking blocks have opaque signatures. Tool results can be huge. What should the context document include/exclude?

7. **How should the CLI handle session selection UX?** Use a Go TUI library (bubbletea, promptui) for interactive selection? Or shell out to fzf? What information per session line (date, summary, first prompt, message count, git branch)? Preview support?

8. **How does pi accept initial context and prompts?** Pi supports `@file` references and inline messages (`pi @context.md "Continue this work"`), `--append-system-prompt`, and `--session`/`--fork`. What's the best way to inject a session context document?

9. **How should subagent sessions be handled in the context output?** Claude uses `Agent` tool calls that delegate to subagents. Their results appear as `tool_result` content. Summarize inline, omit, or optionally expand?

9. **What other subcommands might `cctl` eventually host?** Understanding the broader vision helps structure the CLI — is this just for Claude-to-pi, or a general dotfiles/workflow Swiss army knife? This affects the Cobra command hierarchy (`c claude`, `c ...`).

## Codebase References
- `.pi-config/skills/session-reader/SKILL.md` — existing pi session reader skill, model for parsing approach
- `.pi-config/skills/session-reader/scripts/read_session.py` — 668-line Python script parsing pi JSONL, adaptable patterns
- `.pi-config/skills/session-reader/references/session-format.md` — pi session format docs (for comparison)
- `~/.claude/projects/` — Claude Code session storage directory
- `~/.claude/projects/-Users-coreycole-dotfiles/sessions-index.json` — example session index
- `~/.claude/projects/-Users-coreycole-dotfiles/*.jsonl` — actual session files to study
