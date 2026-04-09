---
date: 2026-04-09T14:15:00-0700
researcher: CoreyCole
stage: plan
plan_dir: "thoughts/CoreyCole/plans/2026-04-09_claude-session-reader-skill"
---

# Implementation Plan: cctl `c resume` — Unified Session Picker

## Status
- [x] Slice 1: Types + simple chat conversion + test harness
- [x] Slice 2: Tool use cycle (tool_use → tool_result extraction)
- [x] Slice 3: Streaming merge
- [ ] Slice 4: Content edge cases (string content, images, documents, thinking, error results, list tool_result)
- [ ] Slice 5: Agent and Task tools
- [ ] Slice 6: Noise filtering (comprehensive)
- [ ] Slice 7: Session discovery
- [ ] Slice 8: Self-update mechanism + AGENTS.md
- [ ] Slice 9: CLI + fzf picker + launch

---

## Slice 1: Types + simple chat conversion + test harness

### Files
- `cctl/go.mod` (new)
- `cctl/pkg/convert/types.go` (new)
- `cctl/pkg/convert/toolnames.go` (new)
- `cctl/pkg/convert/convert.go` (new)
- `cctl/pkg/convert/convert_test.go` (new)
- `cctl/pkg/convert/testdata/01_simple_chat.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/01_simple_chat.pi.jsonl` (new)

### Changes

**`cctl/go.mod`** (new):
```go
module github.com/coreycole/cctl

go 1.25
```

**`cctl/pkg/convert/types.go`** (new):
```go
package convert

import "encoding/json"

// --- Claude input types ---

type ClaudeLine struct {
	Type       string         `json:"type"`
	UUID       string         `json:"uuid"`
	ParentUUID *string        `json:"parentUuid"`
	Timestamp  string         `json:"timestamp"`
	SessionID  string         `json:"sessionId"`
	CWD        string         `json:"cwd"`
	Message    *ClaudeMessage `json:"message"`
}

type ClaudeMessage struct {
	Role       string          `json:"role"`
	Content    json.RawMessage `json:"content"` // string or []ClaudeContentItem
	Model      string          `json:"model"`
	ID         string          `json:"id"` // for streaming dedup
	Usage      *ClaudeUsage    `json:"usage"`
	StopReason *string         `json:"stop_reason"`
}

type ClaudeUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type ClaudeContentItem struct {
	Type      string          `json:"type"`        // text, tool_use, tool_result, thinking, image, document
	Text      string          `json:"text"`        // text content
	ID        string          `json:"id"`          // tool_use id
	Name      string          `json:"name"`        // tool_use name (Capitalized)
	Input     json.RawMessage `json:"input"`       // tool_use arguments
	ToolUseID string          `json:"tool_use_id"` // tool_result backref
	Content   json.RawMessage `json:"content"`     // tool_result content (string or [{type:"text"}])
	IsError   bool            `json:"is_error"`    // tool_result error flag
	Thinking  string          `json:"thinking"`    // thinking content
	Signature string          `json:"signature"`   // drop on conversion
	Source    json.RawMessage `json:"source"`      // image/document source (skip)
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

**`cctl/pkg/convert/toolnames.go`** (new):
```go
package convert

import "strings"

// mapToolName converts a Claude tool name to a pi tool name.
// Special case: "Agent" → "subagent". Everything else: strings.ToLower.
func mapToolName(claudeName string) string {
	if claudeName == "Agent" {
		return "subagent"
	}
	return strings.ToLower(claudeName)
}
```

**`cctl/pkg/convert/convert.go`** (new):
```go
package convert

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ConvertSession converts Claude JSONL bytes to pi JSONL bytes.
func ConvertSession(input []byte) ([]byte, error) {
	claudeLines, err := parseClaude(input)
	if err != nil {
		return nil, fmt.Errorf("parsing claude session: %w", err)
	}

	merged := mergeStreamingChunks(claudeLines)

	piLines, err := convertMessages(merged)
	if err != nil {
		return nil, fmt.Errorf("converting messages: %w", err)
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	for _, line := range piLines {
		if err := enc.Encode(line); err != nil {
			return nil, fmt.Errorf("encoding pi line: %w", err)
		}
	}
	return buf.Bytes(), nil
}

// noiseTypes are Claude line types that should be skipped entirely.
var noiseTypes = map[string]bool{
	"progress":              true,
	"file-history-snapshot": true,
	"system":                true,
	"last-prompt":           true,
	"queue-operation":       true,
	"attachment":            true,
	"custom-title":          true,
	"agent-name":            true,
	"permission-mode":       true,
}

// parseClaude parses JSONL input, skipping noise types.
// Returns only "user" and "assistant" lines that have a message.
func parseClaude(input []byte) ([]ClaudeLine, error) {
	var lines []ClaudeLine
	scanner := bufio.NewScanner(bytes.NewReader(input))
	// Increase buffer size for large lines (tool results can be huge)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		raw := scanner.Bytes()
		if len(raw) == 0 {
			continue
		}

		// Quick type check without full parse
		var peek struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(raw, &peek); err != nil {
			continue // skip malformed lines
		}

		if noiseTypes[peek.Type] {
			continue
		}

		if peek.Type != "user" && peek.Type != "assistant" {
			continue
		}

		var line ClaudeLine
		if err := json.Unmarshal(raw, &line); err != nil {
			continue // skip malformed
		}

		if line.Message == nil {
			continue
		}

		lines = append(lines, line)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scanning input: %w", err)
	}

	return lines, nil
}

// mergeStreamingChunks groups assistant lines by message.id and
// merges their content arrays. Takes the last line's usage, model, and stop_reason.
func mergeStreamingChunks(lines []ClaudeLine) []ClaudeLine {
	var result []ClaudeLine
	// Track assistant groups by message.id
	type assistantGroup struct {
		idx int // index in result
	}
	groups := make(map[string]*assistantGroup)

	for _, line := range lines {
		if line.Type == "assistant" && line.Message != nil && line.Message.ID != "" {
			msgID := line.Message.ID
			if g, ok := groups[msgID]; ok {
				// Merge into existing group
				existing := result[g.idx]

				// Parse and append content
				existingItems, _ := normalizeContent(existing.Message.Content)
				newItems, _ := normalizeContent(line.Message.Content)
				existingItems = append(existingItems, newItems...)

				// Re-encode merged content
				merged, _ := json.Marshal(existingItems)
				result[g.idx].Message.Content = merged

				// Take last line's metadata
				if line.Message.Model != "" {
					result[g.idx].Message.Model = line.Message.Model
				}
				if line.Message.Usage != nil {
					result[g.idx].Message.Usage = line.Message.Usage
				}
				if line.Message.StopReason != nil {
					result[g.idx].Message.StopReason = line.Message.StopReason
				}
				continue
			}

			// First occurrence of this message.id
			groups[msgID] = &assistantGroup{idx: len(result)}
		}

		result = append(result, line)
	}

	return result
}

// normalizeContent handles Claude's content field which can be a string or an array.
// Returns a slice of ClaudeContentItem.
func normalizeContent(raw json.RawMessage) ([]ClaudeContentItem, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	// Try string first
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && trimmed[0] == '"' {
		var s string
		if err := json.Unmarshal(raw, &s); err == nil {
			return []ClaudeContentItem{{Type: "text", Text: s}}, nil
		}
	}

	// Try array
	var items []ClaudeContentItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("parsing content: %w", err)
	}
	return items, nil
}

// convertMessages translates merged Claude lines into pi lines.
// Generates sequential IDs and chains parentId.
func convertMessages(lines []ClaudeLine) ([]PiLine, error) {
	var piLines []PiLine
	msgCounter := 0

	nextID := func() string {
		msgCounter++
		return fmt.Sprintf("msg-%d", msgCounter)
	}

	lastID := ""

	// Synthesize session header from first line
	if len(lines) > 0 {
		first := lines[0]
		ts := first.Timestamp
		if ts == "" {
			ts = time.Now().UTC().Format(time.RFC3339Nano)
		}
		sessionID := first.SessionID
		if sessionID == "" {
			sessionID = "converted-session"
		}
		cwd := first.CWD

		header := PiLine{
			Type:      "session",
			Version:   3,
			ID:        sessionID,
			Timestamp: ts,
			CWD:       cwd,
		}
		piLines = append(piLines, header)
	}

	// Build tool name lookup: tool_use id → lowercased tool name
	toolNameLookup := make(map[string]string)
	for _, line := range lines {
		if line.Type != "assistant" || line.Message == nil {
			continue
		}
		items, _ := normalizeContent(line.Message.Content)
		for _, item := range items {
			if item.Type == "tool_use" {
				toolNameLookup[item.ID] = mapToolName(item.Name)
			}
		}
	}

	// Convert each line
	for _, line := range lines {
		if line.Message == nil {
			continue
		}

		items, err := normalizeContent(line.Message.Content)
		if err != nil {
			continue
		}

		switch line.Type {
		case "user":
			// Separate tool_result items from text/other items
			var textItems []ClaudeContentItem
			var toolResults []ClaudeContentItem
			for _, item := range items {
				if item.Type == "tool_result" {
					toolResults = append(toolResults, item)
				} else {
					textItems = append(textItems, item)
				}
			}

			// Emit tool results first (they respond to prior assistant tool_use)
			for _, tr := range toolResults {
				id := nextID()
				piMsg := PiLine{
					Type:      "message",
					ID:        id,
					ParentID:  lastID,
					Timestamp: line.Timestamp,
					Message:   convertToolResult(tr, toolNameLookup),
				}
				piLines = append(piLines, piMsg)
				lastID = id
			}

			// Emit user text if any
			if len(textItems) > 0 {
				piContent := convertContentItems(textItems)
				if len(piContent) > 0 {
					id := nextID()
					piMsg := PiLine{
						Type:      "message",
						ID:        id,
						ParentID:  lastID,
						Timestamp: line.Timestamp,
						Message: &PiMessage{
							Role:    "user",
							Content: piContent,
						},
					}
					piLines = append(piLines, piMsg)
					lastID = id
				}
			}

		case "assistant":
			piContent := convertContentItems(items)
			if len(piContent) == 0 {
				continue
			}

			id := nextID()

			stopReason := ""
			if line.Message.StopReason != nil {
				stopReason = *line.Message.StopReason
			}
			// Map Claude stop reasons to pi equivalents
			switch stopReason {
			case "tool_use":
				stopReason = "toolUse"
			case "end_turn":
				stopReason = "endTurn"
			}

			var usage *PiUsage
			if line.Message.Usage != nil {
				usage = &PiUsage{
					Input:       line.Message.Usage.InputTokens,
					Output:      line.Message.Usage.OutputTokens,
					TotalTokens: line.Message.Usage.InputTokens + line.Message.Usage.OutputTokens,
				}
			}

			piMsg := PiLine{
				Type:      "message",
				ID:        id,
				ParentID:  lastID,
				Timestamp: line.Timestamp,
				Message: &PiMessage{
					Role:       "assistant",
					Content:    piContent,
					Model:      line.Message.Model,
					Provider:   "anthropic",
					API:        "anthropic-messages",
					Usage:      usage,
					StopReason: stopReason,
				},
			}
			piLines = append(piLines, piMsg)
			lastID = id
		}
	}

	return piLines, nil
}

// convertContentItems converts Claude content items to pi content items.
// Handles text, tool_use, thinking, image, document types.
// Skips tool_result (handled separately).
func convertContentItems(items []ClaudeContentItem) []PiContentItem {
	var result []PiContentItem
	for _, item := range items {
		switch item.Type {
		case "text":
			if strings.TrimSpace(item.Text) != "" {
				result = append(result, PiContentItem{
					Type: "text",
					Text: item.Text,
				})
			}
		case "tool_use":
			result = append(result, PiContentItem{
				Type:      "toolCall",
				ID:        item.ID,
				Name:      mapToolName(item.Name),
				Arguments: item.Input,
			})
		case "thinking":
			if item.Thinking != "" {
				result = append(result, PiContentItem{
					Type:     "thinking",
					Thinking: item.Thinking,
				})
			}
		case "image":
			result = append(result, PiContentItem{
				Type: "text",
				Text: "[image omitted]",
			})
		case "document":
			result = append(result, PiContentItem{
				Type: "text",
				Text: "[document omitted]",
			})
		// tool_result is handled by convertToolResult, skip here
		}
	}
	return result
}

// convertToolResult converts a Claude tool_result content item to a pi toolResult message.
func convertToolResult(item ClaudeContentItem, toolNameLookup map[string]string) *PiMessage {
	toolName := toolNameLookup[item.ToolUseID]

	// Parse tool result content — can be string or [{type:"text", text:"..."}]
	var piContent []PiContentItem
	if len(item.Content) > 0 {
		trimmed := bytes.TrimSpace(item.Content)
		if len(trimmed) > 0 && trimmed[0] == '"' {
			// String content
			var s string
			if json.Unmarshal(item.Content, &s) == nil {
				piContent = []PiContentItem{{Type: "text", Text: s}}
			}
		} else if len(trimmed) > 0 && trimmed[0] == '[' {
			// Array content — [{type:"text", text:"..."}]
			var contentItems []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			}
			if json.Unmarshal(item.Content, &contentItems) == nil {
				for _, ci := range contentItems {
					piContent = append(piContent, PiContentItem{Type: ci.Type, Text: ci.Text})
				}
			}
		}
	}

	if len(piContent) == 0 {
		piContent = []PiContentItem{{Type: "text", Text: ""}}
	}

	return &PiMessage{
		Role:       "toolResult",
		ToolCallID: item.ToolUseID,
		ToolName:   toolName,
		Content:    piContent,
		IsError:    item.IsError,
	}
}
```

**`cctl/pkg/convert/convert_test.go`** (new):
```go
package convert

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func loadTestData(t *testing.T, name string) (claude, expectedPi []byte) {
	t.Helper()
	dir := "testdata"

	claudePath := filepath.Join(dir, name+".claude.jsonl")
	claudeData, err := os.ReadFile(claudePath)
	if err != nil {
		t.Fatalf("reading %s: %v", claudePath, err)
	}

	piPath := filepath.Join(dir, name+".pi.jsonl")
	piData, err := os.ReadFile(piPath)
	if err != nil {
		t.Fatalf("reading %s: %v", piPath, err)
	}

	return claudeData, piData
}

// comparePiOutput does line-by-line JSON comparison, ignoring key order.
func comparePiOutput(t *testing.T, got, want []byte) {
	t.Helper()

	gotLines := splitJSONL(got)
	wantLines := splitJSONL(want)

	if len(gotLines) != len(wantLines) {
		t.Errorf("line count: got %d, want %d", len(gotLines), len(wantLines))
		t.Logf("GOT:\n%s", string(got))
		t.Logf("WANT:\n%s", string(want))
		return
	}

	for i := range gotLines {
		var gotObj, wantObj interface{}
		if err := json.Unmarshal(gotLines[i], &gotObj); err != nil {
			t.Errorf("line %d: invalid JSON in got: %v", i+1, err)
			continue
		}
		if err := json.Unmarshal(wantLines[i], &wantObj); err != nil {
			t.Errorf("line %d: invalid JSON in want: %v", i+1, err)
			continue
		}

		gotJSON, _ := json.Marshal(gotObj)
		wantJSON, _ := json.Marshal(wantObj)
		if string(gotJSON) != string(wantJSON) {
			t.Errorf("line %d mismatch:\n  got:  %s\n  want: %s", i+1, string(gotJSON), string(wantJSON))
		}
	}
}

func splitJSONL(data []byte) [][]byte {
	var lines [][]byte
	for _, line := range splitLines(data) {
		if len(line) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			line := data[start:i]
			if len(line) > 0 {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

func TestSimpleChat(t *testing.T) {
	claude, expectedPi := loadTestData(t, "01_simple_chat")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}
```

**`cctl/pkg/convert/testdata/01_simple_chat.claude.jsonl`** (new):

This fixture has: a progress noise line, a user message with string content, an assistant reply with text content, interspersed noise.

```jsonl
{"type":"progress","data":{"type":"hook_progress"},"timestamp":"2026-03-24T18:58:56.150Z","uuid":"noise-1","cwd":"/Users/test/project","sessionId":"session-001"}
{"type":"user","message":{"role":"user","content":"hello"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-001"}
{"type":"system","subtype":"turn_duration","timestamp":"2026-03-24T19:00:01.000Z","uuid":"noise-2","sessionId":"session-001"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi there! How can I help you?"}],"model":"claude-opus-4-6","id":"msg_001","stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":15}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:02.000Z","cwd":"/Users/test/project","sessionId":"session-001"}
{"type":"last-prompt","lastPrompt":"hello","timestamp":"2026-03-24T19:00:03.000Z","sessionId":"session-001"}
```

**`cctl/pkg/convert/testdata/01_simple_chat.pi.jsonl`** (new):

```jsonl
{"type":"session","version":3,"id":"session-001","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"hello"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi there! How can I help you?"}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":10,"output":15,"cacheRead":0,"cacheWrite":0,"totalTokens":25,"cost":{"input":0,"output":0,"total":0}},"stopReason":"endTurn"}}
```

### Verify
```bash
cd cctl && go test ./pkg/convert/ -run TestSimpleChat -v
```

---

## Slice 2: Tool use cycle (tool_use → tool_result extraction)

### Files
- `cctl/pkg/convert/convert_test.go` (modify)
- `cctl/pkg/convert/testdata/02_tool_use_cycle.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/02_tool_use_cycle.pi.jsonl` (new)

### Changes

**`cctl/pkg/convert/convert_test.go`** (modify — add test):
```go
func TestToolUseCycle(t *testing.T) {
	claude, expectedPi := loadTestData(t, "02_tool_use_cycle")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}
```

**`cctl/pkg/convert/testdata/02_tool_use_cycle.claude.jsonl`** (new):

Assistant makes a Read tool call, then user message contains the tool_result plus follow-up text.

```jsonl
{"type":"user","message":{"role":"user","content":"read the file foo.md"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-002"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll read that file for you."},{"type":"tool_use","id":"toolu_01X","name":"Read","input":{"file_path":"/foo.md"}}],"model":"claude-opus-4-6","id":"msg_002","stop_reason":"tool_use","usage":{"input_tokens":20,"output_tokens":30}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-002"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01X","content":"# Foo\nThis is foo.md content.","is_error":false},{"type":"text","text":"now edit it"}]},"uuid":"uuid-3","parentUuid":"uuid-2","timestamp":"2026-03-24T19:00:02.000Z","cwd":"/Users/test/project","sessionId":"session-002"}
```

**`cctl/pkg/convert/testdata/02_tool_use_cycle.pi.jsonl`** (new):

4 lines: session header + user + assistant (text + toolCall) + toolResult + user text.

```jsonl
{"type":"session","version":3,"id":"session-002","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"read the file foo.md"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I'll read that file for you."},{"type":"toolCall","id":"toolu_01X","name":"read","arguments":{"file_path":"/foo.md"}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":20,"output":30,"cacheRead":0,"cacheWrite":0,"totalTokens":50,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-3","parentId":"msg-2","timestamp":"2026-03-24T19:00:02.000Z","message":{"role":"toolResult","toolCallId":"toolu_01X","toolName":"read","content":[{"type":"text","text":"# Foo\nThis is foo.md content."}]}}
{"type":"message","id":"msg-4","parentId":"msg-3","timestamp":"2026-03-24T19:00:02.000Z","message":{"role":"user","content":[{"type":"text","text":"now edit it"}]}}
```

### Verify
```bash
cd cctl && go test ./pkg/convert/ -run TestToolUseCycle -v
```

---

## Slice 3: Streaming merge

### Files
- `cctl/pkg/convert/convert_test.go` (modify)
- `cctl/pkg/convert/testdata/03_streaming_merge.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/03_streaming_merge.pi.jsonl` (new)
- `cctl/pkg/convert/testdata/11_multi_tool_streaming.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/11_multi_tool_streaming.pi.jsonl` (new)

### Changes

**`cctl/pkg/convert/convert_test.go`** (modify — add tests):
```go
func TestStreamingMerge(t *testing.T) {
	claude, expectedPi := loadTestData(t, "03_streaming_merge")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestMultiToolStreaming(t *testing.T) {
	claude, expectedPi := loadTestData(t, "11_multi_tool_streaming")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}
```

**`cctl/pkg/convert/testdata/03_streaming_merge.claude.jsonl`** (new):

Two assistant lines with the same message.id — first has thinking, second has text with final usage.

```jsonl
{"type":"user","message":{"role":"user","content":"explain closures"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-003"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me explain closures...","signature":"EoUC..."}],"model":"claude-opus-4-6","id":"msg_003","stop_reason":null,"usage":{"input_tokens":5,"output_tokens":10}},"uuid":"uuid-2a","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-003"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"A closure is a function that captures variables from its enclosing scope."}],"model":"claude-opus-4-6","id":"msg_003","stop_reason":"end_turn","usage":{"input_tokens":5,"output_tokens":25}},"uuid":"uuid-2b","parentUuid":"uuid-2a","timestamp":"2026-03-24T19:00:02.000Z","cwd":"/Users/test/project","sessionId":"session-003"}
```

**`cctl/pkg/convert/testdata/03_streaming_merge.pi.jsonl`** (new):

Single merged assistant message with thinking + text. Usage from last line.

```jsonl
{"type":"session","version":3,"id":"session-003","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"explain closures"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me explain closures..."},{"type":"text","text":"A closure is a function that captures variables from its enclosing scope."}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":5,"output":25,"cacheRead":0,"cacheWrite":0,"totalTokens":30,"cost":{"input":0,"output":0,"total":0}},"stopReason":"endTurn"}}
```

**`cctl/pkg/convert/testdata/11_multi_tool_streaming.claude.jsonl`** (new):

Three assistant lines with same message.id: text → tool_use → tool_use (parallel calls).

```jsonl
{"type":"user","message":{"role":"user","content":"check both files"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-011"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll check both files."}],"model":"claude-opus-4-6","id":"msg_011","stop_reason":null,"usage":{"input_tokens":10,"output_tokens":5}},"uuid":"uuid-2a","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-011"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_A","name":"Read","input":{"file_path":"/a.md"}}],"model":"claude-opus-4-6","id":"msg_011","stop_reason":null,"usage":{"input_tokens":10,"output_tokens":15}},"uuid":"uuid-2b","parentUuid":"uuid-2a","timestamp":"2026-03-24T19:00:01.500Z","cwd":"/Users/test/project","sessionId":"session-011"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_B","name":"Read","input":{"file_path":"/b.md"}}],"model":"claude-opus-4-6","id":"msg_011","stop_reason":"tool_use","usage":{"input_tokens":10,"output_tokens":25}},"uuid":"uuid-2c","parentUuid":"uuid-2b","timestamp":"2026-03-24T19:00:02.000Z","cwd":"/Users/test/project","sessionId":"session-011"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_A","content":"contents of a.md","is_error":false},{"type":"tool_result","tool_use_id":"toolu_B","content":"contents of b.md","is_error":false}]},"uuid":"uuid-3","parentUuid":"uuid-2c","timestamp":"2026-03-24T19:00:03.000Z","cwd":"/Users/test/project","sessionId":"session-011"}
```

**`cctl/pkg/convert/testdata/11_multi_tool_streaming.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-011","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"check both files"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I'll check both files."},{"type":"toolCall","id":"toolu_A","name":"read","arguments":{"file_path":"/a.md"}},{"type":"toolCall","id":"toolu_B","name":"read","arguments":{"file_path":"/b.md"}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":10,"output":25,"cacheRead":0,"cacheWrite":0,"totalTokens":35,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-3","parentId":"msg-2","timestamp":"2026-03-24T19:00:03.000Z","message":{"role":"toolResult","toolCallId":"toolu_A","toolName":"read","content":[{"type":"text","text":"contents of a.md"}]}}
{"type":"message","id":"msg-4","parentId":"msg-3","timestamp":"2026-03-24T19:00:03.000Z","message":{"role":"toolResult","toolCallId":"toolu_B","toolName":"read","content":[{"type":"text","text":"contents of b.md"}]}}
```

### Verify
```bash
cd cctl && go test ./pkg/convert/ -run "TestStreamingMerge|TestMultiToolStreaming" -v
```

---

## Slice 4: Content edge cases

### Files
- `cctl/pkg/convert/convert_test.go` (modify)
- `cctl/pkg/convert/testdata/05_string_content.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/05_string_content.pi.jsonl` (new)
- `cctl/pkg/convert/testdata/06_image_and_document.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/06_image_and_document.pi.jsonl` (new)
- `cctl/pkg/convert/testdata/07_thinking_blocks.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/07_thinking_blocks.pi.jsonl` (new)
- `cctl/pkg/convert/testdata/10_error_tool_result.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/10_error_tool_result.pi.jsonl` (new)
- `cctl/pkg/convert/testdata/12_tool_result_list_content.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/12_tool_result_list_content.pi.jsonl` (new)

### Changes

**`cctl/pkg/convert/convert_test.go`** (modify — add tests):
```go
func TestStringContent(t *testing.T) {
	claude, expectedPi := loadTestData(t, "05_string_content")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestImageAndDocument(t *testing.T) {
	claude, expectedPi := loadTestData(t, "06_image_and_document")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestThinking(t *testing.T) {
	claude, expectedPi := loadTestData(t, "07_thinking_blocks")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestErrorToolResult(t *testing.T) {
	claude, expectedPi := loadTestData(t, "10_error_tool_result")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestToolResultListContent(t *testing.T) {
	claude, expectedPi := loadTestData(t, "12_tool_result_list_content")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}
```

**`cctl/pkg/convert/testdata/05_string_content.claude.jsonl`** (new):
```jsonl
{"type":"user","message":{"role":"user","content":"hello world"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-005"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}],"model":"claude-opus-4-6","id":"msg_005","stop_reason":"end_turn","usage":{"input_tokens":5,"output_tokens":5}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-005"}
```

**`cctl/pkg/convert/testdata/05_string_content.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-005","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"hello world"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":5,"output":5,"cacheRead":0,"cacheWrite":0,"totalTokens":10,"cost":{"input":0,"output":0,"total":0}},"stopReason":"endTurn"}}
```

**`cctl/pkg/convert/testdata/06_image_and_document.claude.jsonl`** (new):
```jsonl
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"look at this"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBOR..."}},{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"JVBERi..."}}]},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-006"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I can see the image and document."}],"model":"claude-opus-4-6","id":"msg_006","stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":10}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-006"}
```

**`cctl/pkg/convert/testdata/06_image_and_document.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-006","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"look at this"},{"type":"text","text":"[image omitted]"},{"type":"text","text":"[document omitted]"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I can see the image and document."}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":100,"output":10,"cacheRead":0,"cacheWrite":0,"totalTokens":110,"cost":{"input":0,"output":0,"total":0}},"stopReason":"endTurn"}}
```

**`cctl/pkg/convert/testdata/07_thinking_blocks.claude.jsonl`** (new):
```jsonl
{"type":"user","message":{"role":"user","content":"think about this"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-007"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me think about this carefully...","signature":"EoUCbase64signaturedata"},{"type":"text","text":"Here's my analysis."}],"model":"claude-opus-4-6","id":"msg_007","stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":20}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-007"}
```

**`cctl/pkg/convert/testdata/07_thinking_blocks.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-007","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"think about this"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me think about this carefully..."},{"type":"text","text":"Here's my analysis."}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":10,"output":20,"cacheRead":0,"cacheWrite":0,"totalTokens":30,"cost":{"input":0,"output":0,"total":0}},"stopReason":"endTurn"}}
```

**`cctl/pkg/convert/testdata/10_error_tool_result.claude.jsonl`** (new):
```jsonl
{"type":"user","message":{"role":"user","content":"read huge.bin"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-010"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_ERR","name":"Read","input":{"file_path":"/huge.bin"}}],"model":"claude-opus-4-6","id":"msg_010","stop_reason":"tool_use","usage":{"input_tokens":10,"output_tokens":10}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-010"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_ERR","content":"Error: File too large to read (15MB exceeds 1MB limit)","is_error":true}]},"uuid":"uuid-3","parentUuid":"uuid-2","timestamp":"2026-03-24T19:00:02.000Z","cwd":"/Users/test/project","sessionId":"session-010"}
```

**`cctl/pkg/convert/testdata/10_error_tool_result.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-010","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"read huge.bin"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"toolCall","id":"toolu_ERR","name":"read","arguments":{"file_path":"/huge.bin"}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":10,"output":10,"cacheRead":0,"cacheWrite":0,"totalTokens":20,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-3","parentId":"msg-2","timestamp":"2026-03-24T19:00:02.000Z","message":{"role":"toolResult","toolCallId":"toolu_ERR","toolName":"read","content":[{"type":"text","text":"Error: File too large to read (15MB exceeds 1MB limit)"}],"isError":true}}
```

**`cctl/pkg/convert/testdata/12_tool_result_list_content.claude.jsonl`** (new):
```jsonl
{"type":"user","message":{"role":"user","content":"delegate this task"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-012"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_AGT","name":"Agent","input":{"prompt":"investigate the bug"}}],"model":"claude-opus-4-6","id":"msg_012","stop_reason":"tool_use","usage":{"input_tokens":20,"output_tokens":15}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-012"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_AGT","content":[{"type":"text","text":"## Summary\nThe bug was in the parser. Fixed by adding null check."}]}]},"uuid":"uuid-3","parentUuid":"uuid-2","timestamp":"2026-03-24T19:00:10.000Z","cwd":"/Users/test/project","sessionId":"session-012"}
```

**`cctl/pkg/convert/testdata/12_tool_result_list_content.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-012","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"delegate this task"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"toolCall","id":"toolu_AGT","name":"subagent","arguments":{"prompt":"investigate the bug"}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":20,"output":15,"cacheRead":0,"cacheWrite":0,"totalTokens":35,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-3","parentId":"msg-2","timestamp":"2026-03-24T19:00:10.000Z","message":{"role":"toolResult","toolCallId":"toolu_AGT","toolName":"subagent","content":[{"type":"text","text":"## Summary\nThe bug was in the parser. Fixed by adding null check."}]}}
```

### Verify
```bash
cd cctl && go test ./pkg/convert/ -run "TestStringContent|TestImageAndDocument|TestThinking|TestErrorToolResult|TestToolResultListContent" -v
```

---

## Slice 5: Agent and Task tools

### Files
- `cctl/pkg/convert/convert_test.go` (modify)
- `cctl/pkg/convert/testdata/08_agent_subagent.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/08_agent_subagent.pi.jsonl` (new)
- `cctl/pkg/convert/testdata/09_task_tools.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/09_task_tools.pi.jsonl` (new)

### Changes

**`cctl/pkg/convert/convert_test.go`** (modify — add tests):
```go
func TestAgentSubagent(t *testing.T) {
	claude, expectedPi := loadTestData(t, "08_agent_subagent")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}

func TestTaskTools(t *testing.T) {
	claude, expectedPi := loadTestData(t, "09_task_tools")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)
}
```

**`cctl/pkg/convert/testdata/08_agent_subagent.claude.jsonl`** (new):

Agent tool call with progress noise interspersed.

```jsonl
{"type":"user","message":{"role":"user","content":"investigate the auth bug"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-008"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_AGT1","name":"Agent","input":{"prompt":"Look into the authentication bug in src/auth.go. Check recent changes and identify the root cause."}}],"model":"claude-opus-4-6","id":"msg_008","stop_reason":"tool_use","usage":{"input_tokens":30,"output_tokens":40}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-008"}
{"type":"progress","data":{"type":"agent_progress","message":{"role":"assistant","content":[{"type":"text","text":"Reading auth.go..."}]}},"timestamp":"2026-03-24T19:00:02.000Z","uuid":"noise-1","sessionId":"session-008"}
{"type":"progress","data":{"type":"agent_progress","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file_path":"src/auth.go"}}]}},"timestamp":"2026-03-24T19:00:03.000Z","uuid":"noise-2","sessionId":"session-008"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_AGT1","content":[{"type":"text","text":"## Investigation Results\n\nThe auth bug is caused by a missing token refresh check in `ValidateToken()`. When tokens expire during an active session, the function returns an error instead of attempting a refresh.\n\n### Root Cause\nLine 45 in src/auth.go: `if token.IsExpired() { return ErrExpired }` should first attempt `token.Refresh()`."}]}]},"uuid":"uuid-3","parentUuid":"uuid-2","timestamp":"2026-03-24T19:00:15.000Z","cwd":"/Users/test/project","sessionId":"session-008"}
```

**`cctl/pkg/convert/testdata/08_agent_subagent.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-008","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"investigate the auth bug"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"toolCall","id":"toolu_AGT1","name":"subagent","arguments":{"prompt":"Look into the authentication bug in src/auth.go. Check recent changes and identify the root cause."}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":30,"output":40,"cacheRead":0,"cacheWrite":0,"totalTokens":70,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-3","parentId":"msg-2","timestamp":"2026-03-24T19:00:15.000Z","message":{"role":"toolResult","toolCallId":"toolu_AGT1","toolName":"subagent","content":[{"type":"text","text":"## Investigation Results\n\nThe auth bug is caused by a missing token refresh check in `ValidateToken()`. When tokens expire during an active session, the function returns an error instead of attempting a refresh.\n\n### Root Cause\nLine 45 in src/auth.go: `if token.IsExpired() { return ErrExpired }` should first attempt `token.Refresh()`."}]}}
```

**`cctl/pkg/convert/testdata/09_task_tools.claude.jsonl`** (new):
```jsonl
{"type":"user","message":{"role":"user","content":"create a task to fix the tests"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-009"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_TC1","name":"TaskCreate","input":{"subject":"Fix failing tests","description":"Run the test suite and fix any failing tests in the auth package."}}],"model":"claude-opus-4-6","id":"msg_009a","stop_reason":"tool_use","usage":{"input_tokens":15,"output_tokens":20}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-009"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_TC1","content":"Task #1 created successfully: Fix failing tests","is_error":false}]},"uuid":"uuid-3","parentUuid":"uuid-2","timestamp":"2026-03-24T19:00:02.000Z","cwd":"/Users/test/project","sessionId":"session-009"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I've created the task. Let me check its output."},{"type":"tool_use","id":"toolu_TO1","name":"TaskOutput","input":{"task_id":"1"}}],"model":"claude-opus-4-6","id":"msg_009b","stop_reason":"tool_use","usage":{"input_tokens":25,"output_tokens":20}},"uuid":"uuid-4","parentUuid":"uuid-3","timestamp":"2026-03-24T19:00:05.000Z","cwd":"/Users/test/project","sessionId":"session-009"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_TO1","content":"Task #1 output: All 12 tests now passing. Fixed null pointer in TestValidateToken.","is_error":false}]},"uuid":"uuid-5","parentUuid":"uuid-4","timestamp":"2026-03-24T19:00:10.000Z","cwd":"/Users/test/project","sessionId":"session-009"}
```

**`cctl/pkg/convert/testdata/09_task_tools.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-009","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"create a task to fix the tests"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"toolCall","id":"toolu_TC1","name":"taskcreate","arguments":{"subject":"Fix failing tests","description":"Run the test suite and fix any failing tests in the auth package."}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":15,"output":20,"cacheRead":0,"cacheWrite":0,"totalTokens":35,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-3","parentId":"msg-2","timestamp":"2026-03-24T19:00:02.000Z","message":{"role":"toolResult","toolCallId":"toolu_TC1","toolName":"taskcreate","content":[{"type":"text","text":"Task #1 created successfully: Fix failing tests"}]}}
{"type":"message","id":"msg-4","parentId":"msg-3","timestamp":"2026-03-24T19:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I've created the task. Let me check its output."},{"type":"toolCall","id":"toolu_TO1","name":"taskoutput","arguments":{"task_id":"1"}}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":25,"output":20,"cacheRead":0,"cacheWrite":0,"totalTokens":45,"cost":{"input":0,"output":0,"total":0}},"stopReason":"toolUse"}}
{"type":"message","id":"msg-5","parentId":"msg-4","timestamp":"2026-03-24T19:00:10.000Z","message":{"role":"toolResult","toolCallId":"toolu_TO1","toolName":"taskoutput","content":[{"type":"text","text":"Task #1 output: All 12 tests now passing. Fixed null pointer in TestValidateToken."}]}}
```

### Verify
```bash
cd cctl && go test ./pkg/convert/ -run "TestAgentSubagent|TestTaskTools" -v
```

---

## Slice 6: Noise filtering (comprehensive)

### Files
- `cctl/pkg/convert/convert_test.go` (modify)
- `cctl/pkg/convert/testdata/04_noise_filtering.claude.jsonl` (new)
- `cctl/pkg/convert/testdata/04_noise_filtering.pi.jsonl` (new)

### Changes

**`cctl/pkg/convert/convert_test.go`** (modify — add test):
```go
func TestNoiseFiltering(t *testing.T) {
	claude, expectedPi := loadTestData(t, "04_noise_filtering")
	got, err := ConvertSession(claude)
	if err != nil {
		t.Fatalf("ConvertSession: %v", err)
	}
	comparePiOutput(t, got, expectedPi)

	// Verify exactly 3 lines: session header + user + assistant
	gotLines := splitJSONL(got)
	if len(gotLines) != 3 {
		t.Errorf("expected 3 lines, got %d", len(gotLines))
	}
}
```

**`cctl/pkg/convert/testdata/04_noise_filtering.claude.jsonl`** (new):

All noise types interspersed with one valid user message and one valid assistant reply.

```jsonl
{"type":"progress","data":{"type":"hook_progress","hookEvent":"SessionStart","hookName":"SessionStart:startup"},"timestamp":"2026-03-24T18:58:56.000Z","uuid":"n1","sessionId":"session-004","cwd":"/Users/test/project"}
{"type":"progress","data":{"type":"agent_progress"},"timestamp":"2026-03-24T18:59:00.000Z","uuid":"n2","sessionId":"session-004"}
{"type":"progress","data":{"type":"bash_progress"},"timestamp":"2026-03-24T18:59:01.000Z","uuid":"n3","sessionId":"session-004"}
{"type":"progress","data":{"type":"query_update"},"timestamp":"2026-03-24T18:59:02.000Z","uuid":"n4","sessionId":"session-004"}
{"type":"progress","data":{"type":"search_results_received"},"timestamp":"2026-03-24T18:59:03.000Z","uuid":"n5","sessionId":"session-004"}
{"type":"progress","data":{"type":"waiting_for_task"},"timestamp":"2026-03-24T18:59:04.000Z","uuid":"n6","sessionId":"session-004"}
{"type":"file-history-snapshot","messageId":"msg-snap","snapshot":{"trackedFileBackups":{},"timestamp":"2026-03-24T18:59:05.000Z"},"isSnapshotUpdate":false}
{"type":"system","subtype":"turn_duration","durationMs":1234,"timestamp":"2026-03-24T18:59:06.000Z","uuid":"n7","sessionId":"session-004"}
{"type":"system","subtype":"bridge_status","timestamp":"2026-03-24T18:59:07.000Z","uuid":"n8","sessionId":"session-004"}
{"type":"last-prompt","lastPrompt":"hello","timestamp":"2026-03-24T18:59:08.000Z","sessionId":"session-004"}
{"type":"queue-operation","operation":"enqueue","content":"queued text","timestamp":"2026-03-24T18:59:09.000Z","uuid":"n9","sessionId":"session-004"}
{"type":"attachment","subtype":"deferred_tools_delta","timestamp":"2026-03-24T18:59:10.000Z","uuid":"n10","sessionId":"session-004"}
{"type":"attachment","subtype":"hook_non_blocking_error","timestamp":"2026-03-24T18:59:11.000Z","uuid":"n11","sessionId":"session-004"}
{"type":"attachment","subtype":"nested_memory","timestamp":"2026-03-24T18:59:11.500Z","uuid":"n11b","sessionId":"session-004"}
{"type":"custom-title","title":"Test Session","timestamp":"2026-03-24T18:59:12.000Z","uuid":"n12","sessionId":"session-004"}
{"type":"agent-name","name":"claude","timestamp":"2026-03-24T18:59:13.000Z","uuid":"n13","sessionId":"session-004"}
{"type":"permission-mode","mode":"bypassPermissions","timestamp":"2026-03-24T18:59:14.000Z","uuid":"n14","sessionId":"session-004"}
{"type":"user","message":{"role":"user","content":"hello noise test"},"uuid":"uuid-1","parentUuid":null,"timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project","sessionId":"session-004"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hello! The noise has been filtered."}],"model":"claude-opus-4-6","id":"msg_004","stop_reason":"end_turn","usage":{"input_tokens":5,"output_tokens":8}},"uuid":"uuid-2","parentUuid":"uuid-1","timestamp":"2026-03-24T19:00:01.000Z","cwd":"/Users/test/project","sessionId":"session-004"}
```

**`cctl/pkg/convert/testdata/04_noise_filtering.pi.jsonl`** (new):
```jsonl
{"type":"session","version":3,"id":"session-004","timestamp":"2026-03-24T19:00:00.000Z","cwd":"/Users/test/project"}
{"type":"message","id":"msg-1","parentId":"","timestamp":"2026-03-24T19:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"hello noise test"}]}}
{"type":"message","id":"msg-2","parentId":"msg-1","timestamp":"2026-03-24T19:00:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello! The noise has been filtered."}],"model":"claude-opus-4-6","provider":"anthropic","api":"anthropic-messages","usage":{"input":5,"output":8,"cacheRead":0,"cacheWrite":0,"totalTokens":13,"cost":{"input":0,"output":0,"total":0}},"stopReason":"endTurn"}}
```

### Verify
```bash
cd cctl && go test ./pkg/convert/ -run TestNoiseFiltering -v
```

---

## Slice 7: Session discovery

### Files
- `cctl/pkg/session/types.go` (new)
- `cctl/pkg/session/discover.go` (new)
- `cctl/pkg/session/discover_test.go` (new)

### Changes

**`cctl/pkg/session/types.go`** (new):
```go
package session

import "time"

// SessionInfo describes a discovered session from either pi or Claude.
type SessionInfo struct {
	Source  string    // "pi" or "claude"
	Path    string    // absolute path to .jsonl
	CWD     string    // working directory the session was started from
	Date    time.Time // session timestamp
	Preview string    // first user message (truncated to 80 chars)
}
```

**`cctl/pkg/session/discover.go`** (new):
```go
package session

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// DiscoverSessions finds all pi and Claude sessions for the given cwd.
// piDir defaults to ~/.pi/agent/sessions, claudeDir defaults to ~/.claude/projects.
func DiscoverSessions(cwd string, piDir string, claudeDir string) ([]SessionInfo, error) {
	var sessions []SessionInfo

	piSessions, err := discoverPi(cwd, piDir)
	if err == nil {
		sessions = append(sessions, piSessions...)
	}

	claudeSessions, err := discoverClaude(cwd, claudeDir)
	if err == nil {
		sessions = append(sessions, claudeSessions...)
	}

	// Sort newest first
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].Date.After(sessions[j].Date)
	})

	return sessions, nil
}

// encodePiPath: /Users/coreycole/dotfiles → --Users-coreycole-dotfiles--
func encodePiPath(path string) string {
	encoded := strings.ReplaceAll(path, "/", "-")
	return "-" + encoded + "--"
}

// decodePiPath: --Users-coreycole-dotfiles-- → /Users/coreycole/dotfiles
func decodePiPath(dirName string) string {
	// Strip leading -- and trailing --
	s := strings.TrimPrefix(dirName, "--")
	s = strings.TrimSuffix(s, "--")
	// Replace - with /
	return "/" + strings.ReplaceAll(s, "-", "/")
}

// encodeClaudePath: /Users/coreycole/dotfiles → -Users-coreycole-dotfiles
func encodeClaudePath(path string) string {
	return strings.ReplaceAll(path, "/", "-")
}

// decodeClaudePath: -Users-coreycole-dotfiles → /Users/coreycole/dotfiles
func decodeClaudePath(dirName string) string {
	// The leading - corresponds to the leading /
	return strings.ReplaceAll(dirName, "-", "/")
}

func discoverPi(cwd string, piDir string) ([]SessionInfo, error) {
	encoded := encodePiPath(cwd)
	dir := filepath.Join(piDir, encoded)

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var sessions []SessionInfo
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}

		path := filepath.Join(dir, e.Name())
		ts, err := piTimestamp(e.Name())
		if err != nil {
			// Fallback to file mtime
			if info, err2 := e.Info(); err2 == nil {
				ts = info.ModTime()
			}
		}

		preview := firstUserPrompt(path, "pi")

		sessions = append(sessions, SessionInfo{
			Source:  "pi",
			Path:    path,
			CWD:     cwd,
			Date:    ts,
			Preview: preview,
		})
	}

	return sessions, nil
}

func discoverClaude(cwd string, claudeDir string) ([]SessionInfo, error) {
	encoded := encodeClaudePath(cwd)
	dir := filepath.Join(claudeDir, encoded)

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var sessions []SessionInfo
	for _, e := range entries {
		// Only .jsonl files directly in the project dir (NOT subdirs with subagent files)
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}

		path := filepath.Join(dir, e.Name())
		ts, err := claudeTimestamp(path)
		if err != nil {
			// Fallback to file mtime
			if info, err2 := e.Info(); err2 == nil {
				ts = info.ModTime()
			}
		}

		preview := firstUserPrompt(path, "claude")

		sessions = append(sessions, SessionInfo{
			Source:  "claude",
			Path:    path,
			CWD:     cwd,
			Date:    ts,
			Preview: preview,
		})
	}

	return sessions, nil
}

// piTimestamp extracts the timestamp from a pi session filename.
// Format: 2026-04-09T17-13-10-661Z_<uuid>.jsonl
func piTimestamp(filename string) (time.Time, error) {
	// Split on _ to get timestamp part
	parts := strings.SplitN(filename, "_", 2)
	if len(parts) < 2 {
		return time.Time{}, fmt.Errorf("invalid pi filename: %s", filename)
	}
	tsStr := parts[0]
	// Convert hyphens in time back to colons and dots:
	// 2026-04-09T17-13-10-661Z → 2026-04-09T17:13:10.661Z
	// The date hyphens stay, the time hyphens become : and .
	// Pattern: YYYY-MM-DDThh-mm-ss-mmmZ
	if len(tsStr) >= 24 && tsStr[10] == 'T' {
		tsStr = tsStr[:13] + ":" + tsStr[14:16] + ":" + tsStr[17:19] + "." + tsStr[20:]
	}
	return time.Parse(time.RFC3339Nano, tsStr)
}

// claudeTimestamp reads the first user line from a Claude session to get its timestamp.
func claudeTimestamp(path string) (time.Time, error) {
	f, err := os.Open(path)
	if err != nil {
		return time.Time{}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		var line struct {
			Type      string `json:"type"`
			Timestamp string `json:"timestamp"`
		}
		if json.Unmarshal(scanner.Bytes(), &line) != nil {
			continue
		}
		if line.Type == "user" && line.Timestamp != "" {
			return time.Parse(time.RFC3339Nano, line.Timestamp)
		}
	}

	return time.Time{}, fmt.Errorf("no user line with timestamp in %s", path)
}

// firstUserPrompt reads the first user message from a session file and returns
// a truncated preview (up to 80 chars).
func firstUserPrompt(path string, source string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		var line struct {
			Type    string `json:"type"`
			Message *struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(scanner.Bytes(), &line) != nil {
			continue
		}

		isUserMsg := false
		if source == "pi" && line.Type == "message" && line.Message != nil && line.Message.Role == "user" {
			isUserMsg = true
		} else if source == "claude" && line.Type == "user" && line.Message != nil {
			isUserMsg = true
		}

		if !isUserMsg {
			continue
		}

		text := extractTextFromContent(line.Message.Content)
		if text != "" {
			if len(text) > 80 {
				text = text[:77] + "..."
			}
			// Replace newlines with spaces
			text = strings.ReplaceAll(text, "\n", " ")
			return text
		}
	}

	return ""
}

// extractTextFromContent gets the first text from content (string or array).
func extractTextFromContent(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	// Try string
	trimmed := strings.TrimSpace(string(raw))
	if len(trimmed) > 0 && trimmed[0] == '"' {
		var s string
		if json.Unmarshal(raw, &s) == nil {
			return s
		}
	}

	// Try array
	var items []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &items) == nil {
		for _, item := range items {
			if item.Type == "text" && item.Text != "" {
				return item.Text
			}
		}
	}

	return ""
}
```

**`cctl/pkg/session/discover_test.go`** (new):
```go
package session

import (
	"testing"
	"time"
)

func TestEncodePiPath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"/Users/coreycole/dotfiles", "--Users-coreycole-dotfiles--"},
	}
	for _, tt := range tests {
		got := encodePiPath(tt.input)
		if got != tt.want {
			t.Errorf("encodePiPath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestDecodePiPath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"--Users-coreycole-dotfiles--", "/Users/coreycole/dotfiles"},
	}
	for _, tt := range tests {
		got := decodePiPath(tt.input)
		if got != tt.want {
			t.Errorf("decodePiPath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestEncodeClaudePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"/Users/coreycole/dotfiles", "-Users-coreycole-dotfiles"},
	}
	for _, tt := range tests {
		got := encodeClaudePath(tt.input)
		if got != tt.want {
			t.Errorf("encodeClaudePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestDecodeClaudePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"-Users-coreycole-dotfiles", "/Users/coreycole/dotfiles"},
	}
	for _, tt := range tests {
		got := decodeClaudePath(tt.input)
		if got != tt.want {
			t.Errorf("decodeClaudePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestPiTimestamp(t *testing.T) {
	ts, err := piTimestamp("2026-04-09T17-13-10-661Z_539db649-ea6e-462f-b249-8ea6a57b9b97.jsonl")
	if err != nil {
		t.Fatalf("piTimestamp: %v", err)
	}
	expected := time.Date(2026, 4, 9, 17, 13, 10, 661000000, time.UTC)
	if !ts.Equal(expected) {
		t.Errorf("piTimestamp = %v, want %v", ts, expected)
	}
}
```

### Verify
```bash
cd cctl && go test ./pkg/session/ -v
```

---

## Slice 8: Self-update mechanism + AGENTS.md

### Files
- `cctl/VERSION` (new)
- `cctl/AGENTS.md` (new)
- `cctl/pkg/selfupdate/selfupdate.go` (new)
- `cctl/main.go` (new — initial version with just version variable)

### Changes

**`cctl/VERSION`** (new):
```
1
```

**`cctl/AGENTS.md`** (new):
```markdown
# cctl — Agent Instructions

After making ANY code changes to cctl, increment the integer in `cctl/VERSION` by 1.
This triggers an auto-rebuild on the next invocation.
```

**`cctl/pkg/selfupdate/selfupdate.go`** (new):
```go
package selfupdate

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// CheckAndRebuild checks if the compiled version matches the source VERSION file.
// If the source version is newer, it rebuilds the binary and re-execs.
func CheckAndRebuild(compiledVersion string) error {
	srcDir, err := sourceDir()
	if err != nil {
		return nil // Can't determine source dir, continue normally
	}

	sourceVer, err := readVersionFile(srcDir)
	if err != nil {
		return nil // No VERSION file, continue normally
	}

	compiledVer, err := strconv.Atoi(compiledVersion)
	if err != nil {
		compiledVer = 0
	}

	if sourceVer <= compiledVer {
		return nil // Up to date
	}

	// Rebuild
	fmt.Fprintf(os.Stderr, "cctl: auto-rebuilding (v%d → v%d)...\n", compiledVer, sourceVer)

	ldflags := fmt.Sprintf("-X main.version=%d", sourceVer)
	outputPath := filepath.Join(srcDir, "bin", "cctl")

	// Ensure bin/ directory exists
	os.MkdirAll(filepath.Join(srcDir, "bin"), 0755)

	cmd := exec.Command("go", "build", "-ldflags", ldflags, "-o", outputPath, ".")
	cmd.Dir = srcDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("rebuild failed: %w", err)
	}

	// Re-exec the new binary with the same args
	return syscall.Exec(outputPath, os.Args, os.Environ())
}

// sourceDir resolves the source directory from the binary location.
// Binary is at <srcDir>/bin/cctl, so we go up one level from the binary's dir.
func sourceDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}

	// Follow symlinks
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}

	// Binary is at <srcDir>/bin/cctl → go up two levels
	binDir := filepath.Dir(exe)
	srcDir := filepath.Dir(binDir)

	// Verify this looks like a source dir (has go.mod)
	if _, err := os.Stat(filepath.Join(srcDir, "go.mod")); err != nil {
		return "", fmt.Errorf("no go.mod found at %s", srcDir)
	}

	return srcDir, nil
}

// readVersionFile reads and parses the VERSION file as an integer.
func readVersionFile(dir string) (int, error) {
	data, err := os.ReadFile(filepath.Join(dir, "VERSION"))
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(strings.TrimSpace(string(data)))
}
```

**`cctl/main.go`** (new — initial scaffolding):
```go
package main

import (
	"fmt"
	"os"

	"github.com/coreycole/cctl/pkg/selfupdate"
)

// version is set by -ldflags "-X main.version=N"
var version string

func main() {
	// Self-update check before anything else
	if err := selfupdate.CheckAndRebuild(version); err != nil {
		fmt.Fprintf(os.Stderr, "selfupdate: %v\n", err)
		// Continue anyway
	}

	// Cobra commands will be wired in slice 9
	fmt.Println("cctl version", version)
}
```

### Verify
```bash
cd cctl && mkdir -p bin && go build -ldflags "-X main.version=1" -o bin/cctl . && ./bin/cctl
# Should print: cctl version 1
```

---

## Slice 9: CLI + fzf picker + launch

### Files
- `cctl/go.mod` (modify — add cobra dependency)
- `cctl/main.go` (modify — wire cobra)
- `cctl/cmd/root.go` (new)
- `cctl/cmd/resume.go` (new)
- `cctl/pkg/picker/fzf.go` (new)

### Changes

**`cctl/go.mod`** (modify — add cobra):

After creating the initial go.mod, run:
```bash
cd cctl && go get github.com/spf13/cobra@latest && go mod tidy
```

**`cctl/main.go`** (modify — replace temporary scaffolding):
```go
package main

import (
	"fmt"
	"os"

	"github.com/coreycole/cctl/cmd"
	"github.com/coreycole/cctl/pkg/selfupdate"
)

// version is set by -ldflags "-X main.version=N"
var version string

func main() {
	// Self-update check before anything else
	if err := selfupdate.CheckAndRebuild(version); err != nil {
		fmt.Fprintf(os.Stderr, "selfupdate: %v\n", err)
	}

	cmd.Version = version
	cmd.Execute()
}
```

**`cctl/cmd/root.go`** (new):
```go
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// Version is set by main.go from ldflags.
var Version string

var rootCmd = &cobra.Command{
	Use:   "cctl",
	Short: "Dotfiles workflow Swiss army knife",
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("cctl version", Version)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
```

**`cctl/cmd/resume.go`** (new):
```go
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/coreycole/cctl/pkg/convert"
	"github.com/coreycole/cctl/pkg/picker"
	"github.com/coreycole/cctl/pkg/session"
	"github.com/spf13/cobra"
)

var printFlag bool

var resumeCmd = &cobra.Command{
	Use:   "resume",
	Short: "Resume a pi or Claude session with fzf picker",
	RunE:  runResume,
}

func init() {
	resumeCmd.Flags().BoolVar(&printFlag, "print", false, "Print converted JSONL to stdout instead of launching pi")
	rootCmd.AddCommand(resumeCmd)
}

func runResume(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getting cwd: %w", err)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("getting home dir: %w", err)
	}

	piDir := filepath.Join(home, ".pi", "agent", "sessions")
	claudeDir := filepath.Join(home, ".claude", "projects")

	sessions, err := session.DiscoverSessions(cwd, piDir, claudeDir)
	if err != nil {
		return fmt.Errorf("discovering sessions: %w", err)
	}

	if len(sessions) == 0 {
		fmt.Println("No sessions found for", cwd)
		return nil
	}

	// Format items for fzf
	items := make([]string, len(sessions))
	for i, s := range sessions {
		dateStr := s.Date.Format("2006-01-02 15:04")
		preview := s.Preview
		if preview == "" {
			preview = "(no preview)"
		}
		items[i] = fmt.Sprintf("[%s] %s  %s", s.Source, dateStr, preview)
	}

	selected, err := picker.Pick(items)
	if err != nil {
		return fmt.Errorf("fzf picker: %w", err)
	}

	// Find the selected session
	var selectedSession *session.SessionInfo
	for i, item := range items {
		if item == selected {
			selectedSession = &sessions[i]
			break
		}
	}

	if selectedSession == nil {
		return fmt.Errorf("selected session not found")
	}

	switch selectedSession.Source {
	case "pi":
		if printFlag {
			data, err := os.ReadFile(selectedSession.Path)
			if err != nil {
				return err
			}
			fmt.Print(string(data))
			return nil
		}
		return execPiFork(selectedSession.Path)

	case "claude":
		data, err := os.ReadFile(selectedSession.Path)
		if err != nil {
			return fmt.Errorf("reading claude session: %w", err)
		}

		converted, err := convert.ConvertSession(data)
		if err != nil {
			return fmt.Errorf("converting claude session: %w", err)
		}

		if printFlag {
			fmt.Print(string(converted))
			return nil
		}

		// Write to temp file
		sessionUUID := strings.TrimSuffix(filepath.Base(selectedSession.Path), ".jsonl")
		tmpPath := filepath.Join(os.TempDir(), fmt.Sprintf("cctl-claude-%s.jsonl", sessionUUID))
		if err := os.WriteFile(tmpPath, converted, 0644); err != nil {
			return fmt.Errorf("writing temp file: %w", err)
		}

		return execPiFork(tmpPath)
	}

	return fmt.Errorf("unknown session source: %s", selectedSession.Source)
}

// execPiFork execs `pi --fork <path>`, replacing the current process.
func execPiFork(sessionPath string) error {
	piPath, err := findPi()
	if err != nil {
		return err
	}
	return syscall.Exec(piPath, []string{"pi", "--fork", sessionPath}, os.Environ())
}

// findPi finds the pi binary in PATH.
func findPi() (string, error) {
	path, err := os.LookupPath("pi")
	if err != nil {
		// Try common locations
		for _, p := range []string{"/usr/local/bin/pi", "/opt/homebrew/bin/pi"} {
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
		return "", fmt.Errorf("pi not found in PATH")
	}
	return path, nil
}
```

**`cctl/pkg/picker/fzf.go`** (new):
```go
package picker

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Pick presents items via fzf and returns the selected item.
func Pick(items []string) (string, error) {
	fzfPath, err := exec.LookPath("fzf")
	if err != nil {
		return "", fmt.Errorf("fzf not found in PATH: %w", err)
	}

	cmd := exec.Command(fzfPath, "--ansi", "--reverse", "--no-sort")
	cmd.Stdin = strings.NewReader(strings.Join(items, "\n"))
	cmd.Stderr = os.Stderr

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 130 {
				// User cancelled with Ctrl-C/Esc
				os.Exit(0)
			}
		}
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}
```

**`cctl/cmd/resume.go`** — note: `os.LookupPath` should be `exec.LookPath`. The `findPi` function above uses `os.LookupPath` which doesn't exist. Fix: use `exec.LookPath` instead:

```go
import "os/exec"

func findPi() (string, error) {
	path, err := exec.LookPath("pi")
	// ...
}
```

### Build and wire up

After creating all files:
```bash
cd cctl
go get github.com/spf13/cobra@latest
go mod tidy
echo '1' > VERSION
mkdir -p bin
go build -ldflags "-X main.version=$(cat VERSION)" -o bin/cctl .
```

Then add `~/dotfiles/cctl/bin` to PATH. For nix-darwin, this would go in the shell config or nix-darwin config.

### Verify
```bash
cd cctl && go build -ldflags "-X main.version=$(cat VERSION)" -o bin/cctl . && ./bin/cctl version
# Should print: cctl version 1

cd ~/dotfiles && ../dotfiles/cctl/bin/cctl resume --print
# Should show fzf picker, and print JSONL of selected session
```
