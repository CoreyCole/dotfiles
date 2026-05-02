# Tests and Verification Lane Report

Verdict: concerns

## Findings
- [P2] Absence checks are written as failing commands — `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md:190`
  - Evidence: Slice 2, Slice 3, and the final sweep use plain `rg` commands for patterns that are expected to be absent (`outline.md:190`, `outline.md:248`, `outline.md:249`, `outline.md:305`-`307`). `rg` exits 1 when it finds no matches, so the success condition currently looks like a command failure if run directly or in CI.
  - Impact: The checkpoints are specific, but not cleanly runnable as pass/fail commands; implementers may either treat successful absence as failure or ignore nonzero exits and miss real verification failures.
  - Suggested fix: Prefix expected-absence checks with `! rg ...` (or wrap them in explicit `if rg ...; then exit 1; fi`) and leave expected-presence checks as plain `rg`.
- [P2] Deletion checkpoint does not prove the stale cache is removed from tracking — `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md:150`
  - Evidence: Slice 1 uses `git ls-files --deleted -- .pi-config/pi-subagents` while the expected assertion says stale `.pi-config/pi-subagents/**` files remain deleted. That command only lists tracked index entries missing from the worktree; it will not prove no tracked paths remain after staged removal or commit.
  - Impact: The checkpoint can give an ambiguous signal for the core git-hygiene acceptance condition, especially if the implementer uses `git rm` or stages deletions before review.
  - Suggested fix: Add an explicit tracked-path absence check such as `test -z "$(git ls-files -- .pi-config/pi-subagents)"` for the final state, and use `git status --short -- .pi-config/pi-subagents` only to inspect pending deletions.

## What I Read
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/AGENTS.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/prds/user-request.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/adrs/2026-05-02_00-12-07_keep-agent-runtime-layout.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/adrs/2026-05-02_00-12-07_validation-only-setup.md`
- `thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/adrs/2026-05-02_00-12-07_deconflict-subagent-names.md`

## Verification
- `nl -ba /Users/coreycole/dotfiles/thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md | sed -n '90,230p'` — inspected slice checkpoint line references.
- `nl -ba /Users/coreycole/dotfiles/thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/outline.md | sed -n '230,340p'` — inspected remaining checkpoint line references.
- `find /Users/coreycole/dotfiles/thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup -maxdepth 2 -type f | sort` — confirmed relevant plan artifacts present.

## Notes for Main Reviewer
- The outline otherwise has targeted syntax, JSON, git-boundary, setup, and documentation checks tied to the stated acceptance behavior.
