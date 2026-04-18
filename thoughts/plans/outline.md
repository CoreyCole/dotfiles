# Outline: GitHub Contributor Analyzer CSV CLI (cctl integration)

## Overview
Add a new `contrib` command group to `cctl`, with an `export` subcommand that emits one CSV row per merged PR introduced onto the repository default branch in a squash-merge workflow.

Implementation flow:
1. Enumerate default-branch commits in a date range
2. Resolve each commit to its associated merged PR
3. Enrich PR data with summary and per-file diff stats
4. Apply optional username whitelist and bot/direct-push filtering
5. Emit deterministic CSV rows for spreadsheet and SQL analysis

## Command Surface
`c contrib export --owner ... --repo ... --start-date ... --end-date ...`

## Package / File Structure
- `cmd/contrib.go` (new)
- `cmd/contrib_export.go` (new)
- `pkg/contrib/config/config.go` (new)
- `pkg/contrib/githubapi/client.go` (new)
- `pkg/contrib/export/service.go` (new)
- `pkg/contrib/export/filter.go` (new)
- `pkg/contrib/export/extensions.go` (new)
- `pkg/contrib/export/csv.go` (new)

## Slices
1. Cobra wiring + validated config
2. GitHub collection path
3. Export service (filter + dedupe + row assembly)
4. Extension aggregation
5. Deterministic CSV writer
6. End-to-end command usability
