---
date: 2026-04-18T16:56:59-07:00
researcher: creative-mode-agent
git_commit: 4badb67efa0f18a5b52fc2851a5a8cda213fcc9a
branch: main
repository: dotfiles
topic: "Contrib export v2 local-only mode"
tags: [implementation, strategy, contrib-export, local-git]
status: in_progress
last_updated: 2026-04-18
last_updated_by: creative-mode-agent
type: implementation_strategy
---

# Handoff: ENG-general contrib export v2 local-only design

## Task(s)
- Finalize design for a GitHub API-free `c contrib export` behavior.
- Preserve existing CSV shape but source fields from local git history.
- User requirements:
  - PR number is derived from commit message when present.
  - `pr_title` is commit message.
  - `pr_url` is built from PR number.
  - Author = commit author name/email.
  - Ignore review counts, approvals, labels, merged-by, branch names.
  - Timestamp = commit timestamp.
  - Prefer all commits on target branch; avoid token dependency.

## Critical References
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/csv.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service_test.go`

## Recent changes
- Local current implementation still includes GitHub API path in `service.go` and `githubapi` package.
- Direct-push support already added in commit `4badb67`; `pr_number` writes blank when zero in CSV output (`pkg/contrib/export/csv.go`).

## Learnings
- API-independent mode needs only local git data to satisfy requested fields.
- GitHub-derived columns should be explicitly zeroed/emptied:
  - `labels`, `author_association`, `merged_by`, `review_count`, `comment_count`, `base_branch`, `head_branch`, `is_draft`.
- Current row sort uses `PRNumber` as tiebreaker; for mixed local/direct-push rows with blank PR number this may keep zeros grouped before numeric values.

## Artifacts
- `/home/ruby/dotfiles/thoughts/corey/plans/2026-04-17_12-10-00_contrib-analyzer-outline/plan.md`
- `/home/ruby/dotfiles/thoughts/corey/plans/2026-04-17_12-10-00_contrib-analyzer-outline/handoffs/2026-04-18_16-56-59_local-contrib-export-v2.md` (this handoff)
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service.go`
- `/home/ruby/dotfiles/cctl/pkg/contrib/export/service_test.go`
- `/home/ruby/dotfiles/cctl/README.md`

## Action Items & Next Steps
1. Create a local-git provider (e.g., `pkg/contrib/localgit`) and replace `pkg/contrib/githubapi` dependency for v2 path.
2. Parse PR number from commit message with robust regex patterns for merge commits (`Merge pull request #123` and trailing `#123`).
3. Set commit timestamp from `CommittedAt` in local commit metadata.
4. Keep existing CSV contract; map unavailable API fields to empty/zero.
5. Add/adjust tests for:
   - PR number parse
   - local line/file stats
   - output row formatting with blank PR fields
6. Update CLI flags in `cmd/contrib_export.go`:
   - add `--repo-dir` (default `.`) and `--branch` (default `main`)
   - remove required GitHub token
   - deprecate `--include-direct-push` (or no-op)

## Other Notes
- A local-only exporter can derive extension metrics from `git show --numstat` or go-git parser.
- URL construction needs remote mapping from local git remotes (`origin`) to GitHub HTTPS URL format.
- Current repo path for the canonical plan/handoff is now under this plan directory per request.
