package localgit

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
)

type CommitFile struct {
	Filename  string
	Additions int
	Deletions int
	Changes   int
}

type CommitRecord struct {
	RepoLabel    string
	RepoWebURL   string
	SHA          string
	Message      string
	AuthorName   string
	AuthorEmail  string
	CommittedAt  time.Time
	Additions    int
	Deletions    int
	ChangedFiles int
	Files        []CommitFile
	PRNumber     int
}

type Client struct{}

func New() *Client { return &Client{} }

func (c *Client) ListBranchCommits(ctx context.Context, cfg config.ExportConfig) ([]CommitRecord, error) {
	repoRoot, err := c.repoRoot(ctx, cfg.RepoDir)
	if err != nil {
		return nil, err
	}
	if _, err := c.git(ctx, repoRoot, "rev-parse", "--verify", cfg.Branch); err != nil {
		return nil, fmt.Errorf("resolve branch %q: %w", cfg.Branch, err)
	}

	repoWebURL, _ := c.originWebURL(ctx, repoRoot)
	repoLabel := repoLabel(repoRoot, repoWebURL)

	out, err := c.git(
		ctx,
		repoRoot,
		"log",
		cfg.Branch,
		"--reverse",
		"--since="+cfg.StartTime().Format(time.RFC3339),
		"--until="+cfg.EndTimeInclusive().Format(time.RFC3339),
		"--format=%H%x1f%ct%x1f%an%x1f%ae%x1f%s",
	)
	if err != nil {
		return nil, fmt.Errorf("list commits: %w", err)
	}

	text := strings.TrimSpace(out)
	if text == "" {
		return nil, nil
	}

	scanner := bufio.NewScanner(strings.NewReader(text))
	records := make([]CommitRecord, 0)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Split(line, "\x1f")
		if len(fields) != 5 {
			return nil, fmt.Errorf("unexpected git log row: %q", line)
		}

		committedUnix, err := strconv.ParseInt(fields[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("parse commit time for %s: %w", fields[0], err)
		}

		files, additions, deletions, changedFiles, err := c.commitFiles(ctx, repoRoot, fields[0])
		if err != nil {
			return nil, err
		}

		records = append(records, CommitRecord{
			RepoLabel:    repoLabel,
			RepoWebURL:   repoWebURL,
			SHA:          strings.TrimSpace(fields[0]),
			Message:      strings.TrimSpace(fields[4]),
			AuthorName:   strings.TrimSpace(fields[2]),
			AuthorEmail:  strings.TrimSpace(fields[3]),
			CommittedAt:  time.Unix(committedUnix, 0).UTC(),
			Additions:    additions,
			Deletions:    deletions,
			ChangedFiles: changedFiles,
			Files:        files,
			PRNumber:     ParsePRNumber(fields[4]),
		})
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan git log output: %w", err)
	}

	return records, nil
}

func (c *Client) repoRoot(ctx context.Context, repoDir string) (string, error) {
	absRepoDir, err := filepath.Abs(repoDir)
	if err != nil {
		return "", fmt.Errorf("resolve repo dir: %w", err)
	}

	out, err := c.git(ctx, absRepoDir, "rev-parse", "--show-toplevel")
	if err != nil {
		return "", fmt.Errorf("open repo %s: %w", absRepoDir, err)
	}
	return strings.TrimSpace(out), nil
}

func (c *Client) originWebURL(ctx context.Context, repoRoot string) (string, error) {
	out, err := c.git(ctx, repoRoot, "remote", "get-url", "origin")
	if err != nil {
		return "", nil
	}
	return NormalizeGitHubRemote(strings.TrimSpace(out)), nil
}

func repoLabel(repoRoot, repoWebURL string) string {
	if repoWebURL != "" {
		return strings.TrimPrefix(repoWebURL, "https://github.com/")
	}
	return filepath.Base(repoRoot)
}

func (c *Client) commitFiles(ctx context.Context, repoRoot, sha string) ([]CommitFile, int, int, int, error) {
	out, err := c.git(ctx, repoRoot, "show", "--numstat", "--format=", sha)
	if err != nil {
		return nil, 0, 0, 0, fmt.Errorf("show commit %s: %w", sha, err)
	}

	text := strings.TrimSpace(out)
	if text == "" {
		return nil, 0, 0, 0, nil
	}

	scanner := bufio.NewScanner(strings.NewReader(text))
	files := make([]CommitFile, 0)
	additions := 0
	deletions := 0
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		fields := strings.SplitN(line, "\t", 3)
		if len(fields) != 3 {
			return nil, 0, 0, 0, fmt.Errorf("unexpected numstat row for %s: %q", sha, line)
		}

		added := parseNumstat(fields[0])
		removed := parseNumstat(fields[1])
		files = append(files, CommitFile{
			Filename:  fields[2],
			Additions: added,
			Deletions: removed,
			Changes:   added + removed,
		})
		additions += added
		deletions += removed
	}
	if err := scanner.Err(); err != nil {
		return nil, 0, 0, 0, fmt.Errorf("scan numstat for %s: %w", sha, err)
	}

	return files, additions, deletions, len(files), nil
}

func parseNumstat(raw string) int {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "-" {
		return 0
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return value
}

func (c *Client) git(ctx context.Context, repoRoot string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", repoRoot}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
