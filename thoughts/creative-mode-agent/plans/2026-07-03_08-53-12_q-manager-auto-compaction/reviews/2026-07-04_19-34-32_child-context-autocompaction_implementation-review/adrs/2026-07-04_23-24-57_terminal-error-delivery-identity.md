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

# ADR: Terminal provider errors have distinct delivery identity

A later provider context-window error after manager steering is not a duplicate of an earlier valid blocked result, even when child ID and generation did not change. Delivery IDs for terminal provider evidence will include a stable evidence identity from the session tail, so the parent manager receives one fresh wake for the new failure while repeated validation of the same final JSONL line remains suppressible.

## Status

Accepted

## Consequences

- Duplicate suppression stays useful for identical repeated validations.
- Stale `validation-status.json` no longer hides newer terminal child evidence.
