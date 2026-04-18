package config

import (
	"fmt"
	"strings"
	"time"
)

type ExportConfig struct {
	Owner             string
	Repo              string
	StartDate         string
	EndDate           string
	Output            string
	GitHubToken       string
	GitHubUsernames   []string
	IncludeBots       bool
	IncludeDirectPush bool
	KnownExtensions   []string
}

func (c *ExportConfig) Validate() error {
	c.Owner = strings.TrimSpace(c.Owner)
	c.Repo = strings.TrimSpace(c.Repo)
	c.Output = strings.TrimSpace(c.Output)
	if c.Output == "" {
		c.Output = "contributions.csv"
	}

	if c.Owner == "" {
		return fmt.Errorf("--owner is required")
	}
	if c.Repo == "" {
		return fmt.Errorf("--repo is required")
	}
	if _, err := parseDateUTC(c.StartDate); err != nil {
		return fmt.Errorf("invalid --start-date: %w", err)
	}
	if _, err := parseDateUTC(c.EndDate); err != nil {
		return fmt.Errorf("invalid --end-date: %w", err)
	}
	if c.EndTimeInclusive().Before(c.StartTime()) {
		return fmt.Errorf("--end-date must be on/after --start-date")
	}

	c.GitHubUsernames = normalizeUsernames(c.GitHubUsernames)
	return nil
}

func (c *ExportConfig) StartTime() time.Time {
	t, _ := parseDateUTC(c.StartDate)
	return t
}

func (c *ExportConfig) EndTimeInclusive() time.Time {
	t, _ := parseDateUTC(c.EndDate)
	return t.Add(24*time.Hour - time.Nanosecond)
}

func parseDateUTC(s string) (time.Time, error) {
	t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(s), time.UTC)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}

func normalizeUsernames(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, raw := range in {
		for _, part := range strings.Split(raw, ",") {
			u := strings.ToLower(strings.TrimSpace(part))
			if u == "" {
				continue
			}
			if _, ok := seen[u]; ok {
				continue
			}
			seen[u] = struct{}{}
			out = append(out, u)
		}
	}
	return out
}
