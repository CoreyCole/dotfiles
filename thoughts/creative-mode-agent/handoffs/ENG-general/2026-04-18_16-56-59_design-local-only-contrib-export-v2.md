---
date: 2026-04-18T16:56:59-07:00
researcher: creative-mode-agent
git_commit: 4badb67efa0f18a5b52fc2851a5a8cda213fcc9a
branch: main
repository: dotfiles
topic: "Contrib export v2 local-only implementation"
tags: [implementation, contrib-export, local-git, csv]
status: complete
last_updated: 2026-04-18
last_updated_by: creative-mode-agent
type: implementation_strategy
---

# Handoff: ENG-general design local-only v2 for `c contrib export`

## Task(s)
- Completed: verified current implementation (`4badb67`) currently depends on GitHub REST API for `c contrib export` and requires a token.
- Completed: confirmed local CSV output behavior for direct-push rows with empty PR fields in current code path.
- Work in progress / proposed: design `contrib export` v2 that does not call GitHub API and derives rows from local git history.
- Planned: implement a local-only data path and optionally remove/retain legacy API path behind a mode flag.

## Critical References
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client.go`
- `/home/ruby/dotfiles/cctl/cmd/contrib_export.go`

## Recent changes
- `4badb67` added direct-push commit emission with empty PR fields when `--include-direct-push` is set.
  - CSV row writer now renders blank `pr_number` when `row.PRNumber == 0` (`pkg/contrib/export/csv.go`).
  - Export service now fetches commit-level data for commit rows that are not attached to merged PRs and appends them as rows.
  - Added local commit details model + API method (`CommitDetails`, `GetCommitDetails`) in `pkg/contrib/githubapi/client.go` + tests.

## Learnings
- Current schema already supports blank PR rows if `pr_number` is zero, but many other PR fields in the row are populated only from GitHub API data.
- Existing extraction pipeline intentionally skips direct-push rows unless `--include-direct-push`; user wants all main-branch commits, so v2 should effectively make this the default/only behavior.
- We can satisfy user’s requested data source mapping from local git metadata:
  - PR number can be parsed from commit message (e.g., `Merge pull request #NNN` / trailing `(#NNN)` pattern).
  - Title can be commit subject/body.
  - PR URL can be derived as `<remote>/pull/<n>` when PR number exists.
  - Author username/email can come from commit author name/email.
  - PR review/labels/merge flags can be hard-coded empty/false.
  - Timestamp should be commit commit date.
- This enables dropping GitHub auth entirely for core output fields.

## Artifacts
- `/home/ruby/dotfiles/thoughts/corey/plans/2026-04-17_12-10-00_contrib-analyzer-outline/plan.md` (current milestone context)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/csv.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service_test.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/githubapi/client_test.go`
- `/home/ruby/dotfiles/cctl/cmd/contrib_export.go`
- `/home/ruby/dotfiles/cctl/README.md`

## Action Items & Next Steps
1. Implement `pkg/contrib/localgit` (or similar) data source that reads commits directly from the local git repository.
2. Replace `pkg/contrib/githubapi.Client` usage in `export.Service` with a local commit source interface for v2 path (or implement provider abstraction with only local mode).
3. Keep schema-compatible row shape:
   - `pr_number`: parsed int from commit message, or `0` (blank in CSV).
   - `pr_title`: use commit message.
   - `pr_url`: `<remote>/pull/<pr_number>` when parsed.
   - PR metadata fields (`labels`, `author_association`, `merged_by`, review/comment counts, branch refs, draft flag) should be empty/zero.
4. Parse commit file stats and extensions from local `git show --numstat` output to populate line metrics and extension columns.
5. Update flags:
   - remove GitHub token requirement for v2 default flow.
   - remove/ignore `include-direct-push` because every commit on the target branch is included.
   - add `--repo-dir` and default branch selector (likely `--branch main`).
6. Update README and tests:
   - document v2 local extraction behavior and assumptions.
   - add tests for PR-number parsing from commit message and local-stats mapping.

## Other Notes
- PR number parsing should support common patterns in local history:
  - `Merge pull request #123: ...`
  - trailing `(#123)` in commit subject
  - fallback to no PR number if no pattern is found.
- For local URL derivation, parse Git remote (`origin`) URLs of both HTTPS and SSH GitHub forms.
- `--start-date` / `--end-date` are date-only inputs; preserve inclusive end-date behavior by converting to a UTC range and filtering after parsing commit timestamps.
