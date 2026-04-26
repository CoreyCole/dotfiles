# Design: GitHub Contributor Analyzer CSV CLI

## Goal
Integrate contributor CSV export into `cctl` as `c contrib export`, keeping command wiring aligned with existing Cobra patterns and implementation logic under `pkg/contrib/...`.

## Approach
- Use REST GitHub APIs via go-github:
  - list commits on default branch within date window
  - map commit SHA to associated pull requests
  - fetch PR summary + changed files
- Build one output row per unique merged PR.
- Aggregate extension-level metrics with fixed high-value extension columns and JSON catch-all.
- Emit deterministic CSV ordering and formatting.

## Non-goals
- Multi-repo aggregation
- Database persistence
- Non-CSV output formats
