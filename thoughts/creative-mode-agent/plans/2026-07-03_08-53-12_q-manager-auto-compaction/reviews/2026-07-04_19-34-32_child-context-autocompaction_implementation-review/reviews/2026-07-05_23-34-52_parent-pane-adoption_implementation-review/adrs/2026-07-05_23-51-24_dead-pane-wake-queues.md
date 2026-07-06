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

# ADR: Dead Pane Wake Queues

Wake delivery should liveness-check the selected manager pane before paste. If the pane is missing/dead/unavailable, store the current-generation queued wake with manager-pane evidence instead of returning a raw paste failure, so later `manager-ready` or explicit current-pane `continue/start-next` can recover without hand-editing state.

## Status

Accepted

## Consequences

- `child-complete` remains safe from child pane context: it does not infer current `$TMUX_PANE`, only queues unavailable-manager delivery.
- Recovery stays in q-manager state/action-card flow instead of tmux error text.
