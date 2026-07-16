---
date: 2026-07-16T16:29:36-07:00
reviewer: CoreyCole
git_commit: 7ca824d7960e617861f647fd6314da34b2cff1fc
branch: main
repository: vamos
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
review_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/reviews/2026-07-16_16-29-36_q-manager-session-handoff-rotation_plan-review
review_mode: planning
review_kind: plan-review
reviewed_artifacts:
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/design.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/outline.md
  - thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/plan.md
status: complete
type: planning_review
verdict: correct
---

# Planning Review: q-manager session handoff rotation

## Summary

Post-edit plan is ready for workspace preparation. Three P1 implementation traps were fixed: child delivery generation was incorrectly treated as a process lease, conversational q-manager could not bind parent monitoring, and Slice 2 would break old compaction tests before Slice 3 removed them.

## Current Design / Plan

At configurable 75% completed-turn usage, manager and child extensions persist one role-specific rotation request and steer durable handoff work. Child completion reuses merged same-node q-resume lineage, wake delivery, and predecessor cleanup. Manager completion validates an operational artifact before convergent exact-pane `/new`; fresh `session_start` proves predecessor lineage, injects kickoff, and `agent_start` releases one queued wake. Three Graphite slices add child triggering, manager replacement, then remove native compaction and verify two rotation cycles.

## Requirements Alignment

- PRD/ticket requirements: aligned; no separate PRD. Proactive manager/child rotation, durable handoff before replacement, inspectable predecessors, no compaction fallback, and repeated-rotation evidence are explicit.
- Brainstormed requirements and decisions: aligned with `context/brainstorms/2026-07-14_12-21-37_q-manager-session-handoff-rotation.md`; steering remains post-batch, manager stays same-pane, and children reuse fresh-pane q-resume.
- Research/design constraints: aligned with `research/2026-07-14_15-34-21_q-manager-session-handoff-rotation.md`, merged-baseline validation, accepted ADRs, current q-manager recovery semantics, and Pi's `previousSessionFile` lifecycle.

## Findings Summary

- Fixed three P1 plan defects: stale child generation ownership, missing conversational manager binding, and a non-green Slice 2 transition plus omitted pane-adoption files.

## Findings

### Finding 1: Child delivery generation cannot be exported as a stable process lease

- Classification: obvious_doc_fix
- Priority: P1
- References: pre-edit `design.md` child request contract; pre-edit `outline.md` / `plan.md` `ChildGeneration` input; `cmd/vamos-runtime/internal/qrspicmd/root.go:3544-3547`; `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go:501-513`; `cmd/vamos-runtime/internal/qrspicmd/child.go:11-31`
- Issue: The plan required JavaScript to submit `Q_MANAGER_CHILD_GENERATION`, but existing `mark-child-active` and rebind recovery increment `ActiveChild.Generation` without restarting the child process. The extension environment would retain the old value, so the current child would be rejected permanently after supported recovery.
- Example: Manager marks the same child/session active after manual steering, generation changes from 1 to 2, and the still-running extension continues requesting with environment generation 1. A 75% rotation request is then rejected as stale.
- Resolution: Removed generation from the extension/CLI input. The locked CLI now verifies child ID + exact JSONL, safely binds the first managed session path, and snapshots current `ActiveChild.Generation` only after identity matches. Updated design, outline, plan, tests, final checklist, and plan memory.

### Finding 2: Conversational q-manager could launch children without binding parent rotation

- Classification: obvious_doc_fix
- Priority: P1
- References: `.pi/skills/q-manager/SKILL.md:10-20`; `.pi/skills/q-manager/SKILL.md:42-46`; `.pi/extensions/q-manager-parent.ts:31-64`; `cmd/vamos-runtime/internal/qrspicmd/root.go:940-946`
- Issue: The plan bound state only inside direct `/q-manager start-next|continue` command handlers. The advertised bare conversational `/q-manager` starts an agent that can run raw CLI through a bash tool but cannot self-invoke a slash command, leaving `turn_end` monitoring unbound.
- Example: Bare `/q-manager` resolves a plan and runs `vamos qrspi start-next` via bash. The child starts normally, but `Q_MANAGER_STATE_FILE` is never set in the parent extension, so manager usage can cross 75% without a rotation request.
- Resolution: Require stable `state: <path>` output from both start and continue. Parent `turn_end` maps matching successful bash calls to non-error tool results and binds only their marker; direct command binding remains. Added negative binding tests and made the manager smoke begin through conversational startup. Child-only smoke uses raw CLI deliberately so the shared 1% threshold cannot also rotate the parent.

### Finding 3: Slice 2 would fail before Slice 3 removed compacting behavior

- Classification: obvious_doc_fix
- Priority: P1
- References: pre-edit `plan.md` Slice 2 queue transition/file list; `cmd/vamos-runtime/internal/qrspicmd/root.go:2696-2699`; `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go:206-273`; `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go:131-162`; `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go:115-134`
- Issue: Slice 2 changed queue/adoption behavior from `compacting` to `replacing` while still running the old compaction tests; deletion was deferred to Slice 3. It also omitted the production and test pane-adoption files that contain compacting-specific logic. The required Slice 2 package test could not remain green as written.
- Example: `TestManagerCompactionQueuesAndFlushesWake` creates `Delivery.Status=compacting`; if Slice 2 recognizes only `replacing`, the wake is delivered instead of queued.
- Resolution: Slice 2 now recognizes both statuses temporarily, adds `replacing` to pane adoption, and lists both pane-adoption files/tests. Slice 3 explicitly deletes the temporary compacting branches/fixtures. Verification and gofmt file lists were updated.

## Focused Review Lanes

- Selector run in planning mode. It selected intent-fit, project-guidance, docs-health, tests/verification, integration/ops, maintainability, Go, and Go-test lanes; SQL/CI matches were prose false positives.
- Subagent execution was unavailable in this session. Main reviewer directly covered the selected lanes against current Go/TypeScript/docs and local Pi API source.

## Conflicting Guidance

- None. Pi's source guidance requires asking before intentional functionality removal, but native compaction removal was already explicitly approved in the design and ADRs.

## Applied Doc Edits

- `design.md` — replaced environment generation ownership with locked session identity/generation snapshot; required conversational manager binding.
- `outline.md` — updated request types/CLI/lifecycle, binding path, slice transition, pane-adoption files, tests, and failure matrix.
- `plan.md` — made all three fixes tactical, added exact tests/file lists, preserved green intermediate slices, and isolated controlled smoke stories.
- `AGENTS.md` — preserved the corrected ownership, binding, and slice-sequencing invariants.

## Research Follow-up Needed

- None.

## Human Decisions Needed

- None.

## Follow-up Questions Doc

None.

## Verification

- Read root and plan `AGENTS.md`; no narrower guidance exists under `cmd/vamos-runtime/internal/qrspicmd`, `.pi/extensions`, `.pi/skills`, or `docs`.
- Read design, outline, plan, questions, brainstorm, research, merged-baseline evidence, prior outline review, and design context.
- Read current `options.go`, `state.go`, `prompt_file.go`, `child.go`, generated child extension, parent extension, manager pane adoption, relevant `root.go` request/launch/completion/delivery/ready/continue sections, recovery generation code, compaction/delivery tests, and q-manager skill/docs targets.
- Read local Pi `SessionStartEvent`, `sendUserMessage`, `agent_settled`, `session_before_compact`, and `AgentSessionRuntime.newSession` source; confirmed predecessor and event assumptions.
- Re-read edited planning docs and searched for stale child-generation export language, missing pane-adoption scope, and intermediate compacting sequencing.

## Recommended Next Steps

Start `/q-workspace` immediately from the reviewed parent `plan.md`.
