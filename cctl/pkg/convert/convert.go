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

func strPtr(s string) *string {
	return &s
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
					ParentID:  strPtr(lastID),
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
						ParentID:  strPtr(lastID),
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
				ParentID:  strPtr(lastID),
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
