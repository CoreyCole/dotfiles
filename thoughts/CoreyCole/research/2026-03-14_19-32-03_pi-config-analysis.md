---
date: 2026-03-14T19:32:03-07:00
researcher: CoreyCole
git_commit: 498921c
branch: main
repository: dotfiles
topic: "Pi-Config Architecture Analysis — Daniel Griesser's Agent Workflow System"
tags: [research, pi-config, agents, skills, extensions, workflow, claude-code]
status: complete
last_updated: 2026-03-14
last_updated_by: CoreyCole
---

# Research: Pi-Config Architecture Analysis

**Date**: 2026-03-14T19:32:03-07:00
**Researcher**: CoreyCole
**Git Commit**: 498921c
**Branch**: main
**Repository**: dotfiles

## Research Question
Analyze the `context/pi-config/` project — Daniel Griesser (HazAT)'s personal configuration for the "pi" coding agent. Understand the architecture, workflow patterns, agents, skills, extensions, and how they compose into the brainstorm pipeline shown in his workflow diagram.

## Summary

Pi-config is Daniel Griesser's personal configuration for [pi](https://github.com/badlogic/pi) — an alternative AI coding agent by Mario Zechner (@badlogic). It implements a highly structured **brainstorm → plan → todo → execute** pipeline using specialized agents (scout, worker, reviewer, researcher, visual-tester), 14 skills, and 10 extensions. The system is designed for context-window efficiency: planning happens in the main session, execution is delegated to cheap/fast subagents, and a watchdog monitors for stuck agents.

## Detailed Findings

### Architecture Overview

The pi-config project lives at `~/.pi/agent/` and is auto-discovered by pi. It contains:

- **5 agents** — specialized subagents with model/tool restrictions
- **14 skills** — on-demand prompt instructions loaded by context matching
- **10 extensions** — TypeScript plugins that register tools, commands, and event hooks
- **AGENTS.md** — core system prompt with principles, delegation patterns, and commit strategy
- **settings.json** — model defaults (Opus 4.6), packages, extension toggles

### The Brainstorm Pipeline (matches workflow diagram)

The `brainstorm` skill (`skills/brainstorm/SKILL.md`) defines the full 8-phase pipeline:

```
Phase 1: Investigate Context (explore codebase)
Phase 2: Clarify Requirements (interactive Q&A with /answer)
Phase 3: Explore Approaches (2-3 options with tradeoffs)
Phase 4: Present & Validate Design (sectioned, 200-300 words each)
Phase 5: Write Plan (to ~/.pi/history/<project>/plans/)
Phase 6: Create Todos (bite-sized, 2-5 min each)
Phase 6.5: Create Feature Branch
Phase 7: Execute with Subagents (scout → workers → reviewer)
Phase 7.5: Visual Testing (optional, Chrome CDP)
Phase 8: Review (mandatory)
```

**Key constraint**: "You MUST follow all phases. Your judgment that something is 'simple' is NOT sufficient to skip steps." The only exception is explicit user permission to skip.

### Agent Architecture

| Agent | Model | Role | Tools | Output |
|-------|-------|------|-------|--------|
| **scout** | Haiku 4.5 | Fast codebase recon | read, bash, todo | context.md |
| **worker** | Sonnet 4.6 | Implements todos, commits | read, bash, write, edit, todo | — |
| **reviewer** | Codex 5.3 | Code review | read, bash | review.md |
| **researcher** | Sonnet 4.6 | Web + code research | parallel_*, claude, write, bash | research.md |
| **visual-tester** | Sonnet 4.6 | Chrome CDP visual QA | bash, read, write | visual-test-report.md |

**Key patterns**:
- Scout runs on Haiku (cheap/fast) to gather context before expensive Worker runs
- Workers run **sequentially** (never parallel in same git repo — commit conflicts)
- Each worker claims a todo, implements it, commits with the `commit` skill, closes the todo
- Reviewer runs **after all workers** and is mandatory
- The `output:` frontmatter field enables automatic chain handoff between agents

### Chain Pattern (Scout → Worker → Reviewer)

```typescript
// 1. Scout gathers context for the entire plan
subagent({ agent: "scout", task: "Gather context for [feature]..." })

// 2. Read scout's output, pass to each worker
const scoutContext = read(".pi/context.md")

// 3. Workers execute todos sequentially
subagent({ agent: "worker", task: `Implement TODO-xxxx...
Scout context: ${scoutContext}` })

// 4. Reviewer reviews the feature branch against main
subagent({ agent: "reviewer", task: "Review feature branch..." })
```

### Extension System

Extensions are TypeScript files that hook into pi's lifecycle:

**claude-tool** (`extensions/claude-tool/index.ts`):
- Wraps the `@anthropic-ai/claude-agent-sdk` to spawn Claude Code sessions from within pi
- Supports single and **parallel mode** (up to 8 sessions, 3 concurrent)
- Live streaming overlay panel (non-capturing, right-aligned)
- Session persistence and indexing at `~/.pi/history/<project>/claude-sessions.json`
- Deliberately discouraged in prompt guidelines — "expensive, slow, spins up a full separate session"

**watchdog** (`extensions/watchdog.ts`):
- Monitors agent activity with configurable interval (default 5min)
- Uses a "judge" (Haiku 3.5 call) to determine if agent is stuck
- Three actions: `continue` (just slow), `nudge` (abort + redirect), `abort` (give up)
- Max 3 consecutive interventions before giving up
- Status bar indicator: 🐵 (active) / 🙈 (disabled)

**todos** (`extensions/todos.ts`):
- File-based todo system at `~/.pi/history/<project>/todos/`
- Each todo is a markdown file with JSON frontmatter
- Lock files prevent concurrent editing
- GC for closed todos older than 7 days
- Visual TUI manager via `/todos` command

**Other extensions**:
- `answer.ts` — Q&A UI for multiple questions (Ctrl+.)
- `branch.ts` — branch management
- `cost.ts` — API cost tracking across sessions
- `execute-command.ts` — self-invoke slash commands
- `ghostty.ts` — terminal title + progress bar
- `review.ts` — code review workflow
- `cmux/index.ts` — context-aware terminal multiplexer

### Packages (pi ecosystem plugins)

| Package | Purpose |
|---------|---------|
| [pi-subagents](https://github.com/HazAT/pi-subagents) | `subagent` tool for delegation with chains |
| [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) | MCP server integration |
| [pi-smart-sessions](https://github.com/HazAT/pi-smart-sessions) | AI-generated session names |
| [pi-parallel](https://github.com/HazAT/pi-parallel) | Web search, extract, research, enrich tools |
| [glimpse](https://github.com/HazAT/glimpse) | Native macOS UI (dialogs, forms, charts) |
| [pi-cmux](https://github.com/sasha-computer/pi-cmux) | Terminal multiplexer integration |

### Skills Inventory

| Skill | Trigger | Key Detail |
|-------|---------|------------|
| brainstorm | Planning new features | Full 8-phase pipeline, mandatory phases |
| commit | Every git commit | Conventional Commits, polished messages mandatory |
| learn-codebase | New project onboarding | Scans convention files + security sweep |
| skill-creator | Creating new skills | Follows Agent Skills specification |
| code-simplifier | Refactoring/cleanup | From getsentry/skills |
| frontend-design | Web components | — |
| github | gh CLI operations | From mitsuhiko/agent-stuff |
| review-rubric | Code review guidelines | Shared by /review and reviewer agent |
| session-reader | Reading JSONL sessions | Has Python script for parsing |
| tmux | Interactive CLI driving | Has shell scripts |
| visual-tester | Visual QA testing | Chrome CDP integration |
| presentation-creator | Data-driven slides | React + Vite + Recharts |
| cmux | Terminal multiplexer | Context-aware notifications |
| add-mcp-server | MCP server setup | Global or project-local config |

### Core Principles (from AGENTS.md)

1. **Proactive Mindset** — explore before asking, treat user's time as precious
2. **Professional Objectivity** — no excessive praise, honest feedback
3. **Keep It Simple** — no over-engineering, minimum complexity
4. **Think Forward** — no backwards-compat, no legacy shims in product code
5. **Read Before You Edit** — never modify unread code
6. **Try Before Asking** — check if tools exist by running them
7. **Test As You Build** — verify each step
8. **Verify Before Claiming Done** — evidence before assertions
9. **Investigate Before Fixing** — no shotgun debugging
10. **Thoughtful Questions** — only ask what requires human judgment

### History & Archiving

All agent working files are archived to `~/.pi/history/<project>/`:
```
~/.pi/history/<project>/
  plans/                  # Brainstorm plans
  todos/                  # Todo files
  scouts/                 # Scout context snapshots
  reviews/                # Code reviews
  research/               # Research findings
  visual-tests/           # Visual test reports
  claude-sessions.json    # Claude Code session index
```

Working copies live in `<project>/.pi/` during execution and get cleaned up by workers.

## Key Patterns Worth Adopting

### 1. Scout-First Pattern
Run a cheap fast model (Haiku) to gather context before expensive workers (Sonnet/Opus). Workers get scout context pre-loaded in their task prompt, avoiding redundant codebase exploration.

### 2. Mandatory Phase Enforcement
The brainstorm skill explicitly warns against skipping phases: "Your judgment that something is 'simple' is NOT sufficient to skip steps." Only explicit user permission allows shortcuts.

### 3. Watchdog Extension
A background monitor that uses a cheap judge model to detect stuck agents and intervene — nudge with new direction, or abort to save resources.

### 4. File-Based Todo System
Todos as individual markdown files with JSON frontmatter, lock files for concurrency, GC for old items. Each worker claims → implements → commits → closes.

### 5. Sequential Workers, Never Parallel in Git
Explicitly called out: parallel workers in the same git repo cause commit conflicts. Always sequential.

### 6. Output Chain Handoff
The `output:` frontmatter field in agent definitions enables automatic context passing between chained agents (scout's context.md → worker, worker's review.md → reviewer).

### 7. Claude-as-Tool Integration
The `claude-tool` extension wraps Claude Code (via agent SDK) as a tool callable from within pi — with live streaming overlay, session persistence, and parallel execution support. But it's deliberately expensive and discouraged for routine work.

## Code References

- `context/pi-config/AGENTS.md` — Core system prompt, principles, delegation patterns
- `context/pi-config/settings.json` — Model defaults, packages, extension config
- `context/pi-config/agents/scout.md` — Scout agent definition
- `context/pi-config/agents/worker.md` — Worker agent definition
- `context/pi-config/agents/reviewer.md` — Reviewer agent (uses Codex 5.3)
- `context/pi-config/agents/researcher.md` — Research agent with parallel.ai tools
- `context/pi-config/agents/visual-tester.md` — Chrome CDP visual QA agent
- `context/pi-config/skills/brainstorm/SKILL.md` — Full brainstorm pipeline (8 phases)
- `context/pi-config/skills/commit/SKILL.md` — Mandatory commit skill
- `context/pi-config/skills/learn-codebase/SKILL.md` — Onboarding + security sweep
- `context/pi-config/skills/skill-creator/SKILL.md` — Skill scaffolding with Agent Skills spec
- `context/pi-config/extensions/claude-tool/index.ts` — Claude Code integration (1139 lines)
- `context/pi-config/extensions/watchdog.ts` — Stuck agent detection (343 lines)
- `context/pi-config/extensions/todos.ts` — File-based todo system
- `context/pi-config/setup.sh` — Installation script

## Architecture Insights

### Pi vs Claude Code Comparison

| Aspect | Pi (pi-config) | Claude Code (our setup) |
|--------|---------------|------------------------|
| Agent definitions | `agents/<name>.md` with `output:` field | `.agents/agents/<name>.md` |
| Skills | `skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| Extensions | TypeScript plugins with pi API | Not available (hooks only) |
| Subagent dispatch | `subagent` tool (pi-subagents package) | `Agent` tool (built-in) |
| Todo system | File-based extension (todos.ts) | Built-in TaskCreate/TaskUpdate |
| Context handoff | `output:` frontmatter + chain patterns | Agent results returned to parent |
| Watchdog | Custom extension polling + judge | Not available |
| Session persistence | JSONL + index JSON | Built-in session management |
| Package system | `pi install git:...` | Not available |
| Web research | parallel.ai tools (search, extract, research) | WebSearch, WebFetch |

### What We Already Have That's Similar
- Agent definitions (`.agents/agents/`) — same concept, similar format
- Skills (`.agents/skills/`) — same SKILL.md convention
- Research codebase workflow — similar to brainstorm phases 1-5
- Sub-agent delegation — similar to scout/worker pattern

### What We Could Adopt
1. **Watchdog-like monitoring** — via hooks (UserPromptSubmit, Stop) we could detect stuck patterns
2. **Scout-first pattern** — use Haiku agents for recon before Opus/Sonnet workers
3. **Mandatory commit skill** — enforce polished commit messages
4. **File-based todo archiving** — persist plans/research to `thoughts/` (we already do this)
5. **Sequential worker enforcement** — important for git repos

## Open Questions

1. How does pi's `output:` frontmatter actually pass context between chained agents? Is it automatic file reading or explicit injection?
2. What is "Codex 5.3" — is this an OpenAI model used for code review? Interesting cross-vendor approach.
3. The `pi-parallel` package provides web research tools — how do these compare to Claude Code's WebSearch/WebFetch?
4. Could we implement a watchdog equivalent using Claude Code hooks?
5. Should we adopt the scout-first pattern for our implementation workflow?
