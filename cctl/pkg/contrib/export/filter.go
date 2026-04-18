package export

import "strings"

func allowedUser(username string, whitelist map[string]struct{}) bool {
	if len(whitelist) == 0 {
		return true
	}
	_, ok := whitelist[strings.ToLower(strings.TrimSpace(username))]
	return ok
}

func shouldSkipBot(username string, includeBots bool) bool {
	if includeBots {
		return false
	}
	u := strings.ToLower(strings.TrimSpace(username))
	return strings.HasSuffix(u, "[bot]")
}
