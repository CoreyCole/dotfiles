---
date: 2026-01-12T08:51:00-08:00
researcher: CoreyCole
git_commit: f2fcbbe
branch: main
repository: dotfiles
topic: "Claude Code Hooks Analysis"
tags: [research, hooks, claude-code, logging, status-line]
status: complete
last_updated: 2026-01-12
last_updated_by: CoreyCole
---

# Research: Claude Code Hooks Analysis

**Date**: 2026-01-12T08:51:00-08:00
**Researcher**: CoreyCole
**Git Commit**: f2fcbbe
**Branch**: main
**Repository**: dotfiles

## Research Question
Evaluate all hooks in the home directory and detail the purpose of each hook.

## Summary
Three hooks are configured in `~/.claude/settings.json`, plus a status line script that works in conjunction with the hooks. All hooks follow a consistent pattern: they read JSON input from stdin, log data to `~/.claude/logs/`, and exit gracefully on errors. The hooks create a telemetry/logging system for Claude Code sessions.

## Detailed Findings

### 1. session_start.py
**Location**: `~/.claude/hooks/session_start.py`
**Trigger**: `SessionStart` event (when a new Claude Code session begins)
**Purpose**: Logs session initialization data for auditing/debugging.

**Behavior**:
- Reads JSON input from stdin containing session metadata
- Appends the entire input payload to `~/.claude/logs/session_start.json`
- Creates the logs directory if it doesn't exist
- Handles JSON decode errors gracefully (exits 0)

**Log Output**: `~/.claude/logs/session_start.json` (currently 391KB)

### 2. stop_hook.py
**Location**: `~/.claude/hooks/stop_hook.py`
**Trigger**: `Stop` event (when Claude finishes responding)
**Purpose**: Logs stop/completion events with timestamps.

**Behavior**:
- Reads JSON input from stdin containing stop event data
- Creates a log entry with ISO timestamp and input data
- Appends to `~/.claude/logs/stop_hook.json`
- Creates the logs directory if it doesn't exist
- Handles errors gracefully

**Log Output**: `~/.claude/logs/stop_hook.json` (currently 1.1MB - largest log)

### 3. user_prompt_submit.py
**Location**: `~/.claude/hooks/user_prompt_submit.py`
**Trigger**: `UserPromptSubmit` event (when user submits a prompt)
**Purpose**: Dual-purpose - logs all prompts AND stores last prompt for status line display.

**Behavior**:
- Reads JSON input from stdin containing prompt and session_id
- Logs full input to `~/.claude/logs/user_prompt_submit.json`
- When called with `--store-last-prompt` flag (as configured):
  - Stores prompts in per-session files at `~/.claude/data/sessions/{session_id}.json`
  - This enables the status line to show the current prompt
- Handles errors gracefully

**Log Output**: `~/.claude/logs/user_prompt_submit.json` (currently 2.1MB - most detailed log)

### Related: status_line.py
**Location**: `~/.claude/status_lines/status_line.py`
**Trigger**: Status line refresh (continuous during sessions)
**Purpose**: Displays contextual status line with model name and current prompt.

**Behavior**:
- Reads session data from `~/.claude/data/sessions/{session_id}.json` (populated by user_prompt_submit.py)
- Generates a formatted status line with:
  - Model name in cyan (e.g., `[Claude]`)
  - Context-aware emoji based on prompt type:
    - `/` commands: lightning bolt
    - Questions: question mark
    - Create/build requests: lightbulb
    - Fix/debug requests: bug
    - Refactor requests: recycle
    - Other: speech bubble
  - Truncated prompt text (max 400 chars)
- Logs status line events to `~/logs/status_line.json` (note: different path!)

## Code References

| File | Lines | Description |
|------|-------|-------------|
| `~/.claude/hooks/session_start.py:21-43` | Logging function |
| `~/.claude/hooks/stop_hook.py:21-52` | Main logging logic with timestamp |
| `~/.claude/hooks/user_prompt_submit.py:22-44` | Prompt logging function |
| `~/.claude/hooks/user_prompt_submit.py:47-74` | Last prompt storage for status line |
| `~/.claude/status_lines/status_line.py:83-99` | Prompt icon selection logic |
| `~/.claude/status_lines/status_line.py:119-157` | Status line generation |

## Architecture Insights

### Hook Configuration
All hooks are configured in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/user_prompt_submit.py --store-last-prompt"}]}],
    "SessionStart": [{"matcher": "", "hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/session_start.py"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/stop_hook.py"}]}]
  }
}
```

### Common Patterns
1. **PEP 723 inline script metadata**: All hooks use `# /// script` comments for uv dependency management
2. **Graceful error handling**: All hooks exit 0 on any error to avoid blocking Claude
3. **JSON accumulation**: Logs append to arrays in JSON files rather than overwriting
4. **dotenv support**: Optional environment variable loading (currently unused)

### Data Flow
```
User submits prompt
    |
    v
UserPromptSubmit hook
    |
    +-> logs/user_prompt_submit.json (full audit log)
    +-> data/sessions/{id}.json (for status line)
    |
    v
Claude processes
    |
    v
Stop hook
    |
    +-> logs/stop_hook.json (completion audit)
    |
    v
Status line reads sessions/{id}.json
    |
    +-> Displays current prompt in terminal
```

### Log File Sizes (as of 2026-01-12)
| File | Size | Purpose |
|------|------|---------|
| `session_start.json` | 391 KB | Session initializations |
| `stop_hook.json` | 1.1 MB | Completion events (largest) |
| `user_prompt_submit.json` | 2.1 MB | All user prompts |
| `status_line.json` | 267 KB | Status line events |

## Open Questions
1. **Log rotation**: No log rotation is implemented - files will grow indefinitely
2. **Status line log path**: `status_line.py` logs to `~/logs/` instead of `~/.claude/logs/` - likely a bug
3. **Unused dotenv**: All hooks import dotenv but don't appear to use any environment variables
4. **Session cleanup**: Old session files in `~/.claude/data/sessions/` are never cleaned up
