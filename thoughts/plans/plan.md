---
date: 2026-04-17T20:41:04-07:00
researcher: corey
last_updated_by: corey
git_commit: a603152
branch: main
repository: cctl
stage: plan
ticket: "GitHub repository contributor CSV CLI"
plan_dir: "thoughts/corey/plans/2026-04-17_12-10-00_contrib-analyzer-outline"
---

# Implementation Plan: GitHub Contributor Analyzer CSV CLI

## Status
- [ ] Slice 1: Cobra wiring + validated config
- [ ] Slice 2: GitHub collection path
- [ ] Slice 3: Export service (filter + dedupe + row assembly)
- [ ] Slice 4: Extension aggregation
- [ ] Slice 5: Deterministic CSV writer
- [ ] Slice 6: End-to-end command usability

## Slice 1: Cobra wiring + validated config

### Files
- `cmd/contrib.go` (new)
- `cmd/contrib_export.go` (new)
- `pkg/contrib/config/config.go` (new)
- `pkg/contrib/config/config_test.go` (new)

### Changes

**`cmd/contrib.go`** (new):
```go
package cmd

import "github.com/spf13/cobra"

var contribCmd = &cobra.Command{
	Use:   "contrib",
	Short: "Contributor analysis tools",
}

func init() {
	rootCmd.AddCommand(contribCmd)
}
```

**`cmd/contrib_export.go`** (new):
```go
package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/export"
	"github.com/coreycole/cctl/pkg/contrib/githubapi"
	"github.com/spf13/cobra"
)

var exportCfg config.ExportConfig

var contribExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export contributor CSV from merged PRs",
	RunE:  runContribExport,
}

func init() {
	contribExportCmd.Flags().StringVar(&exportCfg.Owner, "owner", "", "GitHub owner/org")
	contribExportCmd.Flags().StringVar(&exportCfg.Repo, "repo", "", "GitHub repository")
	contribExportCmd.Flags().StringVar(&exportCfg.StartDate, "start-date", "", "Start date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.EndDate, "end-date", "", "End date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.Output, "output", "contributions.csv", "Output CSV path")
	contribExportCmd.Flags().StringVar(&exportCfg.GitHubToken, "github-token", "", "GitHub token (defaults to GITHUB_TOKEN)")
	contribExportCmd.Flags().StringSliceVar(&exportCfg.GitHubUsernames, "github-username", nil, "Allowed GitHub username(s), repeat or comma-separated")
	contribExportCmd.Flags().BoolVar(&exportCfg.IncludeBots, "include-bots", false, "Include bot users")
	contribExportCmd.Flags().BoolVar(&exportCfg.IncludeDirectPush, "include-direct-push", false, "Include commits not associated with merged PRs")

	_ = contribExportCmd.MarkFlagRequired("owner")
	_ = contribExportCmd.MarkFlagRequired("repo")
	_ = contribExportCmd.MarkFlagRequired("start-date")
	_ = contribExportCmd.MarkFlagRequired("end-date")

	contribCmd.AddCommand(contribExportCmd)
}

func runContribExport(cmd *cobra.Command, args []string) error {
	if exportCfg.GitHubToken == "" {
		exportCfg.GitHubToken = os.Getenv("GITHUB_TOKEN")
	}
	exportCfg.KnownExtensions = []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"}

	if err := exportCfg.Validate(); err != nil {
		return err
	}

	gh, err := githubapi.NewClient(exportCfg.GitHubToken)
	if err != nil {
		return err
	}

	f, err := os.Create(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer f.Close()

	svc := export.NewService(gh)
	if err := svc.ExportCSV(context.Background(), exportCfg, f); err != nil {
		return err
	}

	fmt.Fprintf(cmd.OutOrStdout(), "wrote %s\n", exportCfg.Output)
	return nil
}
```

**`pkg/contrib/config/config.go`** (new):
```go
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
```

**`pkg/contrib/config/config_test.go`** (new):
```go
package config

import "testing"

func TestNormalizeUsernames(t *testing.T) {
	in := []string{"Alice", "bob,bob", " alice "}
	got := normalizeUsernames(in)
	if len(got) != 2 || got[0] != "alice" || got[1] != "bob" {
		t.Fatalf("unexpected usernames: %#v", got)
	}
}

func TestValidateDateRange(t *testing.T) {
	cfg := ExportConfig{Owner: "o", Repo: "r", StartDate: "2026-04-10", EndDate: "2026-04-01"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected range error")
	}
}
```

### Tests
- `pkg/contrib/config/config_test.go`

### Verify
```bash
go test ./pkg/contrib/config -v
c contrib export --owner x --repo y --start-date 2026-01-01 --end-date 2026-01-31 --github-username Alice --github-username bob,bob --output /tmp/out.csv
```

---

## Slice 2: GitHub collection path

### Files
- `pkg/contrib/githubapi/client.go` (new)
- `pkg/contrib/githubapi/client_test.go` (new)
- `go.mod` (modify dependencies)

### Changes

**`go.mod`** (modify): add dependencies.
```go
require (
	github.com/google/go-github/v69 v69.2.0
	golang.org/x/oauth2 v0.30.0
)
```

**`pkg/contrib/githubapi/client.go`** (new):
```go
package githubapi

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/go-github/v69/github"
	"golang.org/x/oauth2"
)

type BranchCommit struct {
	SHA         string
	CommittedAt time.Time
	URL         string
}

type PRSummary struct {
	Number            int
	Title             string
	URL               string
	Username          string
	DisplayName       string
	AuthorAssociation string
	MergedAt          time.Time
	CreatedAt         time.Time
	MergedBy          string
	BaseRef           string
	HeadRef           string
	MergeCommitSHA    string
	IsDraft           bool
	Labels            []string
	CommentCount      int
	ReviewCount       int
	CommitsCount      int
	Additions         int
	Deletions         int
	ChangedFiles      int
}

type PRFile struct {
	Filename  string
	Status    string
	Additions int
	Deletions int
	Changes   int
}

type ExtensionStat struct {
	Added        int `json:"added"`
	Removed      int `json:"removed"`
	Changed      int `json:"changed"`
	FilesTouched int `json:"files_touched"`
}

type Client interface {
	ListDefaultBranchCommits(ctx context.Context, owner, repo string, since, until time.Time) ([]BranchCommit, error)
	GetAssociatedMergedPR(ctx context.Context, owner, repo, sha string) (*github.PullRequest, error)
	GetPRSummary(ctx context.Context, owner, repo string, number int) (*PRSummary, error)
	ListPRFiles(ctx context.Context, owner, repo string, number int) ([]PRFile, error)
}

type ClientImpl struct {
	gh *github.Client
}

func NewClient(token string) (*ClientImpl, error) {
	if token == "" {
		return nil, fmt.Errorf("missing GitHub token (--github-token or GITHUB_TOKEN)")
	}
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	hc := oauth2.NewClient(context.Background(), ts)
	return &ClientImpl{gh: github.NewClient(hc)}, nil
}

func (c *ClientImpl) ListDefaultBranchCommits(ctx context.Context, owner, repo string, since, until time.Time) ([]BranchCommit, error) {
	repoInfo, _, err := c.gh.Repositories.Get(ctx, owner, repo)
	if err != nil {
		return nil, fmt.Errorf("get repo: %w", err)
	}
	branch := repoInfo.GetDefaultBranch()
	if branch == "" {
		return nil, fmt.Errorf("default branch not found")
	}

	opt := &github.CommitsListOptions{
		SHA:   branch,
		Since: since,
		Until: until,
		ListOptions: github.ListOptions{PerPage: 100, Page: 1},
	}
	out := []BranchCommit{}
	for {
		commits, resp, err := c.gh.Repositories.ListCommits(ctx, owner, repo, opt)
		if err != nil {
			return nil, fmt.Errorf("list commits: %w", err)
		}
		for _, cm := range commits {
			out = append(out, BranchCommit{SHA: cm.GetSHA(), CommittedAt: cm.Commit.GetCommitter().GetDate().UTC(), URL: cm.GetHTMLURL()})
		}
		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}
	return out, nil
}

func (c *ClientImpl) GetAssociatedMergedPR(ctx context.Context, owner, repo, sha string) (*github.PullRequest, error) {
	prs, _, err := c.gh.Repositories.ListPullRequestsWithCommit(ctx, owner, repo, sha, &github.ListOptions{PerPage: 50})
	if err != nil {
		return nil, fmt.Errorf("list pull requests with commit: %w", err)
	}
	for _, pr := range prs {
		if pr.GetMergedAt().IsZero() {
			continue
		}
		full, _, err := c.gh.PullRequests.Get(ctx, owner, repo, pr.GetNumber())
		if err != nil {
			return nil, fmt.Errorf("get pull request %d: %w", pr.GetNumber(), err)
		}
		if !full.GetMergedAt().IsZero() {
			return full, nil
		}
	}
	return nil, nil
}

func (c *ClientImpl) GetPRSummary(ctx context.Context, owner, repo string, number int) (*PRSummary, error) {
	pr, _, err := c.gh.PullRequests.Get(ctx, owner, repo, number)
	if err != nil {
		return nil, err
	}
	reviews, _, _ := c.gh.PullRequests.ListReviews(ctx, owner, repo, number, &github.ListOptions{PerPage: 100})
	labels := make([]string, 0, len(pr.Labels))
	for _, l := range pr.Labels {
		labels = append(labels, l.GetName())
	}
	return &PRSummary{
		Number:            pr.GetNumber(),
		Title:             pr.GetTitle(),
		URL:               pr.GetHTMLURL(),
		Username:          pr.User.GetLogin(),
		DisplayName:       pr.User.GetName(),
		AuthorAssociation: pr.GetAuthorAssociation(),
		MergedAt:          pr.GetMergedAt().UTC(),
		CreatedAt:         pr.GetCreatedAt().UTC(),
		MergedBy:          pr.MergedBy.GetLogin(),
		BaseRef:           pr.Base.GetRef(),
		HeadRef:           pr.Head.GetRef(),
		MergeCommitSHA:    pr.GetMergeCommitSHA(),
		IsDraft:           pr.GetDraft(),
		Labels:            labels,
		CommentCount:      pr.GetComments(),
		ReviewCount:       len(reviews),
		CommitsCount:      pr.GetCommits(),
		Additions:         pr.GetAdditions(),
		Deletions:         pr.GetDeletions(),
		ChangedFiles:      pr.GetChangedFiles(),
	}, nil
}

func (c *ClientImpl) ListPRFiles(ctx context.Context, owner, repo string, number int) ([]PRFile, error) {
	opt := &github.ListOptions{PerPage: 100, Page: 1}
	out := []PRFile{}
	for {
		files, resp, err := c.gh.PullRequests.ListFiles(ctx, owner, repo, number, opt)
		if err != nil {
			return nil, err
		}
		for _, f := range files {
			out = append(out, PRFile{
				Filename:  f.GetFilename(),
				Status:    f.GetStatus(),
				Additions: f.GetAdditions(),
				Deletions: f.GetDeletions(),
				Changes:   f.GetChanges(),
			})
		}
		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}
	return out, nil
}

var _ Client = (*ClientImpl)(nil)
```

**`pkg/contrib/githubapi/client_test.go`** (new):
- Use `httptest.Server` + `github.NewClient(serverClient)` for pagination fixtures.
- Tests:
  - commit list pagination returns all commits
  - file list pagination returns all files
  - `GetAssociatedMergedPR` returns merged PR or nil for direct push

### Tests
- `pkg/contrib/githubapi/client_test.go`

### Verify
```bash
go mod tidy
go test ./pkg/contrib/githubapi -v
```

---

## Slice 3: Export service (filter + dedupe + row assembly)

### Files
- `pkg/contrib/export/service.go` (new)
- `pkg/contrib/export/filter.go` (new)
- `pkg/contrib/export/service_test.go` (new)

### Changes

**`pkg/contrib/export/filter.go`** (new):
```go
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
```

**`pkg/contrib/export/service.go`** (new):
```go
package export

import (
	"context"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/githubapi"
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

type Service struct {
	gh githubapi.Client
}

func NewService(gh githubapi.Client) *Service { return &Service{gh: gh} }

func (s *Service) ExportCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error {
	commits, err := s.gh.ListDefaultBranchCommits(ctx, cfg.Owner, cfg.Repo, cfg.StartTime(), cfg.EndTimeInclusive())
	if err != nil {
		return err
	}

	whitelist := map[string]struct{}{}
	for _, u := range cfg.GitHubUsernames {
		whitelist[strings.ToLower(u)] = struct{}{}
	}

	seenPR := map[int]struct{}{}
	rows := make([]Row, 0, len(commits))
	for _, c := range commits {
		pr, err := s.gh.GetAssociatedMergedPR(ctx, cfg.Owner, cfg.Repo, c.SHA)
		if err != nil {
			return err
		}
		if pr == nil {
			if cfg.IncludeDirectPush {
				continue // v1: no direct-push row model; skip
			}
			continue
		}
		if _, ok := seenPR[pr.GetNumber()]; ok {
			continue
		}

		summary, err := s.gh.GetPRSummary(ctx, cfg.Owner, cfg.Repo, pr.GetNumber())
		if err != nil {
			return err
		}
		if shouldSkipBot(summary.Username, cfg.IncludeBots) {
			continue
		}
		if !allowedUser(summary.Username, whitelist) {
			continue
		}

		files, err := s.gh.ListPRFiles(ctx, cfg.Owner, cfg.Repo, summary.Number)
		if err != nil {
			return err
		}
		ext := AccumulateByExtension(files)
		row := BuildRow(cfg.Owner+"/"+cfg.Repo, c, summary, ext)
		rows = append(rows, row)
		seenPR[summary.Number] = struct{}{}
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].MergedAt.Equal(rows[j].MergedAt) {
			return rows[i].PRNumber < rows[j].PRNumber
		}
		return rows[i].MergedAt.Before(rows[j].MergedAt)
	})
	return WriteCSV(w, rows)
}

func BuildRow(repo string, commit githubapi.BranchCommit, pr *githubapi.PRSummary, ext map[string]githubapi.ExtensionStat) Row {
	labels := append([]string(nil), pr.Labels...)
	sort.Strings(labels)
	row := Row{
		Repo:              repo,
		MergedAt:          pr.MergedAt.UTC(),
		PRCreatedAt:       pr.CreatedAt.UTC(),
		CycleTimeHours:    pr.MergedAt.Sub(pr.CreatedAt).Hours(),
		CommitSHA:         commit.SHA,
		CommitURL:         commit.URL,
		GitHubUsername:    strings.ToLower(pr.Username),
		GitHubName:        pr.DisplayName,
		PRNumber:          pr.Number,
		PRTitle:           pr.Title,
		PRURL:             pr.URL,
		LinesAdded:        pr.Additions,
		LinesRemoved:      pr.Deletions,
		FilesTouched:      pr.ChangedFiles,
		Labels:            labels,
		AuthorAssociation: pr.AuthorAssociation,
		MergedBy:          pr.MergedBy,
		ReviewCount:       pr.ReviewCount,
		CommentCount:      pr.CommentCount,
		BaseBranch:        pr.BaseRef,
		HeadBranch:        pr.HeadRef,
		IsDraft:           pr.IsDraft,
	}
	ApplyKnownExtensionColumns(&row, ext)
	other, _ := EncodeOtherExtensionStats(ext, []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"})
	row.OtherLinesByExtensionJSON = other
	return row
}
```

**`pkg/contrib/export/service_test.go`** (new):
- Stub `githubapi.Client` with in-memory responses.
- Tests:
  - duplicate PRs from multiple commits emit one row
  - whitelist filter case-insensitive
  - default bot filter excludes `dependabot[bot]`

### Tests
- `pkg/contrib/export/service_test.go`

### Verify
```bash
go test ./pkg/contrib/export -run 'TestExport|TestAllowed|TestBot' -v
```

---

## Slice 4: Extension aggregation

### Files
- `pkg/contrib/export/extensions.go` (new)
- `pkg/contrib/export/extensions_test.go` (new)

### Changes

**`pkg/contrib/export/extensions.go`** (new):
```go
package export

import (
	"encoding/json"
	"path/filepath"
	"sort"
	"strings"

	"github.com/coreycole/cctl/pkg/contrib/githubapi"
)

func AccumulateByExtension(files []githubapi.PRFile) map[string]githubapi.ExtensionStat {
	stats := map[string]githubapi.ExtensionStat{}
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

func ApplyKnownExtensionColumns(row *Row, stats map[string]githubapi.ExtensionStat) {
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

func EncodeOtherExtensionStats(stats map[string]githubapi.ExtensionStat, known []string) (string, error) {
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
	ordered := map[string]githubapi.ExtensionStat{}
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

**`pkg/contrib/export/extensions_test.go`** (new):
- test mixed file list populates `.go/.proto/.sql/.md/.ts/.tsx`
- test uppercase `.MD` normalizes to `.md`
- test no-extension + uncommon extensions are only in JSON catch-all

### Tests
- `pkg/contrib/export/extensions_test.go`

### Verify
```bash
go test ./pkg/contrib/export -run 'TestAccumulate|TestApplyKnown|TestEncodeOther' -v
```

---

## Slice 5: Deterministic CSV writer

### Files
- `pkg/contrib/export/csv.go` (new)
- `pkg/contrib/export/csv_test.go` (new)
- `pkg/contrib/export/testdata/export.golden.csv` (new)

### Changes

**`pkg/contrib/export/csv.go`** (new):
```go
package export

import (
	"encoding/csv"
	"io"
	"strconv"
	"strings"
)

func WriteCSV(w io.Writer, rows []Row) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(Header()); err != nil {
		return err
	}
	for _, row := range rows {
		if err := cw.Write(Record(row)); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func Header() []string {
	return []string{
		"repo", "merged_at", "pr_created_at", "cycle_time_hours", "commit_sha", "commit_url",
		"github_username", "github_name", "pr_number", "pr_title", "pr_url", "lines_added", "lines_removed", "files_touched",
		"labels", "author_association", "merged_by", "review_count", "comment_count", "base_branch", "head_branch", "is_draft",
		"go_lines_added", "go_lines_removed", "go_files_touched",
		"proto_lines_added", "proto_lines_removed", "proto_files_touched",
		"sql_lines_added", "sql_lines_removed", "sql_files_touched",
		"md_lines_added", "md_lines_removed", "md_files_touched",
		"ts_lines_added", "ts_lines_removed", "ts_files_touched",
		"tsx_lines_added", "tsx_lines_removed", "tsx_files_touched",
		"other_lines_by_extension_json",
	}
}

func Record(row Row) []string {
	return []string{
		row.Repo,
		row.MergedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		row.PRCreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		strconv.FormatFloat(row.CycleTimeHours, 'f', 2, 64),
		row.CommitSHA,
		row.CommitURL,
		row.GitHubUsername,
		row.GitHubName,
		strconv.Itoa(row.PRNumber),
		row.PRTitle,
		row.PRURL,
		strconv.Itoa(row.LinesAdded),
		strconv.Itoa(row.LinesRemoved),
		strconv.Itoa(row.FilesTouched),
		strings.Join(row.Labels, ";"),
		row.AuthorAssociation,
		row.MergedBy,
		strconv.Itoa(row.ReviewCount),
		strconv.Itoa(row.CommentCount),
		row.BaseBranch,
		row.HeadBranch,
		strconv.FormatBool(row.IsDraft),
		strconv.Itoa(row.GoLinesAdded), strconv.Itoa(row.GoLinesRemoved), strconv.Itoa(row.GoFilesTouched),
		strconv.Itoa(row.ProtoLinesAdded), strconv.Itoa(row.ProtoLinesRemoved), strconv.Itoa(row.ProtoFilesTouched),
		strconv.Itoa(row.SQLLinesAdded), strconv.Itoa(row.SQLLinesRemoved), strconv.Itoa(row.SQLFilesTouched),
		strconv.Itoa(row.MDLinesAdded), strconv.Itoa(row.MDLinesRemoved), strconv.Itoa(row.MDFilesTouched),
		strconv.Itoa(row.TSLinesAdded), strconv.Itoa(row.TSLinesRemoved), strconv.Itoa(row.TSFilesTouched),
		strconv.Itoa(row.TSXLinesAdded), strconv.Itoa(row.TSXLinesRemoved), strconv.Itoa(row.TSXFilesTouched),
		row.OtherLinesByExtensionJSON,
	}
}
```

**`pkg/contrib/export/csv_test.go`** (new):
- golden test against `testdata/export.golden.csv`
- timestamp format assertions (RFC3339 UTC)
- labels join order deterministic (`;` separator)
- JSON column validates with `json.Valid`

### Tests
- `pkg/contrib/export/csv_test.go`

### Verify
```bash
go test ./pkg/contrib/export -run 'TestWriteCSV|TestHeader|TestRecord' -v
```

---

## Slice 6: End-to-end command usability

### Files
- `cmd/contrib_export.go` (modify wiring polish)
- `README.md` (new)
- `VERSION` (modify, increment by 1 after code changes)

### Changes

**`cmd/contrib_export.go`** (modify):
- Add clearer terminal output: owner/repo/date range, row count, output path.
- Return actionable errors for token missing and API rate limit.

**`README.md`** (new):
- Add `c contrib export` usage section.
- Add example with username whitelist + bots toggle.
- Add note: requires PAT with `repo` read scope for private repos.

**`VERSION`** (modify):
- Increment integer by 1 once implementation is complete.

### Tests
- Add integration smoke in `cmd` package only if practical; otherwise manual e2e validation checklist in README.

### Verify
```bash
go test ./...
GITHUB_TOKEN=... c contrib export --owner <owner> --repo <repo> --start-date 2026-01-01 --end-date 2026-01-31 --output /tmp/contrib.csv
head -n 5 /tmp/contrib.csv
```

Validate one known PR row manually in GitHub UI:
- PR number/title
- username
- additions/deletions
- changed files
- markdown additions/deletions (.md)
