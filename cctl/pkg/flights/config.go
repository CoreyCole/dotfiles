package flights

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	GogBin     string
	Account    string
	Query      string
	MaxResults int
	RootDir    string
	DryRun     bool
}

type Result struct {
	Processed  int
	Written    int
	Skipped    int
	MarkedRead int
	Notes      []string
}

func DefaultRootDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".", ".hermes", "notes", "flights")
	}
	return filepath.Join(home, ".hermes", "notes", "flights")
}

func DefaultQuery() string {
	return "is:unread from:going.com"
}

func DefaultAccount() string {
	return "contact.creativemode.ai@gmail.com"
}

func (c Config) Validate() (Config, error) {
	c.GogBin = strings.TrimSpace(c.GogBin)
	if c.GogBin == "" {
		c.GogBin = "gog"
	}

	c.Account = strings.TrimSpace(c.Account)
	if c.Account == "" {
		c.Account = DefaultAccount()
	}
	c.Query = strings.TrimSpace(c.Query)
	if c.Query == "" {
		c.Query = DefaultQuery()
	}

	c.RootDir = strings.TrimSpace(c.RootDir)
	if c.RootDir == "" {
		c.RootDir = DefaultRootDir()
	}

	if c.MaxResults <= 0 {
		c.MaxResults = 10
	}
	if c.MaxResults > 100 {
		return Config{}, fmt.Errorf("--max-results must be <= 100")
	}

	return c, nil
}

func CheckEmail(ctx context.Context, cfg Config) (Result, error) {
	_, _ = ctx, cfg
	return Result{}, nil
}
