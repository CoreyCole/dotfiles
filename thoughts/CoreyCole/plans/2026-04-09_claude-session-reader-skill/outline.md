---
date: 2026-04-09T13:30:00-0700
researcher: CoreyCole
stage: outline
plan_dir: "thoughts/CoreyCole/plans/2026-04-09_claude-session-reader-skill"
---

# Outline: cctl `c resume` — Unified Session Picker

## Overview

Build a Go CLI (`cctl`) in `dotfiles/cctl/`. The core `convert` package translates Claude Code JSONL sessions into pi's JSONL format. A `testdata/` directory contains handcrafted Claude input fixtures and expected pi output, validated by unit tests covering every edge case discovered in real sessions. The `session` package discovers sessions from both pi and Claude dirs. The `cmd/resume` subcommand ties it together with fzf selection and `pi --fork` launch.

## Edge Cases Discovered (from real session audit)

### Types to skip (noise)
- `progress` (subtypes: `hook_progress`, `agent_progress`, `bash_progress`, `query_update`, `search_results_received`, `waiting_for_task`)
- `file-history-snapshot`
- `system`
- `last-prompt`
- `queue-operation`
- `attachment` (subtypes: `deferred_tools_delta`, `hook_non_blocking_error`, `nested_memory`, `task_reminder`, `hook_success`, `skill_listing`, `diagnostics`, `ultrathink_effort`, `command_permissions`, `hook_cancelled`, `file`, `companion_intro`)
- `custom-title`
- `agent-name`
- `permission-mode`

### Tool names (all observed, with pi mappings)
| Claude Name | Pi Name | Count | Notes |
|------------|---------|-------|-------|
| Read | read | 22,898 | |
| Grep | grep | 21,266 | Not in pi — map to `bash` wrapper or pass through as `grep` |
| Bash | bash | 9,804 | |
| Glob | glob | 5,123 | |
| Edit | edit | 2,001 | |
| Agent | subagent | 664 | Subagent delegation |
| Write | write | 548 | |
| WebSearch | web_search | 621 | |
| WebFetch | web_fetch | 629 | |
| TaskCreate | task_create | 220 | Parallel task creation |
| TaskUpdate | task_update | 526 | Task status update |
| TaskOutput | task_output | 36 | Task result retrieval |
| TaskStop | task_stop | 3 | |
| Skill | skill | 212 | |
| ToolSearch | tool_search | 167 | |
| AskUserQuestion | ask_user | 46 | |
| ExitPlanMode | exit_plan_mode | 50 | |
| EnterPlanMode | enter_plan_mode | 1 | |
| EnterWorktree | enter_worktree | 0 | Defined but unused |
| ExitWorktree | exit_worktree | 0 | Defined but unused |
| CronCreate | cron_create | 1 | |
| CronDelete | cron_delete | 1 | |
| TaskList | task_list | 1 | |
| NotebookEdit | notebook_edit | 0 | Defined but unused |

**Strategy:** Lowercase the Claude name as-is (`strings.ToLower`). Special case only `Agent` → `subagent`. Pi doesn't validate tool names on fork — it just sees historical data.

### Content edge cases
1. **User `content` can be string (5,091) or array (65,882)** — must normalize string → `[{type:"text", text:"..."}]`
2. **Assistant `content` is always array** (91,398/91,398)
3. **Tool result `content` can be string (64,106) or list (824)** — list form is `[{type:"text", text:"..."}]`, mostly from Agent results
4. **Image content items** (122 occurrences) — `{type:"image", source:{type:"base64",...}}` → replace with `{type:"text", text:"[image omitted]"}`
5. **Document content items** (23 occurrences) — `{type:"document", source:{type:"base64", media_type:"application/pdf",...}}` → replace with `{type:"text", text:"[document omitted]"}`
6. **`is_error` on tool_result** — map to `isError: true` on pi toolResult message
7. **`caller` field on tool_use** — always `{type:"direct"}`, ignore

### Streaming merge patterns
- **68% of assistant message IDs appear >1 time** (22,412 of 32,657 unique IDs)
- Common patterns:
  - `thinking → text` (144 occurrences)
  - `text → tool_use` (1,583 — most common)
  - `thinking → text → tool_use` (524)
  - `thinking → tool_use` (231)
  - `tool_use → tool_use → ... → tool_use` (up to 48 chunks for parallel tool calls)
- **Last line always has max `output_tokens`** — use last line's `usage`, `model`, `stop_reason`
- **108/3504 merged groups have `stop_reason=None` on last line** — handle gracefully

### Subagent / Task handling
- **Agent tool calls**: `input.prompt` is the delegation prompt. The tool_result contains the agent's summary (string or `[{type:"text"}]` list, 5K-11K chars).
- **TaskCreate**: `input.subject` + `input.description` (not `input.prompt`). Result is "Task #N created successfully: ..."
- **TaskOutput/TaskUpdate/TaskStop**: task management tools. Results are task status strings.
- **Subagent JSONL files**: stored at `<session-uuid>/subagents/agent-<hash>.jsonl` — must NOT be discovered as top-level sessions.
- **Conversion strategy**: Convert Agent/Task tool calls as regular tool calls (keep prompt in arguments, keep result). Don't inline subagent conversation — just the delegation prompt and final result.

### Session directory structure
- Pi: `~/.pi/agent/sessions/--<path-with-dashes>--/<timestamp>_<uuid>.jsonl`
- Claude: `~/.claude/projects/-<path-with-dashes>/<uuid>.jsonl`
- Claude also has `<uuid>/` directories (containing `subagents/`) alongside `<uuid>.jsonl` — only discover `.jsonl` files directly in the project dir, not in subdirectories.

## Type Definitions

```go
// cctl/pkg/convert/types.go

// --- Claude input types ---

type ClaudeLine struct {
    Type       string          `json:"type"`
    UUID       string          `json:"uuid"`
    ParentUUID string          `json:"parentUuid"`
    Timestamp  string          `json:"timestamp"`
    SessionID  string          `json:"sessionId"`
    CWD        string          `json:"cwd"`
    Message    *ClaudeMessage  `json:"message"`
}

type ClaudeMessage struct {
    Role       string          `json:"role"`
    Content    json.RawMessage `json:"content"` // string or []ClaudeContentItem
    Model      string          `json:"model"`
    ID         string          `json:"id"`      // for streaming dedup
    Usage      *ClaudeUsage    `json:"usage"`
    StopReason *string         `json:"stop_reason"`
}

type ClaudeUsage struct {
    InputTokens  int `json:"input_tokens"`
    OutputTokens int `json:"output_tokens"`
}

type ClaudeContentItem struct {
    Type      string          `json:"type"`       // text, tool_use, tool_result, thinking, image, document
    Text      string          `json:"text"`
    ID        string          `json:"id"`         // tool_use id
    Name      string          `json:"name"`       // tool_use name (Capitalized)
    Input     json.RawMessage `json:"input"`      // tool_use arguments
    ToolUseID string          `json:"tool_use_id"` // tool_result backref
    Content   json.RawMessage `json:"content"`    // tool_result content (string or [{type:"text"}])
    IsError   bool            `json:"is_error"`
    Thinking  string          `json:"thinking"`
    Signature string          `json:"signature"`  // drop on conversion
    Source    json.RawMessage `json:"source"`     // image/document source (skip)
}

// --- Pi output types ---

type PiLine struct {
    Type      string     `json:"type"`
    Version   int        `json:"version,omitempty"`
    ID        string     `json:"id,omitempty"`
    ParentID  string     `json:"parentId,omitempty"`
    Timestamp string     `json:"timestamp,omitempty"`
    CWD       string     `json:"cwd,omitempty"`
    Message   *PiMessage `json:"message,omitempty"`
}

type PiMessage struct {
    Role       string          `json:"role"`
    Content    []PiContentItem `json:"content"`
    Model      string          `json:"model,omitempty"`
    Provider   string          `json:"provider,omitempty"`
    API        string          `json:"api,omitempty"`
    Usage      *PiUsage        `json:"usage,omitempty"`
    StopReason string          `json:"stopReason,omitempty"`
    ToolCallID string          `json:"toolCallId,omitempty"`
    ToolName   string          `json:"toolName,omitempty"`
    IsError    bool            `json:"isError,omitempty"`
    Timestamp  int64           `json:"timestamp,omitempty"`
}

type PiContentItem struct {
    Type      string          `json:"type"`                // text, toolCall, thinking
    Text      string          `json:"text,omitempty"`
    ID        string          `json:"id,omitempty"`        // toolCall id
    Name      string          `json:"name,omitempty"`      // toolCall name (lowercase)
    Arguments json.RawMessage `json:"arguments,omitempty"` // toolCall args
    Thinking  string          `json:"thinking,omitempty"`
}

type PiUsage struct {
    Input       int    `json:"input"`
    Output      int    `json:"output"`
    CacheRead   int    `json:"cacheRead"`
    CacheWrite  int    `json:"cacheWrite"`
    TotalTokens int    `json:"totalTokens"`
    Cost        PiCost `json:"cost"`
}

type PiCost struct {
    Input  float64 `json:"input"`
    Output float64 `json:"output"`
    Total  float64 `json:"total"`
}
```

```go
// cctl/pkg/session/types.go

type SessionInfo struct {
    Source  string    // "pi" or "claude"
    Path    string    // absolute path to .jsonl
    CWD     string    // working directory
    Date    time.Time // session timestamp
    Preview string    // first user message (truncated)
}
```

## Package / File Structure

```
cctl/
├── main.go
├── go.mod
├── VERSION                         # single integer, e.g. "1"
├── AGENTS.md                       # reminds agents to bump VERSION after changes
├── bin/                            # build output dir, added to PATH
│   └── cctl                        # compiled binary (gitignored)
├── cmd/
│   ├── root.go
│   └── resume.go
└── pkg/
    ├── selfupdate/
    │   └── selfupdate.go           # version check + rebuild + re-exec
    ├── convert/
    │   ├── convert.go          # ConvertSession, parseClaude, mergeStreamingChunks
    │   ├── convert_test.go
    │   ├── types.go
    │   ├── toolnames.go        # mapToolName
    │   └── testdata/
    │       ├── 01_simple_chat.claude.jsonl
    │       ├── 01_simple_chat.pi.jsonl
    │       ├── 02_tool_use_cycle.claude.jsonl
    │       ├── 02_tool_use_cycle.pi.jsonl
    │       ├── 03_streaming_merge.claude.jsonl
    │       ├── 03_streaming_merge.pi.jsonl
    │       ├── 04_noise_filtering.claude.jsonl
    │       ├── 04_noise_filtering.pi.jsonl
    │       ├── 05_string_content.claude.jsonl
    │       ├── 05_string_content.pi.jsonl
    │       ├── 06_image_and_document.claude.jsonl
    │       ├── 06_image_and_document.pi.jsonl
    │       ├── 07_thinking_blocks.claude.jsonl
    │       ├── 07_thinking_blocks.pi.jsonl
    │       ├── 08_agent_subagent.claude.jsonl
    │       ├── 08_agent_subagent.pi.jsonl
    │       ├── 09_task_tools.claude.jsonl
    │       ├── 09_task_tools.pi.jsonl
    │       ├── 10_error_tool_result.claude.jsonl
    │       ├── 10_error_tool_result.pi.jsonl
    │       ├── 11_multi_tool_streaming.claude.jsonl
    │       ├── 11_multi_tool_streaming.pi.jsonl
    │       ├── 12_tool_result_list_content.claude.jsonl
    │       └── 12_tool_result_list_content.pi.jsonl
    ├── session/
    │   ├── discover.go
    │   ├── discover_test.go
    │   └── types.go
    └── picker/
        └── fzf.go
```

### Auto-rebuild mechanism

- `cctl/VERSION` contains a single integer (e.g. `1`). Bump this file when making changes.
- At build time: `go build -ldflags "-X main.version=$(cat VERSION)" -o bin/cctl .`
- `~/dotfiles/cctl/bin` is added to `$PATH` (via nix-darwin or shell config).
- On every invocation, before dispatching the command, `root.go` calls `selfupdate.CheckAndRebuild()`:
  1. Read `VERSION` from the source dir (resolved relative to the binary's location: `../VERSION`)
  2. Compare to the compiled-in `main.version`
  3. If source version > compiled version: run `go build -ldflags ... -o bin/cctl .` from the source dir, then `syscall.Exec` the new binary with the same args
  4. If equal or source file missing: continue normally
- First run after `git pull` with a bumped VERSION auto-rebuilds. No manual step needed.

## Slices

### Slice 1: Types + simple chat conversion + test harness

**Files:** `cctl/go.mod` (new), `cctl/pkg/convert/types.go` (new), `cctl/pkg/convert/toolnames.go` (new), `cctl/pkg/convert/convert.go` (new), `cctl/pkg/convert/convert_test.go` (new), `cctl/pkg/convert/testdata/01_simple_chat.*.jsonl` (new)

**Signatures:**
```go
// pkg/convert/convert.go
func ConvertSession(input []byte) ([]byte, error)
func parseClaude(input []byte) ([]ClaudeLine, error)        // parse JSONL, skip noise types
func mergeStreamingChunks(lines []ClaudeLine) []ClaudeLine   // merge by message.id
func normalizeContent(raw json.RawMessage) ([]ClaudeContentItem, error) // string or array
func convertMessages(lines []ClaudeLine) ([]PiLine, error)  // main translation logic

// pkg/convert/toolnames.go
func mapToolName(claudeName string) string  // Agent→subagent, else strings.ToLower

// pkg/convert/convert_test.go
func TestSimpleChat(t *testing.T)
func loadTestData(t *testing.T, name string) (claude, expectedPi []byte) // helper
func comparePiOutput(t *testing.T, got, want []byte)                     // line-by-line JSON comparison
```

**Testdata — `01_simple_chat`:**
- Claude input: user message (string content "hello"), assistant reply (text "hi there"), with noise types interspersed
- Expected pi output: session header, user message (content normalized to array), assistant message
- Validates: session header synthesis, string→array normalization, sequential IDs, parentId chain, noise filtering

**Test checkpoint:** `cd cctl && go test ./pkg/convert/ -run TestSimpleChat` passes

---

### Slice 2: Tool use cycle (tool_use → tool_result extraction)

**Files:** `cctl/pkg/convert/convert.go` (modify), `cctl/pkg/convert/convert_test.go` (modify), `cctl/pkg/convert/testdata/02_tool_use_cycle.*.jsonl` (new)

**Signatures:**
```go
func extractToolResults(userItems []ClaudeContentItem) (textItems []ClaudeContentItem, toolResults []ClaudeContentItem)
func convertToolUse(item ClaudeContentItem) PiContentItem   // tool_use → toolCall
func convertToolResult(item ClaudeContentItem, toolNameLookup map[string]string) PiLine
```

**Testdata — `02_tool_use_cycle`:**
- Claude: assistant with `tool_use` (name:"Read", id:"toolu_01X"), then user with `[{type:"tool_result", tool_use_id:"toolu_01X", content:"file text"}, {type:"text", text:"now edit it"}]`
- Expected: assistant with toolCall, separate toolResult line, separate user text line
- Validates: tool_result extracted from user message, tool name lowercased, toolCallId threading, content string → pi content array

**Test checkpoint:** `go test ./pkg/convert/ -run TestToolUseCycle` — output has exactly 4 lines (session header + 3 messages)

---

### Slice 3: Streaming merge

**Files:** `cctl/pkg/convert/convert.go` (modify), `cctl/pkg/convert/convert_test.go` (modify), `cctl/pkg/convert/testdata/03_streaming_merge.*.jsonl` (new), `cctl/pkg/convert/testdata/11_multi_tool_streaming.*.jsonl` (new)

**Signatures:**
```go
// mergeStreamingChunks already defined in slice 1
// Key behavior: group by message.id, concatenate content arrays, take last line's usage/stop_reason/model
```

**Testdata — `03_streaming_merge`:**
- Claude: 2 assistant lines with same `message.id` — first has `[{type:"thinking"}]` stop=null, second has `[{type:"text"}]` stop="end_turn"
- Expected: single pi assistant message with `[thinking, text]`, usage from last line

**Testdata — `11_multi_tool_streaming`:**
- Claude: 3 assistant lines with same `message.id` — `[text]` → `[tool_use]` → `[tool_use]` (parallel tool calls)
- Expected: single pi assistant message with `[text, toolCall, toolCall]`

**Test checkpoint:** `go test ./pkg/convert/ -run TestStreamingMerge -run TestMultiToolStreaming`

---

### Slice 4: Content edge cases (string content, images, documents, thinking, error results, list tool_result)

**Files:** `cctl/pkg/convert/convert.go` (modify), `cctl/pkg/convert/convert_test.go` (modify), multiple testdata files (new)

**Testdata — `05_string_content`:**
- Claude: user with `content: "hello world"` (string, not array)
- Expected: pi user with `content: [{type:"text", text:"hello world"}]`

**Testdata — `06_image_and_document`:**
- Claude: user with `[{type:"text", text:"look at this"}, {type:"image", source:{...}}, {type:"document", source:{...}}]`
- Expected: pi user with `[{type:"text", text:"look at this"}, {type:"text", text:"[image omitted]"}, {type:"text", text:"[document omitted]"}]`

**Testdata — `07_thinking_blocks`:**
- Claude: assistant with `[{type:"thinking", thinking:"let me think", signature:"EoUC..."}]`
- Expected: pi assistant with `[{type:"thinking", thinking:"let me think"}]` — signature dropped

**Testdata — `10_error_tool_result`:**
- Claude: user with `[{type:"tool_result", tool_use_id:"toolu_X", content:"File too large", is_error:true}]`
- Expected: pi toolResult with `isError: true`

**Testdata — `12_tool_result_list_content`:**
- Claude: user with `[{type:"tool_result", tool_use_id:"toolu_X", content:[{type:"text", text:"agent summary"}]}]`
- Expected: pi toolResult with `content: [{type:"text", text:"agent summary"}]`

**Test checkpoint:** `go test ./pkg/convert/ -run TestStringContent -run TestImageAndDocument -run TestThinking -run TestErrorToolResult -run TestToolResultListContent`

---

### Slice 5: Agent and Task tools

**Files:** `cctl/pkg/convert/convert.go` (modify), `cctl/pkg/convert/convert_test.go` (modify), `cctl/pkg/convert/testdata/08_agent_subagent.*.jsonl` (new), `cctl/pkg/convert/testdata/09_task_tools.*.jsonl` (new)

**Testdata — `08_agent_subagent`:**
- Claude: assistant with `tool_use` (name:"Agent", input:{prompt:"investigate X"}), then user with tool_result (content: list `[{type:"text", text:"## Summary\n..."}]`)
- Expected: pi assistant with toolCall (name:"subagent", arguments:{prompt:"..."}), pi toolResult with content from the agent's summary
- Also includes `agent_progress` noise lines between — must be filtered

**Testdata — `09_task_tools`:**
- Claude: assistant with `tool_use` (name:"TaskCreate", input:{subject:"Fix bug", description:"..."}), tool_result "Task #1 created successfully"
- Then assistant with `tool_use` (name:"TaskOutput", input:{task_id:"1"}), tool_result with task output
- Expected: converted as regular tool calls — `taskcreate`, `taskoutput` names, arguments preserved

**Test checkpoint:** `go test ./pkg/convert/ -run TestAgentSubagent -run TestTaskTools`

---

### Slice 6: Noise filtering (comprehensive)

**Files:** `cctl/pkg/convert/convert_test.go` (modify), `cctl/pkg/convert/testdata/04_noise_filtering.*.jsonl` (new)

**Testdata — `04_noise_filtering`:**
- Claude session with ALL noise types interspersed: `progress` (hook_progress, agent_progress, bash_progress), `file-history-snapshot`, `system`, `last-prompt`, `queue-operation`, `attachment` (deferred_tools_delta, hook_non_blocking_error), `custom-title`, `agent-name`, `permission-mode`
- Plus one valid user message and one valid assistant reply
- Expected: session header + just the user and assistant messages

**Test checkpoint:** `go test ./pkg/convert/ -run TestNoiseFiltering` — output has exactly 3 lines

---

### Slice 7: Session discovery

**Files:** `cctl/pkg/session/types.go` (new), `cctl/pkg/session/discover.go` (new), `cctl/pkg/session/discover_test.go` (new)

**Signatures:**
```go
func DiscoverSessions(cwd string, piDir string, claudeDir string) ([]SessionInfo, error)
func decodePiPath(dirName string) string       // --Users-coreycole-dotfiles-- → /Users/coreycole/dotfiles
func decodeClaudePath(dirName string) string   // -Users-coreycole-dotfiles → /Users/coreycole/dotfiles
func piTimestamp(filename string) (time.Time, error)   // from filename
func claudeTimestamp(path string) (time.Time, error)   // from first user line
func firstUserPrompt(path string, source string) string // preview text (truncated)
```

**Key behaviors:**
- Pi: scan `~/.pi/agent/sessions/<encoded-cwd>/*.jsonl`
- Claude: scan `~/.claude/projects/<encoded-cwd>/*.jsonl` (files only, NOT subdirs — avoids subagent .jsonl files)
- Sort all sessions by date, newest first
- Timestamp: pi from filename, Claude from first `user` line's `timestamp` field, fallback to file mtime

**Test checkpoint:** `go test ./pkg/session/` — test path encoding/decoding with known values, test that subagent paths are excluded

---

### Slice 8: Self-update mechanism + AGENTS.md

**Files:** `cctl/VERSION` (new), `cctl/AGENTS.md` (new), `cctl/pkg/selfupdate/selfupdate.go` (new), `cctl/main.go` (modify — add `var version string` for ldflags)

**`cctl/AGENTS.md` contents:**
```markdown
# cctl — Agent Instructions

After making ANY code changes to cctl, increment the integer in `cctl/VERSION` by 1.
This triggers an auto-rebuild on the next invocation.
```

**Signatures:**
```go
// main.go
var version string // set by -ldflags "-X main.version=N"

// pkg/selfupdate/selfupdate.go
func CheckAndRebuild(compiledVersion string) error
func sourceDir() (string, error)     // resolve from os.Executable() → ../
func readVersionFile(dir string) (int, error)
```

**Behavior:**
1. `sourceDir()` resolves the binary path via `os.Executable()`, follows symlinks, goes up one level to find the source root
2. Reads `VERSION` file, parses as integer
3. Compares to `compiledVersion` (also parsed as integer)
4. If source > compiled: `exec.Command("go", "build", "-ldflags", ..., "-o", "bin/cctl", ".")` in source dir, then `syscall.Exec()` the new binary with `os.Args`
5. If equal or VERSION missing: return nil (continue normally)

**Test checkpoint:** `cd cctl && go build -ldflags "-X main.version=0" -o bin/cctl . && echo '1' > VERSION && ./bin/cctl version` — should rebuild and print version `1`

---

### Slice 9: CLI + fzf picker + launch

**Files:** `cctl/main.go` (new), `cctl/cmd/root.go` (new), `cctl/cmd/resume.go` (new), `cctl/picker/fzf.go` (new)

**Signatures:**
```go
// cmd/root.go
var rootCmd = &cobra.Command{Use: "cctl"}
// PersistentPreRun calls selfupdate.CheckAndRebuild(version, sourceDir)

// cmd/resume.go  
var resumeCmd = &cobra.Command{Use: "resume"}
var printFlag bool  // --print: dump converted JSONL to stdout

// pkg/picker/fzf.go
func Pick(items []string) (string, error) // shell out to fzf

// pkg/selfupdate/selfupdate.go
func CheckAndRebuild(compiledVersion string) error  // read VERSION, compare, rebuild + re-exec if stale
```

**Flow:**
1. `session.DiscoverSessions(cwd)` → sorted list
2. Format each as `[pi] 2026-04-09 first prompt text...` or `[claude] 2026-04-09 first prompt text...`
3. `picker.Pick()` → user selects
4. If pi session: `exec pi --fork <path>`
5. If claude session: `convert.ConvertSession()` → write to `/tmp/cctl-claude-<uuid>.jsonl` → `exec pi --fork <tmpfile>`
6. If `--print`: dump converted output to stdout instead of launching

**Test checkpoint:** `cd cctl && go build -ldflags "-X main.version=$(cat VERSION)" -o bin/cctl . && ./bin/cctl resume --print` in dotfiles dir — shows converted JSONL or pi session path

---

## Out of Scope

- Cost computation from token counts
- Inlining subagent conversation history (just prompt + final result)
- sessions-index.json (100% stale)
- `queue-operation` content recovery
- Tool-specific argument transformation (pass through as-is)
- `toolUseResult` / `structuredPatch` / `originalFile` fields on user lines (Claude metadata noise)
- Validating that converted JSONL produces a working pi session beyond `--fork` accepting it
