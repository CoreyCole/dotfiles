---
date: 2026-04-19T00:00:00-07:00
researcher: pi
last_updated_by: pi
git_commit: 4badb67efa0f18a5b52fc2851a5a8cda213fcc9a
branch: main
repository: cctl
stage: outline
ticket: "Contrib export v2 local-only mode"
plan_dir: "thoughts/CoreyCole/plans/2026-04-17_12-10-00_contrib-analyzer-outline"
---

# Outline: `c contrib export` local-only v2

## Overview
Rewrite `c contrib export` so it reads commits from a local repo and branch over a date range, then writes the existing CSV schema without any GitHub API dependency. The implementation removes the current PR-centric and token-centric flow, replaces it with a local git collector, and preserves only the CSV/output pieces that still fit the new commit-based model.

## Type Definitions

```go
// pkg/contrib/config/config.go
package config

type ExportConfig struct {
    RepoDir   string
    Branch    string
    StartDate string
    EndDate   string
    Output    string
}

func (c *ExportConfig) Validate() error
func (c *ExportConfig) StartTime() time.Time
func (c *ExportConfig) EndTimeInclusive() time.Time
```

```go
// pkg/contrib/localgit/types.go
package localgit

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

func New() *Client
func (c *Client) ListBranchCommits(ctx context.Context, cfg config.ExportConfig) ([]CommitRecord, error)
```

```go
// pkg/contrib/localgit/parse.go
package localgit

func ParsePRNumber(message string) int
func NormalizeGitHubRemote(raw string) string
func CommitURL(repoBaseURL, sha string) string
func PRURL(repoBaseURL string, prNumber int) string
```

```go
// pkg/contrib/export/service.go
package export

func ExportLocalCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error
func BuildLocalRow(commit localgit.CommitRecord) Row
```

## Package / File Structure

- `cmd/contrib_export.go` — replace CLI wiring with local-only flags
- `pkg/contrib/config/config.go` — shrink config to local-only inputs
- `pkg/contrib/config/config_test.go` — validation/default tests
- `pkg/contrib/localgit/client.go` — run `git` commands and assemble commit records
- `pkg/contrib/localgit/parse.go` — PR number parsing and remote normalization helpers
- `pkg/contrib/localgit/client_test.go` — parser and normalization tests
- `pkg/contrib/export/service.go` — replace GitHub client flow with local commit export
- `pkg/contrib/export/service_test.go` — local row/export tests
- `pkg/contrib/export/csv.go` — keep as-is unless row assumptions need a small adjustment
- `README.md` — update usage and examples
- optional cleanup after the local path is working:
  - `pkg/contrib/githubapi/`
  - GitHub-specific contrib-export tests no longer referenced by the command

## API Surface

```go
// cmd/contrib_export.go flags
--start-date string   // required
--end-date string     // required
--repo-dir string     // default "."
--branch string       // default "main"
--output string       // default "contributions.csv"
```

```go
func runContribExport(cmd *cobra.Command, args []string) error
```

## Slices

### Slice 1: CLI and config rewrite

**Files:**
- `cmd/contrib_export.go` (modify)
- `pkg/contrib/config/config.go` (modify)
- `pkg/contrib/config/config_test.go` (modify)

```go
type ExportConfig struct {
    RepoDir   string
    Branch    string
    StartDate string
    EndDate   string
    Output    string
}
```

```go
func (c *ExportConfig) Validate() error
```

Scope:
- remove owner/repo/token/filter/direct-push flags
- add defaults for `repo-dir`, `branch`, and `output`
- keep only the date range required
- remove token and rate-limit handling from the command path

**Test checkpoint:** `go test ./pkg/contrib/config -v` and run `c contrib export --help` to confirm only the five local-mode flags remain.

### Slice 2: Local git collection primitives

**Files:**
- `pkg/contrib/localgit/client.go` (new)
- `pkg/contrib/localgit/parse.go` (new)
- `pkg/contrib/localgit/client_test.go` (new)

```go
type Client struct{}

func New() *Client
func (c *Client) ListBranchCommits(ctx context.Context, cfg config.ExportConfig) ([]CommitRecord, error)
```

```go
func ParsePRNumber(message string) int
func NormalizeGitHubRemote(raw string) string
func CommitURL(repoBaseURL, sha string) string
func PRURL(repoBaseURL string, prNumber int) string
```

Scope:
- collect commits from `git log`
- collect per-commit file stats from `git show --numstat`
- derive repo web URL from `origin`
- parse PR number from the commit message subject
- return a complete local commit record per branch commit

**Test checkpoint:** `go test ./pkg/contrib/localgit -v` covering PR-number parsing, GitHub remote normalization, non-GitHub remote behavior, and commit-record assembly from fixture command output or a fixture repo.

### Slice 3: Local row builder and exporter

**Files:**
- `pkg/contrib/export/service.go` (modify or rewrite)
- `pkg/contrib/export/service_test.go` (modify)
- `pkg/contrib/export/extensions.go` (reuse)
- `pkg/contrib/export/csv.go` (small or no change)

```go
func ExportLocalCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error
func BuildLocalRow(commit localgit.CommitRecord) Row
```

Scope:
- remove `githubapi.Client` dependency from the export path
- build one CSV row per commit
- map local commit data into the existing CSV columns
- blank or zero GitHub-only columns explicitly
- sort by `MergedAt`, then `CommitSHA`

**Test checkpoint:** `go test ./pkg/contrib/export -run 'TestExportLocal|TestBuildLocalRow|TestRecord' -v` and verify one commit yields one row, blank PR number when no PR match exists, commit subject becomes `pr_title`, GitHub-only columns are empty/zero, and extension columns still aggregate correctly.

### Slice 4: Command integration and docs cleanup

**Files:**
- `cmd/contrib_export.go` (modify)
- `README.md` (modify)
- optional cleanup of dead GitHub contrib code/tests after the local path is wired

```go
func countCSVRows(path string) (int, error)
```

Scope:
- wire the command to `export.ExportLocalCSV`
- print a local-mode summary line with branch, date range, row count, and output path
- update README examples to the minimal local command shape
- remove GitHub token usage text and PR-only wording

**Test checkpoint:**
```bash
go test ./...
c contrib export --start-date 2026-01-01 --end-date 2026-01-31 --repo-dir . --branch main --output /tmp/contrib.csv
head -n 5 /tmp/contrib.csv
```

Confirm the CSV is produced without `GITHUB_TOKEN` and representative rows match local commit history.

## Out of Scope

- preserving GitHub API export as a second mode
- bot or username filtering
- approval, review, or label enrichment
- non-GitHub remote URL enrichment beyond leaving URLs blank
- introducing a large abstraction layer for multiple export backends
