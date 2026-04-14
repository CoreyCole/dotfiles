---
date: 2026-04-09T11:20:41-0700
researcher: CoreyCole
stage: research
plan_dir: "thoughts/CoreyCole/plans/2026-04-09_claude-session-reader-skill"
---

# Research: Claude Session Format and CLI Structure

## Answers

### 1. How should the Go module and Cobra CLI be structured in the dotfiles repo?

No Go code exists in the dotfiles repo currently. The only Makefile is `nixos-config/Makefile`.

Go is installed via nix-darwin at `nix-darwin-config/flake.nix:24` (`pkgs.go`), version `go1.25.2 darwin/arm64`. GOPATH is `/Users/coreycole/go` with no GOBIN override (defaults to `$GOPATH/bin`).

The command name `c` is not shadowed — `which c` returns nothing.

There is no existing shell config (`.zshrc`, `.zprofile`) tracked in the dotfiles repo root — PATH setup likely lives in nix-darwin config or is sourced from elsewhere.

`fzf` is installed at `/opt/homebrew/bin/fzf` version `0.66.0`.

### 2. How does Claude Code map working directories to session storage paths?

The encoding is **simple string replacement**: replace every `/` in the absolute path with `-`. This produces a leading `-` since paths start with `/`.

Verified against all 16 project directories in `~/.claude/projects/`:

| Path | Directory Name |
|------|---------------|
| `/Users/coreycole` | `-Users-coreycole` |
| `/Users/coreycole/dotfiles` | `-Users-coreycole-dotfiles` |
| `/Users/coreycole/cn/chestnut-flake/monorepo` | `-Users-coreycole-cn-chestnut-flake-monorepo` |
| `/Users/coreycole/cn/chestnut-flake/monorepo/frontend/apps/web` | `-Users-coreycole-cn-chestnut-flake-monorepo-frontend-apps-web` |

The mapping is: `path.replace("/", "-")`. 100% consistent across all observed directories.

Session files within each project dir are named `<UUID>.jsonl` (e.g., `d5c1149b-4462-4fa5-a11e-ed8e57fe9873.jsonl`).

### 3. (was #4) What is the exact JSONL schema for Claude Code sessions?

Each line is a JSON object with a top-level `type` field. Observed types across all dotfiles sessions:

| Type | Purpose | Key Fields |
|------|---------|------------|
| `progress` | Hook execution, agent progress | `data.type` (`hook_progress`, `agent_progress`), `timestamp` |
| `file-history-snapshot` | File backup snapshots | `messageId`, `snapshot.trackedFileBackups`, `snapshot.timestamp` |
| `user` | User messages | `message.role="user"`, `message.content` (string or array) |
| `assistant` | Model responses | `message.role="assistant"`, `message.content` (array), `message.model`, `message.usage` |
| `system` | System events | `subtype` (`turn_duration`, `bridge_status`, `local_command`), `durationMs` |
| `last-prompt` | Last prompt cache | `lastPrompt`, `sessionId` |
| `queue-operation` | Queued user messages | `operation` ("enqueue"), `content` (the queued text) |

**User messages (`type: "user"`):**
- `message.content` can be a **plain string** (common for first messages, e.g., `"@file.md do something"`)
- `message.content` can be a **list** containing:
  - `{type: "text", text: "..."}` — user text
  - `{type: "tool_result", tool_use_id: "...", content: "...", is_error: false}` — tool results (string content, NOT nested in a content array like pi)
  - `{type: "image", source: {type: "base64", media_type: "image/png"}}` — images
- Additional top-level fields: `uuid`, `parentUuid`, `timestamp`, `sessionId`, `version`, `gitBranch`, `cwd`, `permissionMode`, `promptId`

**Assistant messages (`type: "assistant"`):**
- `message.content` is always an **array** containing:
  - `{type: "thinking", thinking: "...", signature: "..."}` — thinking blocks (signatures are opaque base64)
  - `{type: "text", text: "..."}` — response text
  - `{type: "tool_use", id: "toolu_...", name: "ToolName", input: {...}}` — tool calls
- Tool names observed: `Bash`, `Read`, `Agent`, `Glob` (capitalized, unlike pi)
- `message.model`: e.g., `"claude-opus-4-6"`, `"claude-haiku-4-5-20251001"`
- `message.stop_reason`: `"tool_use"`, `null`, `"end_turn"`
- `message.usage`: `{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, service_tier, inference_geo}` — **no cost field** (cost is always `{}`)
- Multiple assistant lines can share the same `requestId` and `message.id` (streaming chunks reassembled as separate lines)

**Key difference from pi format:**
- Pi: tool results are separate `message` entries with `role: "toolResult"`
- Claude: tool results are **embedded inside `user` messages** as `{type: "tool_result"}` content items
- Pi: content is at `line.message.content`
- Claude: content is at `line.message.content` (same nesting) BUT the outer object uses `type: "user"/"assistant"` instead of `type: "message"`

### 4. (was #5) How reliable is sessions-index.json vs scanning actual .jsonl files?

**Highly unreliable in both directions.** For the dotfiles project:

- **Index has 8 entries**, but **all 8 referenced files are missing** from disk (the `.jsonl` files no longer exist)
- **4 actual `.jsonl` files exist on disk**, but **none appear in the index**

This means:
- The index is stale — entries reference deleted session files
- New sessions are created without being added to the index (or the index is rebuilt periodically and out of sync)
- **Cannot rely on the index alone** — must scan actual `.jsonl` files on disk
- **Index metadata is valuable when present** (summary, firstPrompt, messageCount, gitBranch, dates, isSidechain)

**Recommended discovery strategy:** Scan `*.jsonl` files in the project directory. Optionally cross-reference with `sessions-index.json` for metadata enrichment (summary, firstPrompt) when available, but fall back to parsing the JSONL header for sessions not in the index.

### 5. (was #6) What content from a Claude session is useful as pi context, and what is noise?

**Noise types** (observed counts from a 182-line session):
- `progress`: 93 lines (84 `agent_progress` + 9 `hook_progress`) — subagent streaming progress, hook execution status. Pure noise.
- `file-history-snapshot`: 10 lines — file backup metadata. Noise.
- `system`: 3 lines — `turn_duration`, `bridge_status`, `local_command`. Noise.
- `last-prompt`: 1 line — cached last prompt. Noise.
- `queue-operation`: 2 lines — queued messages. Could be noise or context (contains user text).

**Signal types:**
- `user` with string content: 7 lines — actual user prompts
- `user` with `text` content items: 2 lines — user text
- `user` with `tool_result` items: 22 lines — tool outputs (can be huge, 10K+ chars)
- `assistant` with `text`: 17 lines — model responses
- `assistant` with `tool_use`: 22 lines — tool calls (names + arguments)
- `assistant` with `thinking`: 3 lines — thinking (opaque signatures, text sometimes empty)
- `user` with `image` items: 2 lines — base64 images (very large, should be omitted or noted as "[image]")

**Content to include:** user text, assistant text, tool call names/arguments (summarized), key tool results (truncated).
**Content to exclude:** progress, file-history-snapshot, system, last-prompt, thinking signatures, base64 images, large tool results (truncate or summarize).

### 6. (was #7) How should the CLI handle session selection UX?

`fzf` is available at `/opt/homebrew/bin/fzf` version `0.66.0`. This is the simplest path for interactive selection — pipe session metadata to `fzf` with `--preview`.

The `sessions-index.json` provides per-session metadata when available:
- `summary` — AI-generated session summary (e.g., "Tmux Setup & DB Connections Config")
- `firstPrompt` — first user message (truncated with `…`)
- `messageCount` — number of messages
- `created` / `modified` — ISO timestamps
- `gitBranch` — branch at time of session
- `isSidechain` — whether session is a sidechain

For sessions not in the index, metadata must be extracted from the JSONL file itself:
- First `user` line's `message.content` → first prompt
- First `user` line's `timestamp` → created date
- First `user` line's `gitBranch` → branch
- Line count → approximate message count

### 7. (was #8) How does pi accept initial context and prompts?

From `pi --help`:

- **`@file` references:** `pi @context.md "Continue this work"` — includes file contents in the initial message
- **Inline messages:** `pi "List all .ts files in src/"` — initial prompt text
- **`--append-system-prompt <text>`** — appends text or file contents to system prompt
- **`--session <path>`** — use a specific session file
- **`--fork <path>`** — fork a specific session file into a new session
- **`-c` / `--continue`** — continue previous session
- **`-r` / `--resume`** — select a session to resume
- **`--skill <path>`** — load a skill file or directory

Best approach for injecting a Claude session context document: write a temporary markdown file, then launch `pi @/tmp/claude-session-context.md "Continue this work from Claude"`. The `--append-system-prompt` could also work for background context.

### 8. (was #9) How should subagent sessions be handled in the context output?

Claude uses `Agent` tool calls (observed with `name: "Agent"` in `tool_use` content items). The agent's prompt is in `input.prompt`. Agent results come back as `tool_result` items inside subsequent `user` messages.

From the monorepo session, Agent tool_result content can be very large (5K-11K chars) and contains the full agent response text as a string.

`progress` events with `data.type: "agent_progress"` contain streaming subagent activity — these include the subagent's messages (user prompts, assistant tool calls) as nested objects in `data.message`. These are the 84 progress lines in the 182-line session — pure streaming noise for context purposes.

The Agent `tool_use` input contains the delegation prompt. The `tool_result` contains the agent's final answer. For context output, include the Agent prompt and a truncated version of the result.

### 9. (was #10) What other subcommands might cctl eventually host?

I could not determine this from the codebase. No planning documents, roadmap files, or TODO lists reference future `cctl` subcommands. The questions.md context mentions it's a "general dotfiles/workflow Swiss army knife" but no specifics are in the repo.

The existing dotfiles repo contains:
- `nixos-config/` and `nix-darwin-config/` — system configuration
- `neovim-config/` — editor config
- `.pi-config/skills/` — pi skills (session-reader, etc.)
- `.agents/skills/` — shared agent skills (arch, datastar, qrspi pipeline, etc.)
- `thoughts/` — planning documents
- Various shell scripts (`setup-tmux.sh`, `spec_metadata.sh`)

## Surprises

- **sessions-index.json is completely out of sync** — 100% of index entries reference missing files, and 100% of actual files are not in the index. The index cannot be used as primary discovery.
- **Claude does not include per-message costs** in the usage block — the `cost` field is always `{}`. Cost computation would require knowing the model's pricing and calculating from token counts.
- **Assistant messages can be split across multiple JSONL lines** sharing the same `requestId` and `message.id` — likely from streaming reassembly. A thinking-only chunk precedes a text-only or tool_use chunk.
- **`progress` events dominate sessions** — 93 of 182 lines (51%) in one session were progress events. Filtering these is critical for performance.
- **Tool results in Claude are plain strings** (not arrays of content items like pi). The `content` field on `tool_result` items is directly a string.
- **User message `content` can be either a string or an array** — must handle both cases.
- **Claude tool names are capitalized** (`Bash`, `Read`, `Agent`, `Glob`) unlike pi (`bash`, `read`).

## Code References

- `~/.claude/projects/-Users-coreycole-dotfiles/d5c1149b-4462-4fa5-a11e-ed8e57fe9873.jsonl` — 18-line session, good for schema study
- `~/.claude/projects/-Users-coreycole-dotfiles/93e115e7-877a-4e11-9051-f73f5bad3fdd.jsonl` — 182-line session with agent_progress, images, queue-operations
- `~/.claude/projects/-Users-coreycole-dotfiles/sessions-index.json` — stale index (8 entries, 0 matching files)
- `.pi-config/skills/session-reader/scripts/read_session.py` — 668-line pi session parser, patterns for turn extraction and display modes
- `.pi-config/skills/session-reader/references/session-format.md` — pi JSONL format docs (different from Claude format)
- `.pi-config/skills/session-reader/SKILL.md` — pi session reader skill structure, model for the Claude equivalent
- `nix-darwin-config/flake.nix:24` — Go installed via nix (`pkgs.go`)
- `nix-darwin-config/flake.nix:61` — typescript-go also present
