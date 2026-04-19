package localgit

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var prPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)Merge pull request #([1-9][0-9]*)`),
	regexp.MustCompile(`\(#([1-9][0-9]*)\)\s*$`),
	regexp.MustCompile(`(?:^|\s)#([1-9][0-9]*)\s*$`),
}

var gitHubRemotePatterns = []*regexp.Regexp{
	regexp.MustCompile(`^git@github\.com:([^/]+)/(.+?)(?:\.git)?$`),
	regexp.MustCompile(`^https://github\.com/([^/]+)/(.+?)(?:\.git)?/?$`),
}

func ParsePRNumber(message string) int {
	message = strings.TrimSpace(message)
	for _, pattern := range prPatterns {
		match := pattern.FindStringSubmatch(message)
		if len(match) != 2 {
			continue
		}
		value, err := strconv.Atoi(match[1])
		if err != nil || value <= 0 {
			continue
		}
		return value
	}
	return 0
}

func NormalizeGitHubRemote(raw string) string {
	raw = strings.TrimSpace(raw)
	for _, pattern := range gitHubRemotePatterns {
		match := pattern.FindStringSubmatch(raw)
		if len(match) != 3 {
			continue
		}
		return fmt.Sprintf("https://github.com/%s/%s", match[1], match[2])
	}
	return ""
}

func CommitURL(repoBaseURL, sha string) string {
	if repoBaseURL == "" || strings.TrimSpace(sha) == "" {
		return ""
	}
	return fmt.Sprintf("%s/commit/%s", repoBaseURL, strings.TrimSpace(sha))
}

func PRURL(repoBaseURL string, prNumber int) string {
	if repoBaseURL == "" || prNumber <= 0 {
		return ""
	}
	return fmt.Sprintf("%s/pull/%d", repoBaseURL, prNumber)
}
