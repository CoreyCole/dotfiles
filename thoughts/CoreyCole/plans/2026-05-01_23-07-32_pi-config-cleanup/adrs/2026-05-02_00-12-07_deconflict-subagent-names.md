---
date: 2026-05-02T00:12:07-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: design
artifact: adr
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
related_artifact: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md
---

# ADR: Deconflict Subagent Names

## Status

Accepted

## Context

`nicobailon/pi-subagents` ships builtin agents named `researcher`, `reviewer`, `scout`, and `worker`.
The local `.pi-config/agent/agents/` directory also defines those names.
`pi-subagents` merges builtin agents first and user agents second, so local files silently override package builtins under normal `agentScope: "both"` behavior.
Some local colliding agents also use older model settings that conflict with the clarified GPT 5.5 rule.

## Decision Drivers

- Generic package builtin names should mean the package-provided behavior unless intentionally overridden.
- Personal variants are still valuable, but their names should describe their special purpose.
- Builtin field tweaks such as model changes should use `subagents.agentOverrides` rather than copied whole-agent files.
- Local/default agents should use GPT 5.5; fast local agents should use thinking off rather than mini/spark model variants.

## Decision

Eliminate local same-name collisions with package builtins.
Rename personal local variants to purpose-specific names:

- `researcher` -> `web-researcher`
- `reviewer` -> `rubric-reviewer`
- `scout` -> `qrspi-scout`
- `worker` -> `todo-worker`

Keep package builtin names available for normal delegation.
Use `agent/settings.json` `subagents.agentOverrides` for durable builtin tweaks, especially any model normalization needed to keep default delegated agents on GPT 5.5.
Update local renamed agent frontmatter to GPT 5.5, using `gpt-5.5:off` only when the local agent is explicitly optimized for fast/no-thinking work.
Update docs and skill text that refer to the old local names when those references are intended to mean the local personal variant.

## Alternatives Considered

### Alternative A: Keep local agents overriding package builtins

**Status:** Rejected

This preserves behavior but leaves future users unable to tell whether `researcher`, `reviewer`, `scout`, or `worker` means package behavior or local behavior without inspecting files.
It also hides package updates behind stale local copies.

### Alternative B: Delete all local colliding agents outright

**Status:** Rejected

Some local variants encode useful personal workflows, such as Parallel.ai-backed web research, read-only rubric review, QRSPI-aware scouting, and todo/commit-oriented implementation.
Renaming preserves those workflows without hijacking package defaults.

### Alternative C: Convert every local variant into a builtin override

**Status:** Rejected

Builtin overrides are best for changing fields like model, tools, thinking, skills, or small prompt adjustments.
The local variants have distinct roles and prompts, so unique names are clearer than deep overrides of generic package agents.

## Consequences

- Delegating to `researcher`, `reviewer`, `scout`, or `worker` becomes predictable package behavior.
- Personal workflows remain available under explicit names.
- The implementation must update references in docs/skills that intentionally point at local variants.
- The settings file becomes the place for durable builtin model overrides instead of duplicated agent files.
