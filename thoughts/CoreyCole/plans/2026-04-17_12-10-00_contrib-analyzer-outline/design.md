---
date: 2026-04-19T00:00:00-07:00
researcher: pi
last_updated_by: pi
git_commit: 4badb67efa0f18a5b52fc2851a5a8cda213fcc9a
branch: main
repository: cctl
stage: design
topic: "Contrib export v2 local-only mode"
plan_dir: "thoughts/CoreyCole/plans/2026-04-17_12-10-00_contrib-analyzer-outline"
---

# Design: `c contrib export` local-only v2

## Goal

Replace the GitHub API-driven export path with a local-git implementation that produces the same CSV schema without requiring a GitHub token.

The new behavior is simple:
- read commits from a local repository checkout
- walk the target branch in a date range
- emit one CSV row per commit on that branch
- derive PR metadata from the commit message when available
- leave GitHub-only fields empty or zero

This matches the current user requirements better than the existing PR-centric exporter.

## User requirements carried forward

From the handoff:
- PR number is derived from the commit message when present
- `pr_title` is the commit message
- `pr_url` is built from the PR number
- author comes from commit author name/email
- ignore review counts, approvals, labels, merged-by, branch names
- timestamp comes from the commit timestamp
- prefer all commits on the target branch
- no token dependency

## Current state

The current implementation is still built around GitHub APIs:
- `cmd/contrib_export.go` requires `--owner`, `--repo`, and a GitHub token
- `pkg/contrib/export/service.go` lists commits through `githubapi.Client`
- PR rows are assembled from GitHub PR metadata
- direct pushes are an optional secondary path, not the main model
- rows are deduped by PR number

That shape no longer fits the requested behavior. Local-only export should treat the branch commit history as the source of truth.

## Why the current model is wrong for v2

The v1 design assumes the business object is a merged PR. The v2 request says the business object is a commit on a local branch.

That changes several core assumptions:
- **selection**: no remote repo traversal; just local branch history
- **identity**: no PR lookup; a commit may or may not encode a PR number
- **row cardinality**: one row per commit, not one row per unique PR
- **authorship**: commit author, not GitHub user profile
- **timestamps**: commit timestamp, not PR created/merged timestamps
- **unavailable data**: many GitHub-only columns should be explicitly blank/zero

Trying to preserve the old PR-oriented service and bolt local data onto it would leave unnecessary complexity everywhere.

## Recommended approach

Introduce a dedicated local git provider and make the export service provider-agnostic at the row-input level.

### High-level shape

1. `cmd/contrib_export.go` validates local export inputs
2. `pkg/contrib/localgit` reads branch commits from a local repo
3. `pkg/contrib/export` converts local commit data into existing CSV rows
4. `pkg/contrib/export/csv.go` stays mostly unchanged because the schema stays the same

## Data model for local export

Add a local-only commit model that already contains everything needed to build a row.

```go
type CommitRecord struct {
    SHA           string
    CommitURL     string
    Message       string
    AuthorName    string
    AuthorEmail   string
    CommittedAt   time.Time
    Additions     int
    Deletions     int
    ChangedFiles  int
    Files         []export.FileStat
    PRNumber      int
    RepositoryURL string
}
```

Notes:
- `CommitURL` should be derived from the local `origin` remote when possible
- `Message` should keep the full first-line commit subject for `pr_title`
- `PRNumber` is parsed from the commit message; `0` means “no PR number found”
- `Files` should contain per-file add/remove/change counts so the existing extension aggregation still works

## Local git provider

Create `pkg/contrib/localgit` as the only data source for v2.

Responsibilities:
- open the repo at `--repo-dir`
- resolve the target branch from `--branch`
- enumerate commits reachable from that branch in the requested date range
- extract commit author, timestamp, message, and changed files
- compute additions/deletions/file counts per commit
- parse the repository remote into a canonical GitHub web base when possible

### Implementation choice

Use the `git` CLI, not the GitHub API.

Why:
- the tool already depends on a local checkout for this mode
- `git log` and `git show --numstat` give exactly the commit/file data needed
- no need to introduce go-git complexity unless there is a specific portability problem
- CLI output is easy to verify manually while developing

Suggested commands:
- commit listing:
  - `git -C <repo> log <branch> --since=<iso> --until=<iso> --format=...`
- per-commit file stats:
  - `git -C <repo> show --numstat --format=... <sha>`
- remote URL:
  - `git -C <repo> remote get-url origin`

If the implementation later wants a pure-Go path, that can be a future refactor. It is not necessary for this change.

## CLI changes

Replace the remote-oriented flags with a single local-only configuration.

### Exposed flags
Required:
- `--start-date`
- `--end-date`

Optional:
- `--repo-dir` default `.`
- `--branch` default `main`
- `--output` default `contributions.csv`

That makes the normal command shape:

```bash
c contrib export --start-date 2026-01-01 --end-date 2026-01-31
```

### Removed behavior
Delete these flags and concepts entirely:
- `--owner`
- `--repo`
- `--github-token`
- `--github-username`
- `--include-bots`
- `--include-direct-push`

There should be one mode only: export commits from a local branch in a date range.

### Config shape
The config should shrink to the actual inputs for local export:

```go
type ExportConfig struct {
    RepoDir   string
    Branch    string
    StartDate string
    EndDate   string
    Output    string
}
```

Defaults:
- `RepoDir = "."`
- `Branch = "main"`
- `Output = "contributions.csv"`

This is simpler than carrying forward GitHub-era filtering and auth fields that no longer belong to the feature.

## Mapping local commit data into existing CSV columns

### Columns populated from local data
- `repo`: derive from remote if available, otherwise use a stable fallback like repo directory name
- `merged_at`: commit timestamp
- `pr_created_at`: commit timestamp
- `cycle_time_hours`: `0`
- `commit_sha`: commit SHA
- `commit_url`: constructed from remote + SHA when possible
- `github_username`: normalized author email when available, otherwise normalized author name
- `github_name`: author name
- `pr_number`: parsed from commit message; blank in CSV when absent
- `pr_title`: commit message subject
- `pr_url`: constructed from remote + `/pull/<number>` when PR number exists
- `lines_added`: commit additions
- `lines_removed`: commit deletions
- `files_touched`: number of changed files
- extension columns: derived from per-file stats
- `other_lines_by_extension_json`: same as today

### Columns intentionally blank/zeroed
These are not available in local-only mode and should be explicitly empty:
- `labels` = empty
- `author_association` = empty
- `merged_by` = empty
- `review_count` = `0`
- `comment_count` = `0`
- `base_branch` = empty
- `head_branch` = empty
- `is_draft` = `false`

This should be encoded directly in row construction rather than treated as “best effort”.

## PR number parsing

The parser should be explicit and deterministic.

Support these patterns first:
- `Merge pull request #123 from ...`
- trailing `(#123)`
- trailing `#123`

Examples:
- `Merge pull request #123 from org/feature` -> `123`
- `add export sorting fix (#456)` -> `456`
- `docs: cleanup #789` -> `789`

Rules:
- first valid match wins
- only parse positive integers
- if no match exists, leave `PRNumber` as `0`

Keep this parser isolated in a small helper with table-driven tests.

## Remote URL handling

`pr_url` and `commit_url` need a web base URL.

Read `origin` and normalize common GitHub remote forms:
- `git@github.com:owner/repo.git`
- `https://github.com/owner/repo.git`
- `https://github.com/owner/repo`

Normalize all of them to:
- repo base: `https://github.com/owner/repo`

Then build:
- commit URL: `<base>/commit/<sha>`
- PR URL: `<base>/pull/<number>`

If no GitHub-style remote can be parsed:
- leave `commit_url` and `pr_url` empty
- still export the row

Do not fail the export just because remote normalization fails.

## Sorting and determinism

Continue sorting rows deterministically, but stop using PR number as the only tie-breaker.

Recommended sort:
1. `merged_at`
2. `commit_sha`

Reason:
- local-only mode naturally includes rows with blank PR numbers
- SHA is always present and deterministic
- using PR number as a tiebreaker no longer reflects row identity

## Filtering

Remove filtering from the v2 design.

The local-only exporter should emit all commits on the target branch within the date range. Username filters and bot filters are carryovers from the GitHub-centric design and add complexity without matching the current requirements.

If filtering becomes a real requirement later, it can be added back from a clean local model. It should not be part of the initial local-only rewrite.

## Changes needed in `pkg/contrib/export`

The current `Service` is too tightly coupled to `githubapi.Client`.

The cleanest change is:
- replace the GitHub client dependency with a smaller source abstraction for export input rows, or
- create a separate local export path that reuses `Row`, `WriteCSV`, and extension helpers

Recommendation: **create a separate local row builder first**.

That keeps the change small:
- preserve `Row`
- preserve CSV writing
- preserve extension aggregation helpers
- replace only the collection + row construction path

A simple version:

```go
type LocalCommit struct { ... }

func ExportLocalCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error
```

If that lands cleanly, the older GitHub service can be removed afterward.

## Test plan

Add focused tests around the new local behavior.

### Parser tests
- merge commit message parses PR number
- squash message with `(#123)` parses PR number
- plain commit with no PR number stays blank

### Remote normalization tests
- SSH GitHub remote -> HTTPS base
- HTTPS remote with `.git` -> HTTPS base without `.git`
- non-GitHub remote -> empty URLs

### Local row building tests
- commit timestamp populates both `merged_at` and `pr_created_at`
- commit subject becomes `pr_title`
- missing PR number produces blank CSV `pr_number`
- GitHub-only fields are blank/zero
- extension stats map into the existing known columns and JSON catch-all

### End-to-end tests
- fixture repo with a few commits on `main`
- export within date range
- verify row count and representative CSV fields

## Migration strategy

Keep the migration direct.

1. Add local-git provider and tests
2. Replace the existing export config with the smaller local-only config
3. Rewire `c contrib export` to local mode
4. delete token enforcement, owner/repo handling, and all filter/direct-push flags
5. update row sorting for commit identity
6. update README examples to the minimal local command shape

Do not build a two-engine abstraction unless the code clearly needs both engines at the same time.

## Recommendation

Implement `c contrib export` v2 as a **local branch commit exporter**, not as a PR exporter with a local fallback.

That means:
- branch commits are the source of truth
- every commit in range can emit a row
- PR metadata is derived from commit messages only
- GitHub-only columns are intentionally empty or zero
- URLs come from the local `origin` remote when it maps cleanly to GitHub
- no token, no GitHub API calls, no PR dedupe

This is the smallest design that actually matches the requested behavior.

## Next work after this design

The next artifact should be a revised outline that breaks implementation into vertical slices:
1. CLI/config rewrite for local mode
2. local git data collection
3. row builder + CSV mapping
4. tests + README cleanup
