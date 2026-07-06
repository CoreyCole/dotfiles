---
source: parent provider-context verify blocked follow-up
copied_by: q-manager
note: Implementation-review follow-up plan for inferred/adoptable q-manager parent pane role.
---

# Plan Directory

This is a nested QRSPI implementation-review follow-up plan under the provider-context recovery follow-up.

## Current focus

Fix the remaining manual q-manager/tmux smoke blocker: q-manager parent role is brittle because normal CLI `continue` / `start-next` does not safely infer/adopt the current tmux pane as manager parent when the old parent pane/session is stale, compacting, or replaced.

## Parent context

- Original plan: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction`
- Provider-context follow-up plan: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review`
- Provider-context verify artifact: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/verify.md`
- Implementation workspace: `/home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction`
- This follow-up must stack in the existing implementation workspace/head. Do **not** create a fresh implementation workspace or reset to trunk.

## Accepted direction

- Running `vamos qrspi continue --state-file ...` or state-file `start-next` inside tmux should infer `$TMUX_PANE` as current parent/manager pane when safe.
- Use a shared adoption helper before loaded-state `start-next`, early `continue`, and `manager-ready` flush. Auto-adopt only when old pane is blank/dead/unavailable, delivery is `compacting`, or queued wake needs a current pane.
- Add `--manager-pane` to `continue`; make `start-next --state-file --manager-pane` persist rebind. Treat explicit `--manager-pane` as operator intent even if the old parent pane is still live.
- If old manager pane is live and different and only env `$TMUX_PANE` is available, emit an action card with a safe explicit `--manager-pane "$TMUX_PANE"` command instead of silently rebinding.
- Wake delivery should liveness-check the selected manager pane and queue current-generation wake with evidence when the pane is dead/unavailable; do not infer current pane from child-side delivery.
- Parent Pi `/q-manager` wrapper remains useful for live `ctx.getContextUsage()` and native `ctx.compact()`, but core q-manager liveness should not depend on being inside that exact Pi process.

## Constraints

- Manager state remains local/ephemeral control state; do not put pane IDs/state refs in durable `qrspi_result` YAML.
- Preserve visible child-session rule and q-manager state graph authority.
- Avoid hidden background runner behavior.
- Keep this reusable in Vamos; no Chestnut-private paths/domains in runtime code.

## Desired QRSPI start

Design stage complete; continue to `/q-outline` from this review directory's `design.md`.

## Outline decisions

- `outline.md` decomposes work into shared adoption helper/action-card constants, `continue` and state-file `start-next` integration, `manager-ready` plus dead-pane wake queueing, and regression smoke docs.
- Use existing `--manager-pane` as explicit rebind intent; no new force/adopt flag in this follow-up.
- Child-side delivery must not infer current `$TMUX_PANE`; it only liveness-checks selected pane and queues unavailable-manager wakes.

## Canonical context

- Brainstorm / alignment: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/context/brainstorms/2026-07-05_23-35-36_parent-pane-adoption.md`
- Research agenda: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/questions/2026-07-05_23-35-36_parent-pane-adoption.md`
- Research: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/research/2026-07-05_23-43-28_parent-pane-adoption.md`
- Design: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/design.md`
- Design brainstorm: `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/context/design/2026-07-05_23-51-24_parent-pane-adoption-design-brainstorm.md`
- ADRs: `adrs/2026-07-05_23-51-24_safe-current-pane-adoption.md`, `adrs/2026-07-05_23-51-24_explicit-manager-pane-adoption-intent.md`, `adrs/2026-07-05_23-51-24_dead-pane-wake-queues.md`
