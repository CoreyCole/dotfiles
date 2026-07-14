---
date: 2026-07-14T13:10:05-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 5abf7fa87e3e8cfee8ecada9ea8b2b4e40f16216
branch: main
repository: vamos
stage: question
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
question_doc: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/questions/2026-07-14_13-10-05_q-manager-session-handoff-rotation.md
brainstorm_doc: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/context/brainstorms/2026-07-14_12-21-37_q-manager-session-handoff-rotation.md
prev_question_docs: []
---

# Research Questions: q-manager session handoff rotation

## Brainstorm Summary

- Replace Pi compaction with proactive durable handoff plus fresh-session rotation for both q-manager and managed child sessions.
- Child stage handoffs use normal q-handoff semantics; manager handoffs should use a dedicated lightweight wrapper that adds local control-plane recovery context.
- Rotation must begin at a stable boundary before another normal provider request; `agent_end` is too late.
- One `turn_end` follows the full concurrent-tool batch, so context reserve must cover aggregate batch growth plus handoff creation.
- Fresh successor automatically reads the handoff before work resumes; old sessions remain inspectable but cannot retain active ownership.
- Preserve exactly-once ownership, stale-wake suppression, deterministic failure recovery, visible child panes, and no runtime-invented QRSPI results.

## Context

A managed research child exhausted its provider context before producing its required artifact/result. Manual compaction appended a compaction entry but did not resume QRSPI. The desired system proactively checkpoints manager and child work through QRSPI handoffs, replaces the near-limit Pi session, injects the handoff into a fresh successor, and continues the same workflow role or graph node.

## Brainstorm Artifact

- `context/brainstorms/2026-07-14_12-21-37_q-manager-session-handoff-rotation.md` — full alignment, terminology, branch map, and interview rationale.

## Questions

1. What exact Pi lifecycle ordering and synchronization guarantees exist around `turn_end`, parallel tool completion, queued steering/follow-up messages, context construction, provider requests, `agent_end`, and `agent_settled`?
1. How accurately does `ctx.getContextUsage()` represent the next outbound context at each candidate hook, including trailing tool results, parallel batches, initial prompts, resumed sessions, and unknown/null usage states?
1. What are the current QRSPI graph, parser, and q-manager semantics for `status: handoff` and same-node continuation across every child stage, and which stages currently lack a valid handoff/resume transition?
1. What artifact and prompt contracts do `q-handoff`, `q-resume`, manager operational handoffs, and existing child prompt rendering currently enforce, and where can a dedicated `q-manager-handoff` wrapper reuse versus specialize those contracts?
1. What Pi and q-manager APIs can deterministically create a fresh manager session or fresh child session, inject the full prior result and exact handoff artifact, transfer active ownership, and retire the old session without stale wakes or duplicate successors?
1. What measurable context-growth bounds exist for system/context files, prompts, assistant output, and combined concurrent-tool results, and what safety reserve is required to finish a handoff before provider overflow across supported models?
1. Which failure interleavings and test seams must be covered to prove proactive rotation converges: duplicate threshold events, handoff failure, successor launch failure, unknown usage, large parallel batches, stale wakes, and interrupted manager replacement?

## Codebase References

- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js` — current child lifecycle hook and completion path.
- `.pi/extensions/q-manager-parent.ts` — current parent usage sampling and native-compaction replacement target.
- `.pi/skills/q-handoff/SKILL.md` — normal stage and manager-operational handoff contracts.
- `.pi/skills/q-resume/SKILL.md` — successor context-loading and same-stage continuation behavior.
- `.pi/skills/q-manager/SKILL.md` — current manager wake, handoff, and recovery policy.
- `cmd/vamos-runtime/internal/qrspicmd/root.go` — manager usage threshold, handoff writing, child completion, successor launch, and delivery state.
- `cmd/vamos-runtime/internal/qrspicmd/prompt.go` — child prompt construction from prior QRSPI results.
- `pkg/agents/workflows/qrspi/` — graph nodes, statuses, transition semantics, and handoff coverage.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/agent-session.ts` — Pi event ordering, queued continuation, context usage, and session replacement behavior.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/src/core/extensions/types.ts` — extension event and session-control API contracts.
- `/Users/swarm/dotfiles/context/pi/packages/coding-agent/examples/extensions/handoff.ts` — programmatic fresh-session handoff example.
- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/` — prior manager compaction and child-context recovery findings to supersede rather than repeat.
