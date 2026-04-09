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
	ParentID  *string    `json:"parentId,omitempty"`
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
