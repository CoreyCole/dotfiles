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

# ADR: Recovery summarizer is helper, not graph result

When a child fills its context window, a fresh recovery/summarizer Pi process may inspect the failed session tail and artifacts, then write a concise recovery note for relaunching the same graph node. The helper is read-only against code by default, must not invent `qrspi_result`, and does not advance the workflow; it gives the manager safer instructions for the next same-stage child.

## Status

Accepted

## Consequences

- Deterministic CLI classification/wake remains required and independent.
- Recovery notes preserve useful completed work and warn the next child to avoid repeated large-output commands.
