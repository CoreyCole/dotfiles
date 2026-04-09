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
	s := strings.TrimPrefix(dirName, "--")
	s = strings.TrimSuffix(s, "--")
	return "/" + strings.ReplaceAll(s, "-", "/")
}

// encodeClaudePath: /Users/coreycole/dotfiles → -Users-coreycole-dotfiles
func encodeClaudePath(path string) string {
	return strings.ReplaceAll(path, "/", "-")
}

// decodeClaudePath: -Users-coreycole-dotfiles → /Users/coreycole/dotfiles
func decodeClaudePath(dirName string) string {
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
	parts := strings.SplitN(filename, "_", 2)
	if len(parts) < 2 {
		return time.Time{}, fmt.Errorf("invalid pi filename: %s", filename)
	}
	tsStr := parts[0]
	// Convert: 2026-04-09T17-13-10-661Z → 2026-04-09T17:13:10.661Z
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
			// Replace newlines with spaces
			text = strings.ReplaceAll(text, "\n", " ")
			if len(text) > 80 {
				text = text[:77] + "..."
			}
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
