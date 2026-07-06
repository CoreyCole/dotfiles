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

# ADR: Safe Current-Pane Adoption

Q-manager parent pane identity is local control state, and normal recovery commands need to move that identity when the old pane is gone, missing, compacting, or holding a queued wake. Add a shared adoption decision/helper for `continue`, existing-state `start-next`, and `manager-ready`; it may auto-adopt current `$TMUX_PANE` only in those safe states, and otherwise emits an action card for ambiguous live-parent conflicts.

## Status

Accepted

## Consequences

- Plain CLI recovery no longer depends on Pi wrapper/native compaction context.
- Silent takeover of a different live parent remains blocked unless operator supplies explicit pane intent.
