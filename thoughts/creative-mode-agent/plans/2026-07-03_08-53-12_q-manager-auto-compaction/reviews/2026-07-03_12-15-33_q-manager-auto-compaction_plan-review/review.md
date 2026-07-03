---
date: 2026-07-03T12:15:33-07:00
reviewer: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
review_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-03_12-15-33_q-manager-auto-compaction_plan-review
review_mode: planning
review_kind: plan-review
reviewed_artifacts:
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md
  - thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md
status: complete
type: planning_review
verdict: correct
---

# Planning Review: q-manager parent auto-compaction

## Summary

Plan is ready for `/q-workspace` after direct fixes. The implementation plan now keeps parent-wrapper UI wiring type-safe and makes context-exhaustion detection inspect child session JSONL evidence, not only tmux/output tails.

## Current Design / Plan

The plan implements parent auto-compaction in five slices: Go CLI raises compaction to fresh usage >=90% and emits a stable queue-safe signal; a project-local Pi `/q-manager` command samples `ctx.getContextUsage()` and calls native `ctx.compact()` after the CLI signal; wake/no-wake regressions protect validated delivery; context-exhausted no-result children preserve refs and stop with recovery actions; docs and q-manager skill document the new normal path.

## Requirements Alignment

- PRD/ticket requirements: Aligned. User goal is parent native compaction after child launch when manager context is high; plan keeps child-first ordering and 90% fresh parent Pi usage sampling.
- Brainstormed requirements and decisions: Aligned with `context/brainstorms/2026-07-03_08-53-12_q-manager-auto-compaction.md`: visible child panes, local manager refs out of durable YAML, queued wake while parent compacts, parent usage from Pi context only.
- Research/design constraints: Aligned with `research/2026-07-03_09-21-09_q-manager-auto-compaction.md`, `design.md`, `outline.md`, and ADRs: Go CLI remains graph/state authority, parent Pi wrapper owns usage/native compaction, q-manager delivery becomes queue-safe before native compact, no-wake/latest-session recovery stays explicit.

## Findings Summary

- Fixed two planning issues: wrapper output helper received the wrong object, and context-exhaustion evidence ignored provider errors stored only in the child session JSONL.

## Findings

### Finding 1: Parent wrapper output helper used `pi` where it needs command context

- Classification: obvious_doc_fix
- Priority: P2
- References: `plan.md:389`, `plan.md:497`, Pi extension context API `context/pi/packages/coding-agent/src/core/extensions/types.ts`.
- Issue: The Slice 2 skeleton called `publishCLIResult(pi, result)`, but the plan text said the helper should notify via `ctx.ui.notify(...)`. `ExtensionAPI` is registration-time API; command UI is on `ExtensionCommandContext`.
- Example: Implementing the skeleton literally would either make `publishCLIResult` unable to show command output or create a type error when it tries to access UI through `pi`.
- Resolution: Edited `plan.md` to call `publishCLIResult(ctx, result)` and define the helper signature as `publishCLIResult(ctx: ExtensionCommandContext, result: QManagerCLIResult)`.

### Finding 2: Context-exhaustion detection did not inspect child JSONL evidence

- Classification: obvious_doc_fix
- Priority: P1
- References: `plan.md:690`, `plan.md:719`, `plan.md:789`, `cmd/vamos-runtime/internal/qrspicmd/child_health.go`, `cmd/vamos-runtime/internal/qrspicmd/root.go:3512`.
- Issue: Slice 4 said a child session may contain provider context-limit text with no fenced `qrspi_result`, but the proposed evidence helper only checked `health.Evidence` and `health.OutputTail`. Current `ReadChildResultText` / `ChildHasQRSPIResult` reads the child session JSONL, so the implementation can and should inspect session text directly.
- Example: A terminal child whose final session message is `context_length_exceeded` but whose tmux transcript is empty would be classified as generic `launch_failed`, allowing `repair-state --clear-failed-child --relaunch` before preserving/compacting the exhausted session.
- Resolution: Edited `plan.md` to pass final child session text into `HasChildContextExhaustionEvidence`, resolve/read `SessionPath` when needed, add session evidence to the action card, and make tests cover empty transcript plus provider error in JSONL.

## Focused Review Lanes

- Lane selector run for plan mode, but no subagent tool is available in this child session; no focused lane reports were produced.
- Main review performed targeted project-guidance, Go/runtime, Go-test, docs/runbook, and Pi-extension API checks directly.

## Conflicting Guidance

- None.

## Applied Doc Edits

- `plan.md` — changed Slice 2 wrapper skeleton and helper description to pass `ExtensionCommandContext` into `publishCLIResult`.
- `plan.md` — changed Slice 4 context-exhaustion plan to inspect final child session JSONL text in addition to health evidence/output tails, and tightened tests for empty transcript + provider error in JSONL.

## Research Follow-up Needed

- None.

## Human Decisions Needed

- None.

## Follow-up Questions Doc

None.

## Verification

- Read plan guidance: root `AGENTS.md`, plan `AGENTS.md`, `.pi/skills/qrspi-planning/SKILL.md`, `.pi/skills/q-review/SKILL.md`, `.pi/skills/q-review-plan/SKILL.md`, `~/.pi/agent/skills/review-rubric/SKILL.md`.
- Read planning artifacts: `design.md`, `outline.md`, `plan.md`, question doc, research doc, design brainstorm, and prior outline review.
- Read intended changed Vamos files/patterns: `cmd/vamos-runtime/internal/qrspicmd/state.go`, `options.go`, `root.go`, `child_health.go`, `manager_compaction_test.go`, `delivery_test.go`, `child_completion_test.go`, `session_recovery.go`, `docs/q-manager.md`, `.pi/skills/q-manager/SKILL.md`, `.pi/README.md`, `package.json`, `tsconfig.json`.
- Read Pi source for extension APIs: `context/pi/packages/coding-agent/src/core/extensions/types.ts` and package docs excerpts for project extension loading/import surface.
- Ran selector: `uv run .pi/skills/q-review/bin/select-lanes.py --mode outline --plan-dir ... --reviewed-artifact .../plan.md --review-dir .../reviews/TODO_plan-review --pretty`; advisory only because no subagent tool is available here.
- Ran targeted existing tests: `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManager(Usage|Compaction)|TestDelivery'` → pass (cached).
- Checked reviewed plan follows project guidance: fresh copied implementation workspace via `/q-workspace`, Go CLI remains graph authority, visible tmux child model preserved, local manager refs not put in durable `qrspi_result` YAML, docs/runbook updates included.

## Recommended Next Steps

Start `/q-workspace` immediately from the reviewed parent plan.
