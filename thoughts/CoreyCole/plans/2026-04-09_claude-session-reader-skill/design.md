---
date: 2026-04-09T12:45:00-0700
researcher: CoreyCole
stage: design
plan_dir: "thoughts/CoreyCole/plans/2026-04-09_claude-session-reader-skill"
---

# Design: cctl `c resume` — Unified Session Picker

## Executive Summary

Build a Go CLI (`cctl`, aliased as `c`) in the dotfiles repo. The first subcommand `c resume` presents a unified fzf list of both pi and Claude Code sessions for the current working directory, labeled by source. Picking a pi session launches `pi --fork <path>`. Picking a Claude session **converts its JSONL to pi's session format** and launches `pi --fork <tempfile>`. Both paths result in a native pi session — no markdown rendering, no special context injection.

## Current State

No Go code exists in the dotfiles repo. Go 1.25.2 is installed via nix-darwin (`nix-darwin-config/flake.nix:24`). The `c` command name is unoccupied. fzf 0.66.0 is available.

**Pi sessions** live at `~/.pi/agent/sessions/--<path-with-dashes>--/<timestamp>_<uuid>.jsonl`. Encoding: double-dash prefix and suffix, slashes become single dashes. Filenames contain ISO timestamps. Pi supports `--fork <path>` to fork into a new session.

**Claude sessions** live at `~/.claude/projects/<encoded-path>/<uuid>.jsonl`. Encoding: `path.replace("/", "-")` — single-dash prefix, no suffix. Filenames are bare UUIDs — timestamps must be extracted from the first `user` line's `timestamp` field. `sessions-index.json` is completely unreliable (research: 100% stale).

**Key format differences** (from research and `.pi-config/skills/session-reader/references/session-format.md`):

| Aspect | Pi | Claude |
|--------|-----|--------|
| Conversation line type | `type: "message"` | `type: "user"` / `"assistant"` |
| Tool results | Separate `role: "toolResult"` entries | Embedded inside `user` messages as `{type: "tool_result"}` |
| Tool call content type | `{type: "toolCall"}` | `{type: "tool_use"}` |
| Tool names | lowercase (`bash`, `read`, `edit`) | Capitalized (`Bash`, `Read`, `Edit`) |
| Content field | Always an array | String or array |
| Session header | `type: "session"` first line | None |
| Noise types | None significant | `progress` (51% of lines), `file-history-snapshot`, `system`, `last-prompt` |
| Thinking | `{type: "thinking", thinking: "..."}` | `{type: "thinking", thinking: "...", signature: "..."}` |
| Streaming | One line per message | Multiple lines can share `message.id` |

## Desired End State

From any directory, run `c resume` to:

1. See a fzf list of all sessions (pi and Claude), sorted by date, labeled `[pi]` or `[claude]`
2. Pick one
3. **Pi session** → `pi --fork <path>` (native fork)
4. **Claude session** → convert JSONL to pi format, write temp file, `pi --fork <tempfile>`

Both paths give you a native pi session with full conversation history.

## Patterns to Follow

- **Cobra CLI structure**: `cctl/cmd/root.go`, `cctl/cmd/resume.go`, `cctl/main.go`
- **fzf for selection**: shell out to fzf. Already in the workflow.
- **`pi --fork`**: forks session into a new session. Works for both real pi sessions and our converted temp files.
- **Filter noise aggressively for Claude**: skip `progress`, `file-history-snapshot`, `system`, `last-prompt`, `queue-operation`.

## Patterns to Avoid

- **Don't use sessions-index.json**: 100% stale. Scan `.jsonl` files directly.
- **Don't render markdown**: convert to pi format instead — pi gets a proper session, not a text dump.
- **Don't include base64 images**: replace with `[image omitted]` text placeholder.
- **Don't compute costs**: Claude's `cost` field is always `{}`. Synthesize empty/zero usage for converted messages.

## Approach A: Convert Claude JSONL → Pi JSONL, Fork (Recommended)

The core insight: Claude's session format maps cleanly to pi's format. Instead of rendering markdown and hoping pi understands the context, we **translate the JSONL** so pi sees a real session with proper message threading, tool calls, and tool results.

**Translation rules:**

1. **Session header** — synthesize a `type: "session"` line with `version: 3`, UUID from Claude filename, timestamp from first user message, `cwd` from the user message's `cwd` field.

2. **User messages** — Claude `type: "user"` becomes pi `type: "message"` with `role: "user"`. Normalize string content to `[{type: "text", text: "..."}]`. Extract any `tool_result` items out into separate `toolResult` messages (see #4).

3. **Assistant messages** — Claude `type: "assistant"` becomes pi `type: "message"` with `role: "assistant"`. Map `tool_use` → `toolCall` (rename `name` to lowercase, `input` → `arguments`). Map `text` → `text` (unchanged). Pass through `thinking` blocks. Merge streaming chunks sharing the same `message.id`. Carry over `model` and `usage` fields.

4. **Tool results** — Claude embeds `{type: "tool_result", tool_use_id, content}` inside user messages. Extract each into a separate pi line: `type: "message"`, `role: "toolResult"`, `toolCallId`, `toolName` (looked up from the corresponding `tool_use`), `content: [{type: "text", text: "..."}]`.

5. **Thinking** — pass through `thinking` type. Drop `signature` field (pi uses `thinkingSignature` but it's not required).

6. **Skip entirely**: `progress`, `file-history-snapshot`, `system`, `last-prompt`, `queue-operation`.

7. **Message IDs and threading** — generate sequential IDs, chain `parentId` to maintain conversation order.

Representative conversion:

```
Claude input (3 lines):
  {"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_01X","name":"Read","input":{"file_path":"/foo.md"}}]}}
  {"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01X","content":"file contents here"},{"type":"text","text":"now edit it"}]}}

Pi output (3 lines):
  {"type":"message","id":"msg-2","parentId":"msg-1","message":{"role":"assistant","content":[{"type":"toolCall","id":"toolu_01X","name":"read","arguments":{"file_path":"/foo.md"}}]}}
  {"type":"message","id":"msg-3","parentId":"msg-2","message":{"role":"toolResult","toolCallId":"toolu_01X","toolName":"read","content":[{"type":"text","text":"file contents here"}]}}
  {"type":"message","id":"msg-4","parentId":"msg-3","message":{"role":"user","content":[{"type":"text","text":"now edit it"}]}}
```

**Launch**: write converted JSONL to `/tmp/cctl-claude-<uuid>.jsonl`, then `exec pi --fork /tmp/cctl-claude-<uuid>.jsonl`.

## Approach B: Markdown Context via @file (Previous Design)

Render the conversation as markdown, launch `pi @file.md`. Pi reads it as text context.

Downsides:
- Pi sees a text document, not a session — no message structure, no tool call history
- Can't "continue" the conversation naturally — it's just a wall of text in the first message
- Loses the back-and-forth structure that helps the model understand what happened

Not recommended now that we know the format translation is clean.

## Decision

Going with Approach A (JSONL conversion + fork) because:
1. Pi gets a proper session with message threading, tool calls, and results
2. The model sees structured conversation history, not a markdown summary
3. `pi --fork` is the native mechanism for this — no hacks
4. The format mapping is clean and well-understood from research

## Resolved Decisions

- **Command**: `c resume`. Unified across pi and Claude sources.
- **Pi sessions**: `pi --fork <path>` directly.
- **Claude sessions**: convert JSONL → pi format, write temp file, `pi --fork <tempfile>`.
- **Session discovery**: scan `*.jsonl` files in both directories. Ignore `sessions-index.json`.
- **Sorting**: all sessions merged by date, newest first.
- **Labels**: `[pi]` and `[claude]` prefixes in fzf list.
- **Path encoding**: Pi `--path--`, Claude `-path`. Handle both.
- **Pi timestamp**: from filename. Claude timestamp: from first `user` line's `timestamp` field, fallback to file mtime.
- **Tool name mapping**: `Read`→`read`, `Bash`→`bash`, `Edit`→`edit`, `Glob`→`glob`, `Agent`→`subagent`.
- **Content normalization**: string → `[{type: "text", text: "..."}]`.
- **Tool result extraction**: pull `tool_result` items out of Claude user messages into separate pi `toolResult` lines.
- **Streaming chunks**: merge Claude assistant lines sharing the same `message.id` by concatenating content arrays.
- **Message IDs**: generate sequential (`msg-1`, `msg-2`, ...) with `parentId` chaining.
- **Build/install**: `go install ./cctl`, binary in `$GOPATH/bin`.
- **Temp file**: `/tmp/cctl-claude-<session-uuid>.jsonl`.

## Open Questions

1. **Should `c resume` support `--print` to dump the converted pi JSONL to stdout?** Useful for debugging the conversion.
