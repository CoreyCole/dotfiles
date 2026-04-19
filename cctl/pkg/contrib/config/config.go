package config

import (
	"fmt"
	"strings"
	"time"
)

type ExportConfig struct {
	RepoDir   string
	Branch    string
	StartDate string
	EndDate   string
	Output    string
}

func (c *ExportConfig) Validate() error {
	c.RepoDir = strings.TrimSpace(c.RepoDir)
	if c.RepoDir == "" {
		c.RepoDir = "."
	}

	c.Branch = strings.TrimSpace(c.Branch)
	if c.Branch == "" {
		c.Branch = "main"
	}

	c.Output = strings.TrimSpace(c.Output)
	if c.Output == "" {
		c.Output = "contributions.csv"
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
