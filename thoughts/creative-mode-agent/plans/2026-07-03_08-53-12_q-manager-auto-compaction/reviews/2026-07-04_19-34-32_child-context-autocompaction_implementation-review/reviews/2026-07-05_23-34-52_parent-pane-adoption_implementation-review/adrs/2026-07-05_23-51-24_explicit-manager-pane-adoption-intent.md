---
date: 2026-07-05T23:51:24-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 424859bd6e6b79a07d290f1ed49799d913fa9c8e
branch: creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes
repository: vamos
stage: design
artifact: adr
ticket: 'implementation-review follow-up: parent pane adoption'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
related_artifact: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/design.md
---

# ADR: Explicit Manager Pane Is Adoption Intent

Reuse `--manager-pane` as the explicit operator intent to rebind manager ownership, including when a different stored parent pane is still live. Add `--manager-pane` to `continue` and make `start-next --state-file --manager-pane` persist the rebind; do not add a separate adopt/force flag unless implementation review shows this is ambiguous in practice.

## Status

Accepted

## Considered Options

- New `--adopt-manager-pane` / `--force-manager-pane`: clearer but adds flag surface while existing q-manager commands already use `--manager-pane` for parent ownership.
- Overload `--force`: rejected because it already means active-child replacement in `start-next`.
