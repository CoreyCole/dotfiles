---
date: 2026-04-25T13:28:28-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: d0dbb0f2257b6def9ab813a2834ddf53a883613a
branch: main
repository: dotfiles
stage: design
artifact: adr
ticket: "Plan Pi extensions for tool hooks and automatic AGENTS.md reads"
plan_dir: "thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read"
related_artifact: "thoughts/CoreyCole/plans/2026-04-25_12-59-32_pi-extension-hooks-and-auto-agents-read/design.md"
---

# ADR: Hook configuration surface

## Status
Accepted

## Context
The request asks for Claude-Code-style tool hooks in the personal Pi config, and the latest clarification narrows the target further: Pi should support the Chestnut Flake Claude hook workflow rather than a generic demo subset.
Pi already exposes the needed runtime lifecycle primitives through `tool_call` and `tool_result`, but it does not expose a first-class built-in hook DSL in settings.
The tracked dotfiles settings currently load extension entry points only.
Chestnut Flake’s Claude config already uses settings-defined hooks such as `SessionStart` and `PreToolUse`, and its hook commands expect structured JSON on stdin.
So the missing piece is configuration shape and payload compatibility, not runtime capability.

## Decision Drivers
- Reuse stable Pi extension/runtime surfaces.
- Keep implementation local to dotfiles config.
- Preserve Claude-hook compatibility for the Chestnut Flake workflow.
- Pass full tool arguments to hook commands so scripts can inspect values like read paths and bash commands.
- Avoid modifying Pi core for a config-only need.
- Keep the config auditable and easy to version.

## Decision
Implement the hook feature as a dedicated extension-owned declarative layer that is compatible with the Chestnut Flake Claude hook model.
The extension will load a tracked config file, compile its rules into internal matchers, and dispatch them from Pi lifecycle handlers.
Its stdin payload contract will include Claude-style event names plus full structured tool arguments and result data where applicable.
V1 should support everything currently needed for `cn-hooks`, especially `SessionStart`, `PreToolUse`, and `PostToolUse` where the workflow requires it, with room to map more Claude events later.

## Alternatives Considered

### Alternative A: Patch Pi core to add a native hooks DSL
**Status:** Rejected
This would produce the most globally integrated configuration surface, but it is unnecessary for the current scope.
The request is specifically about the personal dotfiles Pi config.
A Pi core patch would add maintenance burden, broaden the blast radius, and slow iteration.
The existing runtime already provides the needed lifecycle primitives.

### Alternative B: Hard-code hook logic directly in TypeScript with no config file
**Status:** Rejected
This would be fastest for a one-off rule, but it would not satisfy the requested “hook config” outcome.
It would also make future rule changes more expensive and less approachable.
The goal is a reusable configuration surface, not just one special-case extension.

### Alternative C: Reuse Pi settings.json with ad hoc custom fields
**Status:** Rejected
Pi’s user-facing settings surface for this repo is currently an extension loader, not a documented arbitrary extension config namespace.
Reading extension-specific configuration from a separate tracked file keeps ownership clear and avoids coupling behavior to undocumented settings merge semantics.

## Consequences
- Positive: stays entirely inside tracked dotfiles config and uses proven extension seams.
- Positive: supports the actual Chestnut Flake Claude hook workflow instead of a watered-down approximation.
- Positive: easier to test because matching, payload shaping, and command execution are extension-local modules.
- Trade-off: this is a local compatibility layer, not a Pi-standard schema.
- Trade-off: one-to-one parity with every Claude hook event may require explicit adapter logic rather than simple renaming.
- Trade-off: mutation support must be deliberately constrained because Pi does not re-validate mutated tool inputs.
