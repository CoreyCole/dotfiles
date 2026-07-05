---
source: parent verify blocked follow-up
copied_by: q-manager
note: Implementation-review follow-up plan for q-manager child context exhaustion and provider context-window recovery.
---

# Plan Directory

This is a QRSPI implementation-review follow-up plan nested under the parent q-manager auto-compaction plan.

## Current focus

Fix the failed manual live `/q-manager` smoke from the parent plan: managed child sessions can run out of context with provider context-window errors instead of auto-compacting, waking the manager, or producing a recoverable handoff/action card.

## Parent plan context

- Parent plan: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction`
- Parent verify artifact: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/verify.md`
- Parent implementation workspace: `/home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction`
- This follow-up must stack on the existing implementation workspace/head. Do **not** create a new implementation workspace or reset to trunk for this follow-up.

## Bug reports to read

- `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/bug-reports/2026-07-04_16-50-02_q-manager-child-context-compaction-missed.md`
- `/home/ruby/cn/chestnut-flake/cn-agents/thoughts/creative-mode-agent/reports/2026-07-04_16-51-11_qrspi-child-autocompact-context-window-bug.md`

## Known failure evidence

- Child provider error: `Codex error: Your input exceeds the context window of this model. Please adjust your input and try again.`
- No child auto-compaction markers appeared before provider context failure.
- `validation-status.json` can remain stale on an earlier result after manager steering.
- Duplicate wake suppression can hide a later terminal provider/context error after steering.
- `inspect --sessions --latest` can classify a failed child as `finished_success_needs_result_validation` instead of surfacing the terminal provider/context error in latest JSONL.

## Constraints

- Do not invent durable QRSPI results after child context exhaustion.
- Preserve child pane/session refs and latest-session recovery paths.
- Duplicate delivery suppression must not hide a later terminal provider/context error.
- Parent manager compaction and child context handling are related but distinct: parent wrapper uses parent `ctx.getContextUsage()`; child sessions need their own compaction/recovery behavior.
- Keep changes reusable in Vamos; no Chestnut-private paths/domains in runtime code.

## Canonical context

- Brainstorm / alignment: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/context/brainstorms/2026-07-04_19-35-18_child-context-autocompaction.md`
- Research agenda: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/questions/2026-07-04_19-35-18_child-context-autocompaction.md`

## Approved design direction

- Required: classify latest child Pi JSONL terminal provider errors deterministically, even when an older valid QRSPI result exists. Latest context-window `stopReason: "error"` + `errorMessage` outranks stale validation cache.
- Required: `child-complete`, `continue`, `inspect`, and latest-session recovery share one terminal-evidence classifier; parent wake/action card preserves child refs, session path, provider error, latest known artifact/result, and safe recovery commands.
- Required: later terminal provider errors get distinct delivery identity so duplicate suppression does not hide post-steer failures; `validation-status.json` updates to latest terminal error state.
- Helper: recovery summarizer may spawn a fresh read-only Pi/CLI-managed process to inspect filled session tail/artifacts and write `context/recovery/...` note for relaunching the same graph node. It must not invent `qrspi_result` or advance the graph.
- Separate/best-effort: proactive child compaction via Pi extension APIs can be evaluated after deterministic recovery; do not depend on it for recoverability.

## Desired QRSPI start

Continue from approved `design.md` to `/q-outline`; this review follow-up stays in the existing implementation workspace and must not create a new workspace.

## Outline decisions

- `outline.md` decomposes work into parser, shared health/latest-session precedence, `child-complete` delivery/status, action-card evidence, optional `recover-summary`, and regression/manual-smoke slices.
- Outline review fixed coverage so direct `validate-latest --apply-rebind` without `--continue` must surface terminal provider/context evidence instead of accepting stale older QRSPI text.
- Core fix does not depend on proactive child compaction or same-child steering generation changes.
