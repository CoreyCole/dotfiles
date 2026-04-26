---
date: 2026-04-18T17:55:33-07:00
researcher: corey
last_updated_by: corey
git_commit: 4badb67efa0f18a5b52fc2851a5a8cda213fcc9a
branch: main
repository: cctl
stage: plan
ticket: "Contrib export v2 local-only mode"
plan_dir: "thoughts/CoreyCole/plans/2026-04-17_12-10-00_contrib-analyzer-outline"
---

# Implementation Plan: `c contrib export` local-only v2

## Status
- [ ] Slice 1: CLI and config rewrite
- [ ] Slice 2: Local git collection primitives
- [ ] Slice 3: Local row builder and exporter
- [ ] Slice 4: Command integration and docs cleanup

Implementation target: `/home/ruby/dotfiles/cctl`

Project rule to carry through implementation: after the code changes are complete, increment the integer in `/home/ruby/dotfiles/cctl/VERSION` by 1 before the final verification pass.

## Slice 1: CLI and config rewrite

### Files
- `/home/ruby/dotfiles/cctl/cmd/contrib_export.go` (modify)
- `/home/ruby/dotfiles/cctl/pkg/contrib/config/config.go` (modify)
- `/home/ruby/dotfiles/cctl/pkg/contrib/config/config_test.go` (rewrite)

### Changes

**`/home/ruby/dotfiles/cctl/pkg/contrib/config/config.go`**

Replace the GitHub-era config with a local-only config. Keep the date parsing helpers, but remove owner/repo/token/filter fields entirely.

```go
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
```

**`/home/ruby/dotfiles/cctl/pkg/contrib/config/config_test.go`**

Rewrite the tests around defaults and date validation instead of username normalization.

```go
package config

import "testing"

func TestValidateAppliesDefaults(t *testing.T) {
	cfg := ExportConfig{
		StartDate: "2026-04-01",
		EndDate:   "2026-04-30",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if cfg.RepoDir != "." {
		t.Fatalf("RepoDir = %q, want .", cfg.RepoDir)
	}
	if cfg.Branch != "main" {
		t.Fatalf("Branch = %q, want main", cfg.Branch)
	}
	if cfg.Output != "contributions.csv" {
		t.Fatalf("Output = %q, want contributions.csv", cfg.Output)
	}
}

func TestValidateRejectsInvalidRange(t *testing.T) {
	cfg := ExportConfig{
		RepoDir:   ".",
		Branch:    "main",
		StartDate: "2026-04-10",
		EndDate:   "2026-04-01",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected range error")
	}
}

func TestValidateRejectsBadDate(t *testing.T) {
	cfg := ExportConfig{
		RepoDir:   ".",
		Branch:    "main",
		StartDate: "2026-04-xx",
		EndDate:   "2026-04-01",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected invalid date error")
	}
}
```

**`/home/ruby/dotfiles/cctl/cmd/contrib_export.go`**

Delete all GitHub-token, owner/repo, whitelist, bot, and direct-push handling. Keep `countCSVRows`, but make the command local-only and route straight to `export.ExportLocalCSV`.

```go
package cmd

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/export"
	"github.com/spf13/cobra"
)

var exportCfg config.ExportConfig

var contribExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export contributor CSV from a local branch",
	RunE:  runContribExport,
}

func init() {
	contribExportCmd.Flags().StringVar(&exportCfg.RepoDir, "repo-dir", ".", "Local repository path")
	contribExportCmd.Flags().StringVar(&exportCfg.Branch, "branch", "main", "Branch to export")
	contribExportCmd.Flags().StringVar(&exportCfg.StartDate, "start-date", "", "Start date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.EndDate, "end-date", "", "End date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.Output, "output", "contributions.csv", "Output CSV path")

	_ = contribExportCmd.MarkFlagRequired("start-date")
	_ = contribExportCmd.MarkFlagRequired("end-date")

	contribCmd.AddCommand(contribExportCmd)
}

func runContribExport(cmd *cobra.Command, args []string) error {
	if err := exportCfg.Validate(); err != nil {
		return err
	}

	out, err := os.Create(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	err = export.ExportLocalCSV(context.Background(), exportCfg, out)
	if closeErr := out.Close(); closeErr != nil && err == nil {
		err = fmt.Errorf("close output: %w", closeErr)
	}
	if err != nil {
		return fmt.Errorf("export failed: %w", err)
	}

	rows, err := countCSVRows(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("count output rows: %w", err)
	}

	fmt.Fprintf(
		cmd.OutOrStdout(),
		"repo_dir=%s branch=%s date=%s..%s rows=%d output=%s\n",
		exportCfg.RepoDir,
		exportCfg.Branch,
		exportCfg.StartDate,
		exportCfg.EndDate,
		rows,
		exportCfg.Output,
	)
	return nil
}

func countCSVRows(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil {
		if err == io.EOF {
			return 0, nil
		}
		return 0, fmt.Errorf("read header: %w", err)
	}

	count := 0
	for {
		if _, err := r.Read(); err != nil {
			if err == io.EOF {
				return count, nil
			}
			return 0, fmt.Errorf("read data rows: %w", err)
		}
		count++
	}
}
```

### Tests
- `/home/ruby/dotfiles/cctl/pkg/contrib/config/config_test.go`

### Verify
```bash
cd /home/ruby/dotfiles/cctl &&
go test ./pkg/contrib/config -v &&
go run . contrib export --help
```

---

## Slice 2: Local git collection primitives

### Files
- `/home/ruby/dotfiles/cctl/pkg/contrib/localgit/client.go` (new)
- `/home/ruby/dotfiles/cctl/pkg/contrib/localgit/parse.go` (new)
- `/home/ruby/dotfiles/cctl/pkg/contrib/localgit/client_test.go` (new)

### Changes

**`/home/ruby/dotfiles/cctl/pkg/contrib/localgit/client.go`**

Create a small git-CLI client that resolves the worktree root, reads commits from a branch in a date range, gathers `--numstat` file data per commit, and derives repo label/URLs from `origin` when possible.

```go
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
```

**`/home/ruby/dotfiles/cctl/pkg/contrib/localgit/parse.go`**

Keep all PR parsing and remote normalization in one helper file.

```go
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
```

**`/home/ruby/dotfiles/cctl/pkg/contrib/localgit/client_test.go`**

Use a real temporary git repo so the tests cover the exact CLI commands the implementation will run.

```go
package localgit

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/coreycole/cctl/pkg/contrib/config"
)

func TestParsePRNumber(t *testing.T) {
	tests := []struct {
		message string
		want    int
	}{
		{"Merge pull request #123 from org/feature", 123},
		{"add export sorting fix (#456)", 456},
		{"docs: cleanup #789", 789},
		{"plain commit", 0},
	}
	for _, tt := range tests {
		if got := ParsePRNumber(tt.message); got != tt.want {
			t.Fatalf("ParsePRNumber(%q) = %d, want %d", tt.message, got, tt.want)
		}
	}
}

func TestNormalizeGitHubRemote(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"git@github.com:coreycole/cctl.git", "https://github.com/coreycole/cctl"},
		{"https://github.com/coreycole/cctl.git", "https://github.com/coreycole/cctl"},
		{"https://github.com/coreycole/cctl", "https://github.com/coreycole/cctl"},
		{"ssh://git@example.com/internal/repo", ""},
	}
	for _, tt := range tests {
		if got := NormalizeGitHubRemote(tt.raw); got != tt.want {
			t.Fatalf("NormalizeGitHubRemote(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestListBranchCommits(t *testing.T) {
	repoDir := t.TempDir()
	runGit(t, repoDir, nil, "init", "-b", "main")
	runGit(t, repoDir, nil, "config", "user.name", "Alice Example")
	runGit(t, repoDir, nil, "config", "user.email", "alice@example.com")
	runGit(t, repoDir, nil, "remote", "add", "origin", "git@github.com:coreycole/cctl.git")

	commitFile(t, repoDir, "README.md", "hello\n", "2026-01-02T12:00:00Z", "initial commit")
	commitFile(t, repoDir, "main.go", "package main\n", "2026-01-03T12:00:00Z", "add export path (#42)")

	cfg := config.ExportConfig{
		RepoDir:   repoDir,
		Branch:    "main",
		StartDate: "2026-01-01",
		EndDate:   "2026-01-31",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}

	records, err := New().ListBranchCommits(context.Background(), cfg)
	if err != nil {
		t.Fatalf("ListBranchCommits: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("got %d records, want 2", len(records))
	}

	second := records[1]
	if second.RepoLabel != "coreycole/cctl" {
		t.Fatalf("RepoLabel = %q", second.RepoLabel)
	}
	if second.RepoWebURL != "https://github.com/coreycole/cctl" {
		t.Fatalf("RepoWebURL = %q", second.RepoWebURL)
	}
	if second.PRNumber != 42 {
		t.Fatalf("PRNumber = %d, want 42", second.PRNumber)
	}
	if second.AuthorEmail != "alice@example.com" {
		t.Fatalf("AuthorEmail = %q", second.AuthorEmail)
	}
	if second.ChangedFiles != 1 {
		t.Fatalf("ChangedFiles = %d, want 1", second.ChangedFiles)
	}
	if len(second.Files) != 1 || second.Files[0].Filename != "main.go" {
		t.Fatalf("unexpected file stats: %#v", second.Files)
	}
}

func commitFile(t *testing.T, repoDir, name, body, when, message string) {
	t.Helper()
	path := filepath.Join(repoDir, name)
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	runGit(t, repoDir, nil, "add", name)
	runGit(t, repoDir, []string{
		"GIT_AUTHOR_DATE=" + when,
		"GIT_COMMITTER_DATE=" + when,
	}, "commit", "-m", message)
}

func runGit(t *testing.T, repoDir string, extraEnv []string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", repoDir}, args...)...)
	cmd.Env = append(os.Environ(), extraEnv...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, string(out))
	}
}
```

### Tests
- `/home/ruby/dotfiles/cctl/pkg/contrib/localgit/client_test.go`

### Verify
```bash
cd /home/ruby/dotfiles/cctl &&
go test ./pkg/contrib/localgit -v
```

---

## Slice 3: Local row builder and exporter

### Files
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service.go` (rewrite)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service_test.go` (rewrite)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/extensions.go` (modify)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/extensions_test.go` (modify)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/csv.go` (leave unchanged)

### Changes

**`/home/ruby/dotfiles/cctl/pkg/contrib/export/service.go`**

Keep `Row` exactly as it is today, but remove the GitHub client/service abstraction entirely. Replace the old service code with a direct local export function and a local row builder.

```go
package export

import (
	"context"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/localgit"
)

type Row struct {
	Repo                      string
	MergedAt                  time.Time
	PRCreatedAt               time.Time
	CycleTimeHours            float64
	CommitSHA                 string
	CommitURL                 string
	GitHubUsername            string
	GitHubName                string
	PRNumber                  int
	PRTitle                   string
	PRURL                     string
	LinesAdded                int
	LinesRemoved              int
	FilesTouched              int
	Labels                    []string
	AuthorAssociation         string
	MergedBy                  string
	ReviewCount               int
	CommentCount              int
	BaseBranch                string
	HeadBranch                string
	IsDraft                   bool
	GoLinesAdded              int
	GoLinesRemoved            int
	GoFilesTouched            int
	ProtoLinesAdded           int
	ProtoLinesRemoved         int
	ProtoFilesTouched         int
	SQLLinesAdded             int
	SQLLinesRemoved           int
	SQLFilesTouched           int
	MDLinesAdded              int
	MDLinesRemoved            int
	MDFilesTouched            int
	TSLinesAdded              int
	TSLinesRemoved            int
	TSFilesTouched            int
	TSXLinesAdded             int
	TSXLinesRemoved           int
	TSXFilesTouched           int
	OtherLinesByExtensionJSON string
}

var knownExtensions = []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"}

func ExportLocalCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error {
	commits, err := localgit.New().ListBranchCommits(ctx, cfg)
	if err != nil {
		return err
	}

	rows := make([]Row, 0, len(commits))
	for _, commit := range commits {
		rows = append(rows, BuildLocalRow(commit))
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].MergedAt.Equal(rows[j].MergedAt) {
			return rows[i].CommitSHA < rows[j].CommitSHA
		}
		return rows[i].MergedAt.Before(rows[j].MergedAt)
	})

	return WriteCSV(w, rows)
}

func BuildLocalRow(commit localgit.CommitRecord) Row {
	ext := AccumulateByExtension(commit.Files)
	row := Row{
		Repo:           commit.RepoLabel,
		MergedAt:       commit.CommittedAt.UTC(),
		PRCreatedAt:    commit.CommittedAt.UTC(),
		CycleTimeHours: 0,
		CommitSHA:      commit.SHA,
		CommitURL:      localgit.CommitURL(commit.RepoWebURL, commit.SHA),
		GitHubUsername: localIdentity(commit.AuthorEmail, commit.AuthorName),
		GitHubName:     strings.TrimSpace(commit.AuthorName),
		PRNumber:       commit.PRNumber,
		PRTitle:        strings.TrimSpace(commit.Message),
		PRURL:          localgit.PRURL(commit.RepoWebURL, commit.PRNumber),
		LinesAdded:     commit.Additions,
		LinesRemoved:   commit.Deletions,
		FilesTouched:   commit.ChangedFiles,
	}
	ApplyKnownExtensionColumns(&row, ext)
	other, _ := EncodeOtherExtensionStats(ext, knownExtensions)
	row.OtherLinesByExtensionJSON = other
	return row
}

func localIdentity(email, name string) string {
	if v := strings.ToLower(strings.TrimSpace(email)); v != "" {
		return v
	}
	return strings.ToLower(strings.TrimSpace(name))
}
```

Delete `Service`, `NewService`, `BuildDirectPushRow`, the old GitHub-only `BuildRow`, and all `githubapi` imports from this file.

**`/home/ruby/dotfiles/cctl/pkg/contrib/export/extensions.go`**

Replace the `githubapi` types with local types so the export package no longer depends on the deleted GitHub client package.

```go
package export

import (
	"encoding/json"
	"path/filepath"
	"sort"
	"strings"

	"github.com/coreycole/cctl/pkg/contrib/localgit"
)

type ExtensionStat struct {
	Added        int `json:"added"`
	Removed      int `json:"removed"`
	Changed      int `json:"changed"`
	FilesTouched int `json:"files_touched"`
}

func AccumulateByExtension(files []localgit.CommitFile) map[string]ExtensionStat {
	stats := map[string]ExtensionStat{}
	for _, f := range files {
		ext := extensionForFile(f.Filename)
		cur := stats[ext]
		cur.Added += f.Additions
		cur.Removed += f.Deletions
		cur.Changed += f.Changes
		cur.FilesTouched++
		stats[ext] = cur
	}
	return stats
}

func extensionForFile(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == "" {
		return "_no_ext"
	}
	return ext
}

func ApplyKnownExtensionColumns(row *Row, stats map[string]ExtensionStat) {
	if s, ok := stats[".go"]; ok {
		row.GoLinesAdded, row.GoLinesRemoved, row.GoFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".proto"]; ok {
		row.ProtoLinesAdded, row.ProtoLinesRemoved, row.ProtoFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".sql"]; ok {
		row.SQLLinesAdded, row.SQLLinesRemoved, row.SQLFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".md"]; ok {
		row.MDLinesAdded, row.MDLinesRemoved, row.MDFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".ts"]; ok {
		row.TSLinesAdded, row.TSLinesRemoved, row.TSFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
	if s, ok := stats[".tsx"]; ok {
		row.TSXLinesAdded, row.TSXLinesRemoved, row.TSXFilesTouched = s.Added, s.Removed, s.FilesTouched
	}
}

func EncodeOtherExtensionStats(stats map[string]ExtensionStat, known []string) (string, error) {
	knownSet := map[string]struct{}{}
	for _, k := range known {
		knownSet[strings.ToLower(k)] = struct{}{}
	}

	keys := make([]string, 0, len(stats))
	for k := range stats {
		if _, ok := knownSet[strings.ToLower(k)]; ok {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	ordered := map[string]ExtensionStat{}
	for _, k := range keys {
		ordered[k] = stats[k]
	}

	b, err := json.Marshal(ordered)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
```

**`/home/ruby/dotfiles/cctl/pkg/contrib/export/extensions_test.go`**

Keep the same assertions, but switch the test inputs from `githubapi.PRFile` to `localgit.CommitFile` and switch the decoded map type from `githubapi.ExtensionStat` to `ExtensionStat`.

```go
package export

import (
	"encoding/json"
	"testing"

	"github.com/coreycole/cctl/pkg/contrib/localgit"
)

func TestAccumulateByExtensionMixed(t *testing.T) {
	files := []localgit.CommitFile{
		{Filename: "main.go", Additions: 10, Deletions: 2, Changes: 12},
		{Filename: "schema.sql", Additions: 4, Deletions: 1, Changes: 5},
		{Filename: "notes.md", Additions: 1, Deletions: 3, Changes: 4},
		{Filename: "handler.proto", Additions: 6, Deletions: 2, Changes: 8},
		{Filename: "index.ts", Additions: 7, Deletions: 1, Changes: 8},
		{Filename: "ui.tsx", Additions: 2, Deletions: 0, Changes: 2},
	}

	ext := AccumulateByExtension(files)
	if got := extStat(ext, ".go", 10, 2, 12, 1); !got {
		t.Fatalf("missing expected .go stats: %#v", ext[".go"])
	}
	if got := extStat(ext, ".sql", 4, 1, 5, 1); !got {
		t.Fatalf("missing expected .sql stats: %#v", ext[".sql"])
	}
	if got := extStat(ext, ".md", 1, 3, 4, 1); !got {
		t.Fatalf("missing expected .md stats: %#v", ext[".md"])
	}
}

func TestApplyKnownAndEncodeOther(t *testing.T) {
	files := []localgit.CommitFile{
		{Filename: "main.go", Additions: 4, Deletions: 1, Changes: 5},
		{Filename: "legacy.legacy", Additions: 7, Deletions: 3, Changes: 10},
		{Filename: "note.md", Additions: 1, Deletions: 0, Changes: 1},
		{Filename: "other", Additions: 2, Deletions: 2, Changes: 4},
	}

	ext := AccumulateByExtension(files)
	row := Row{}
	ApplyKnownExtensionColumns(&row, ext)
	other, err := EncodeOtherExtensionStats(ext, []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"})
	if err != nil {
		t.Fatalf("EncodeOtherExtensionStats: %v", err)
	}

	var got map[string]ExtensionStat
	if err := json.Unmarshal([]byte(other), &got); err != nil {
		t.Fatalf("json unmarshal: %v", err)
	}
	if _, ok := got["_no_ext"]; !ok {
		t.Fatalf("expected _no_ext in other stats: %#v", got)
	}
	if _, ok := got[".legacy"]; !ok {
		t.Fatalf("expected .legacy in other stats: %#v", got)
	}
}

func TestUppercaseExtensionNormalizedForKnown(t *testing.T) {
	ext := AccumulateByExtension([]localgit.CommitFile{{Filename: "DOC.MD", Additions: 2, Deletions: 1, Changes: 3}})
	if stat, ok := ext[".md"]; !ok || stat.Added != 2 || stat.Removed != 1 || stat.Changed != 3 || stat.FilesTouched != 1 {
		t.Fatalf("expected normalized .md stats, got %#v", ext)
	}
}

func extStat(m map[string]ExtensionStat, ext string, added, removed, changed, files int) bool {
	s, ok := m[ext]
	if !ok {
		return false
	}
	return s.Added == added && s.Removed == removed && s.Changed == changed && s.FilesTouched == files
}
```

**`/home/ruby/dotfiles/cctl/pkg/contrib/export/service_test.go`**

Throw away the fake GitHub client tests. Replace them with local-row tests plus one export test that uses a temp git repo.

```go
package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/localgit"
)

func TestBuildLocalRowBlankPRFieldsWhenMissing(t *testing.T) {
	row := BuildLocalRow(localgit.CommitRecord{
		RepoLabel:    "coreycole/cctl",
		RepoWebURL:   "https://github.com/coreycole/cctl",
		SHA:          "abc123",
		Message:      "docs: cleanup",
		AuthorName:   "Alice Example",
		AuthorEmail:  "alice@example.com",
		CommittedAt:  time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC),
		Additions:    3,
		Deletions:    1,
		ChangedFiles: 1,
		Files: []localgit.CommitFile{{
			Filename:  "README.md",
			Additions: 3,
			Deletions: 1,
			Changes:   4,
		}},
	})

	if row.PRNumber != 0 {
		t.Fatalf("PRNumber = %d, want 0", row.PRNumber)
	}
	if row.PRURL != "" {
		t.Fatalf("PRURL = %q, want empty", row.PRURL)
	}
	if row.GitHubUsername != "alice@example.com" {
		t.Fatalf("GitHubUsername = %q", row.GitHubUsername)
	}
	if row.MDFilesTouched != 1 {
		t.Fatalf("MDFilesTouched = %d, want 1", row.MDFilesTouched)
	}

	record := Record(row)
	if record[8] != "" {
		t.Fatalf("csv pr_number = %q, want empty", record[8])
	}
}

func TestBuildLocalRowPopulatesURLsAndExtensions(t *testing.T) {
	row := BuildLocalRow(localgit.CommitRecord{
		RepoLabel:    "coreycole/cctl",
		RepoWebURL:   "https://github.com/coreycole/cctl",
		SHA:          "def456",
		Message:      "add export path (#42)",
		AuthorName:   "Alice Example",
		AuthorEmail:  "alice@example.com",
		CommittedAt:  time.Date(2026, 1, 3, 12, 0, 0, 0, time.UTC),
		Additions:    7,
		Deletions:    2,
		ChangedFiles: 2,
		PRNumber:     42,
		Files: []localgit.CommitFile{
			{Filename: "main.go", Additions: 5, Deletions: 1, Changes: 6},
			{Filename: "README.md", Additions: 2, Deletions: 1, Changes: 3},
		},
	})

	if row.CommitURL != "https://github.com/coreycole/cctl/commit/def456" {
		t.Fatalf("CommitURL = %q", row.CommitURL)
	}
	if row.PRURL != "https://github.com/coreycole/cctl/pull/42" {
		t.Fatalf("PRURL = %q", row.PRURL)
	}
	if row.GoFilesTouched != 1 || row.MDFilesTouched != 1 {
		t.Fatalf("unexpected extension counts: %#v", row)
	}
}

func TestExportLocalCSVWritesOneRowPerCommit(t *testing.T) {
	repoDir := t.TempDir()
	runGit(t, repoDir, nil, "init", "-b", "main")
	runGit(t, repoDir, nil, "config", "user.name", "Alice Example")
	runGit(t, repoDir, nil, "config", "user.email", "alice@example.com")
	runGit(t, repoDir, nil, "remote", "add", "origin", "git@github.com:coreycole/cctl.git")

	commitFile(t, repoDir, "README.md", "hello\n", "2026-01-02T12:00:00Z", "initial commit")
	commitFile(t, repoDir, "main.go", "package main\n", "2026-01-03T12:00:00Z", "add export path (#42)")

	cfg := config.ExportConfig{
		RepoDir:   repoDir,
		Branch:    "main",
		StartDate: "2026-01-01",
		EndDate:   "2026-01-31",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}

	var buf bytes.Buffer
	if err := ExportLocalCSV(context.Background(), cfg, &buf); err != nil {
		t.Fatalf("ExportLocalCSV: %v", err)
	}

	records := parseCSVRecords(t, buf.String())
	if len(records) != 3 {
		t.Fatalf("got %d csv lines, want 3", len(records))
	}
	if records[1][9] != "initial commit" {
		t.Fatalf("first row title = %q", records[1][9])
	}
	if records[2][8] != "42" {
		t.Fatalf("second row pr_number = %q, want 42", records[2][8])
	}
}

func commitFile(t *testing.T, repoDir, name, body, when, message string) {
	t.Helper()
	path := filepath.Join(repoDir, name)
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	runGit(t, repoDir, nil, "add", name)
	runGit(t, repoDir, []string{
		"GIT_AUTHOR_DATE=" + when,
		"GIT_COMMITTER_DATE=" + when,
	}, "commit", "-m", message)
}

func runGit(t *testing.T, repoDir string, extraEnv []string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", repoDir}, args...)...)
	cmd.Env = append(os.Environ(), extraEnv...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, string(out))
	}
}

func parseCSVRecords(t *testing.T, output string) [][]string {
	t.Helper()
	r := csv.NewReader(strings.NewReader(output))
	records, err := r.ReadAll()
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	return records
}
```

`/home/ruby/dotfiles/cctl/pkg/contrib/export/csv.go` already has the correct blank-`pr_number` behavior. Do not change it unless the new tests expose a formatting bug.

### Tests
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service_test.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/extensions_test.go`
- existing `/home/ruby/dotfiles/cctl/pkg/contrib/export/csv_test.go`

### Verify
```bash
cd /home/ruby/dotfiles/cctl &&
go test ./pkg/contrib/export -run 'TestBuildLocalRow|TestExportLocalCSV|TestAccumulate|TestWriteCSV|TestRecord' -v
```

---

## Slice 4: Command integration and docs cleanup

### Files
- `/home/ruby/dotfiles/cctl/README.md` (modify)
- `/home/ruby/dotfiles/cctl/go.mod` (modify via `go mod tidy`)
- `/home/ruby/dotfiles/cctl/go.sum` (regenerate via `go mod tidy`)
- `/home/ruby/dotfiles/cctl/VERSION` (modify)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/filter.go` (delete)
- `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client.go` (delete)
- `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client_test.go` (delete)
- `/home/ruby/dotfiles/cctl/cmd/contrib_export.go` (final summary-line sanity check only if Slice 1 left GitHub wording behind)

### Changes

**`/home/ruby/dotfiles/cctl/README.md`**

Replace the GitHub-token documentation with local-only usage.

````md
# cctl

## `contrib` command

Contributions are exported as CSV rows from a local repository checkout and branch history.

### `c contrib export`

```bash
c contrib export --start-date 2026-01-01 --end-date 2026-01-31
```

Optional flags:
- `--repo-dir` (default `.`)
- `--branch` (default `main`)
- `--output` (default `contributions.csv`)

Example with explicit repo and branch:

```bash
c contrib export \
  --start-date 2026-01-01 \
  --end-date 2026-01-31 \
  --repo-dir /path/to/repo \
  --branch main \
  --output /tmp/contrib.csv
```

`pr_number` is derived from the commit message when it matches supported PR patterns.
`commit_url` and `pr_url` are populated only when `origin` normalizes to a GitHub HTTPS URL. For non-GitHub remotes, those columns are left blank.
````

**`/home/ruby/dotfiles/cctl/go.mod`**

After deleting the GitHub client package, run `go mod tidy`. The resulting direct dependencies should collapse to Cobra only.

```go
module github.com/coreycole/cctl

go 1.25

require github.com/spf13/cobra v1.10.2

require (
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/spf13/pflag v1.0.9 // indirect
)
```

Do not hand-edit `go.sum`; let `go mod tidy` rewrite it.

**Delete dead code**
- remove `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client.go`
- remove `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client_test.go`
- remove `/home/ruby/dotfiles/cctl/pkg/contrib/export/filter.go`

There should be no remaining `githubapi`, `go-github`, `oauth2`, `--github-token`, `--owner`, `--repo`, `--github-username`, `--include-bots`, or `--include-direct-push` references anywhere in `/home/ruby/dotfiles/cctl`.

**`/home/ruby/dotfiles/cctl/VERSION`**

Read the current integer, increment it by 1, and write the incremented value back. Do not hard-code `4` if the file changed before implementation starts.

### Tests
- full repo test pass after dependency cleanup
- manual CLI smoke test against a temporary fixture repo

### Verify
```bash
cd /home/ruby/dotfiles/cctl &&
tmp_repo=$(mktemp -d) &&
(
  cd "$tmp_repo" &&
  git init -b main &&
  git config user.name "Alice Example" &&
  git config user.email "alice@example.com" &&
  git remote add origin git@github.com:coreycole/demo.git &&
  printf 'hello\n' > README.md &&
  git add README.md &&
  GIT_AUTHOR_DATE=2026-01-02T12:00:00Z GIT_COMMITTER_DATE=2026-01-02T12:00:00Z git commit -m "initial commit" &&
  printf 'package main\n' > main.go &&
  git add main.go &&
  GIT_AUTHOR_DATE=2026-01-03T12:00:00Z GIT_COMMITTER_DATE=2026-01-03T12:00:00Z git commit -m "add export path (#42)"
) &&
go mod tidy &&
go test ./... &&
go run . contrib export --start-date 2026-01-01 --end-date 2026-01-31 --repo-dir "$tmp_repo" --branch main --output /tmp/contrib.csv &&
head -n 5 /tmp/contrib.csv
```

The exported CSV should contain two data rows, the second row should carry `pr_number=42`, and no token should be required anywhere in the command path.
