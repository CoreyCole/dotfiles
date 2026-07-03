---
date: 2026-07-03T11:49:54-07:00
reviewer: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
review_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-03_11-49-54_q-manager-auto-compaction_outline-review
review_mode: planning
review_kind: outline-review
reviewed_artifacts:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md
status: complete
type: planning_review
verdict: correct
---

# Planning Review: q-manager parent auto-compaction

## Summary

Design and outline are ready for `/q-plan`. The plan keeps authority boundaries clean: Pi parent command samples live usage and invokes native compaction; Go CLI remains graph/state/wake authority; durable QRSPI YAML stays free of local manager refs.

## Current Design / Plan

Parent manager gets a project-local Pi command (`/q-manager start-next` / `continue`) that calls `ctx.getContextUsage()`, forwards explicit usage flags to the existing `vamos qrspi` CLI, parses a stable compaction-started signal, and calls `ctx.compact()` only after the CLI saved child refs and `Delivery.Status=compacting`. CLI work raises the trigger to 90%, persists last live usage as local diagnostics, writes an operational handoff, and preserves wake queue/flush/recovery behavior.

## Requirements Alignment

- PRD/ticket requirements: Aligned. User goal was parent native compaction after child launch when manager context is high; `design.md` and `outline.md` implement child-first ordering, fresh parent Pi usage sampling, and 90% threshold.
- Brainstormed requirements and decisions: Aligned with `context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md`: visible child sessions, durable YAML boundary, wake during compaction queues, and parent usage from Pi context only.
- Research/design constraints: Aligned with `research/2026-07-03_09-21-09_q-manager-auto-compaction.md` and ADRs: current CLI ordering is reused, Pi extension APIs exist, native compaction is parent-only, and q-manager delivery queue remains the wake authority.

## Findings Summary

- None.

## Findings

None.

## Focused Review Lanes

- Lane selector run for outline mode; subagent tool unavailable in this child session, so no focused lane reports were produced.
- Main review performed targeted project-guidance, Go/runtime, Go-test, docs, and Pi-extension API checks directly.

## Conflicting Guidance

- None.

## Applied Doc Edits

- None.

## Research Follow-up Needed

- None.

## Human Decisions Needed

- None.

## Follow-up Questions Doc

None.

## Verification

- Read plan guidance: `AGENTS.md`, plan `AGENTS.md`, `.pi/skills/qrspi-planning/SKILL.md`, `.pi/skills/q-review/SKILL.md`, `.pi/skills/q-review-plan/SKILL.md`, `~/.pi/agent/skills/review-rubric/SKILL.md`.
- Read planning artifacts: `design.md`, `outline.md`, question doc, research doc, design brainstorm, and five ADRs.
- Read intended changed Vamos files/patterns: `cmd/vamos-runtime/internal/qrspicmd/state.go`, `options.go`, `root.go`, `manager_compaction_test.go`, `delivery_test.go`, `session_recovery.go`, `docs/q-manager.md`, `.pi/skills/q-manager/SKILL.md`.
- Read Pi source/docs for parent extension API: `context/pi/packages/coding-agent/src/core/extensions/types.ts`, `interactive-mode.ts`, `agent-session.ts`, and `docs/extensions.md`.
- Verified current q-manager runtime tests still pass before planned changes: `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManager(Usage|Compaction)|TestDelivery'`.
- Checked outline follows project guidance: no DB/schema work, fresh parent usage not JSONL-scanned, local manager state not durable YAML, visible tmux child model preserved, and docs/runbook update included.

## Recommended Next Steps

Start `/q-plan` immediately from the reviewed outline.
