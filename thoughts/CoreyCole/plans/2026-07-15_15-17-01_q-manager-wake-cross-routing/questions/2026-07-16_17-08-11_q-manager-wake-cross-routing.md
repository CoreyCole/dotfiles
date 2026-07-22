---
date: 2026-07-16T17:08:11-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 4f9dd2f8bac86d49e6a039b55a25a6e862cef00e
branch: main
repository: vamos
stage: question
ticket: q-manager concurrent wake cross-routing bug
plan_dir: thoughts/CoreyCole/plans/2026-07-15_15-17-01_q-manager-wake-cross-routing
project: github.com/CoreyCole/vamos
related_projects: []
question_doc: thoughts/CoreyCole/plans/2026-07-15_15-17-01_q-manager-wake-cross-routing/questions/2026-07-16_17-08-11_q-manager-wake-cross-routing.md
brainstorm_doc: thoughts/CoreyCole/plans/2026-07-15_15-17-01_q-manager-wake-cross-routing/context/brainstorms/2026-07-15_15-17-01_q-manager-wake-cross-routing.md
prev_question_docs: []
---

# Research Questions: q-manager Concurrent Wake Cross-Routing

## Brainstorm Summary

- Desired outcome: explain and prevent payload-to-pane cross-routing under arbitrary concurrent q-manager text injections sharing one tmux server.
- Scope includes every caller of q-manager's common tmux paste primitive: child wakes, steering, reprompts, and any additional callers found during research.
- Manager state is per run, but preliminary discovery found a fixed tmux buffer name, `q-manager-wake`, shared across processes between separate set and paste commands.
- Preserve multiline atomic prompt behavior; avoid assuming exact pane targeting or separate JSON state proves end-to-end isolation.
- Research must distinguish same checkout/different plan directories from attempted concurrent managers for the exact same canonical plan directory.
- Design must later reconsider the concurrency/isolation contract for tmux delivery and the identity/lifecycle of any transport resource.

## Context

Concurrent q-manager runs can apparently inject one manager's child wake into another manager's pane. Establish the complete current isolation and delivery behavior, all affected traffic, reproducible interleavings, and test/diagnostic gaps without selecting a fix.

## Brainstorm Artifact

- `context/brainstorms/2026-07-15_15-17-01_q-manager-wake-cross-routing.md` — investigation, alignment, incident hypothesis, and concurrency invariant.

## Questions

1. How are q-manager state files and locks keyed, and what isolation behavior results for managers using one checkout with different plan directories versus the exact same canonical plan directory?
1. What is the complete data flow from each wake, steering message, reprompt, or other q-manager text payload through state lookup, pane selection, tmux transport, paste, and submission?
1. Which mutable resources in that data flow are shared across manager runs or processes, and what concrete command interleavings can cause a payload generated for one manager or child to be pasted into another pane?
1. What atomicity, naming, lifetime, and concurrency semantics do the tmux operations used by q-manager provide, including behavior across windows, sessions, and one shared tmux server?
1. What current unit and integration tests cover payload-to-pane pairing, concurrent delivery, manager lock isolation, queued wakes, and all callers of the paste primitive; what relevant scenarios are absent?
1. What current logs, state fields, payload fields, and recovery commands can distinguish wrong payload content delivered to the correct pane from incorrect pane selection or state-file association after an incident?

## Codebase References

- `cmd/vamos-runtime/internal/qrspicmd/state_store.go` — canonical plan identity, state paths, and lock key behavior.
- `cmd/vamos-runtime/internal/qrspicmd/root.go` — wake construction, queue/delivery decisions, pane selection, steering, and reprompt call paths.
- `cmd/vamos-runtime/internal/qrspicmd/tmux.go` — production text injection and shared named-buffer commands.
- `cmd/vamos-runtime/internal/qrspicmd/options.go` — manager state, delivery state, queued wake, and tmux client types.
- `cmd/vamos-runtime/internal/qrspicmd/tmux_test.go` — serial argument-level tmux transport coverage.
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` — wake delivery, deduplication, queueing, and manager-ready coverage.
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go` — end-to-end manager flow fixtures and wake expectations.
- `.pi/skills/q-manager/SKILL.md` — intended atomic multiline delivery and manager isolation contract.
