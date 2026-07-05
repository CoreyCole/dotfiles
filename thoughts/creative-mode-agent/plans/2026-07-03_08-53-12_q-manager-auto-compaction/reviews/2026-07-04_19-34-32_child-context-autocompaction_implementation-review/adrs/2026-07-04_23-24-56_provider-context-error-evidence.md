---
date: 2026-07-04T23:24:56-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 184fa8f9f7558eaf4a29fd50c9dafcfbd5a7ac0d
branch: creative-mode-agent/q-manager-auto-compaction_review-fixes
repository: vamos
stage: design
artifact: adr
ticket: 'implementation review follow-up: q-manager child context exhaustion'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
related_artifact: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md
---

# ADR: Model terminal provider context errors as latest-session evidence

A child session can contain an older valid `qrspi_result` and then later end with `stopReason: "error"` plus a context-window `errorMessage`; the latest terminal message is the current child state. The runtime will parse latest assistant terminal metadata from Pi JSONL and let context-window provider errors outrank stale validation/status cache or older QRSPI text.

## Status

Accepted

## Consequences

- `child-complete`, `continue`, `inspect`, and latest-session recovery share one evidence model.
- The runtime does not fabricate a durable QRSPI result; it emits manager-needed operational recovery state.
