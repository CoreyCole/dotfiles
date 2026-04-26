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

# ADR: Auto-AGENTS read integration point

## Status
Accepted

## Context
The request wants automatic `AGENTS.md` loading tied specifically to `read` tool usage, and the latest clarification tightens the desired UX: auto-AGENTS should execute through the normal read tool path rather than through a custom message or special output side channel.
Pi’s existing AGENTS loading is startup-oriented prompt assembly through `ResourceLoader`, not a per-read workflow.
Generic `tool_call` and `tool_result` hooks can observe or mutate read executions, but they do not provide a documented nested-tool history mechanism.
Pi does support replacing a built-in tool by registering a tool with the same name.
That replacement seam lets the extension inspect every read call’s arguments and delegate reads through the original read implementation.

## Decision Drivers
- Trigger only on `read`.
- Inspect every read call.
- Keep the normal read behavior intact.
- Use the original read implementation for auto-loaded `AGENTS.md` files too.
- Avoid custom-message or other special output channels.
- Use supported extension APIs rather than undocumented internals.
- Avoid changing Pi’s startup context-loading semantics.

## Decision
Implement the automatic instruction feature as a replacement `read` tool that delegates all actual file reads to the original built-in read implementation.
On every read call, regardless of the requested file type, the extension will inspect the incoming path, discover ancestor `AGENTS.md` files for the resolved target path, and for any file that has not been read yet in the session or whose content hash changed since the last read it will invoke the original read tool for that `AGENTS.md` path before reading the requested target.
The requested file itself still returns through the normal read tool path with no custom message layer and no special output format.
It will not modify `ResourceLoader` or rely on generic `tool_call` / `tool_result` alone.

## Alternatives Considered

### Alternative A: Extend ResourceLoader / system-prompt assembly
**Status:** Rejected
This would fold the feature into Pi’s baseline prompt construction, but that is the wrong trigger.
The request is explicitly about files being read during the session.
Changing `ResourceLoader` would also make the behavior less visible and risk unintended prompt changes outside the read flow.

### Alternative B: Implement purely as `tool_call` / `tool_result` listeners on read
**Status:** Rejected
This keeps the built-in read tool untouched, but it does not provide the right execution point.
The generic hook surfaces can block or patch a read, yet they are not the right place to perform additional delegated `AGENTS.md` reads.

### Alternative C: Use visible custom messages for auto-loaded AGENTS content
**Status:** Rejected
This was initially attractive because it uses a documented visible/session-context API.
However, the clarified requirement is that auto-AGENTS should stay on the normal read path and not invent a special output mode.
Custom messages would create exactly that side channel.

## Consequences
- Positive: the trigger remains exactly the `read` tool.
- Positive: every read call can inspect `input.path` before deciding whether extra AGENTS reads are needed.
- Positive: startup context loading remains unchanged.
- Positive: no separate custom-message UX needs to be designed or maintained.
- Trade-off: the extension must trigger additional delegated reads during one high-level read action because Pi lacks a first-class nested tool API.
- Trade-off: the extension assumes ownership of the built-in read registration and must continue delegating correctly if upstream read behavior evolves.
