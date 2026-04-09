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
