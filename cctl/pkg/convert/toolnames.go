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
