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

# ADR: Auto-AGENTS session dedupe and change detection

## Status
Accepted

## Context
The request requires each unique `AGENTS.md` to be read once per session, then re-read when the file content changes.
Pi already distinguishes between durable non-context custom entries and context-participating custom messages.
The new feature needs both: visible/contextual instruction messages and separate persistence for dedupe state.
The plan directory memory also preserves that dedupe identity should be exact absolute path.

## Decision Drivers
- Preserve the “once per session unless content changed” invariant.
- Survive reloads and session restoration.
- Align with existing Pi exact-path dedupe style.
- Avoid re-reading from timestamp-only filesystem churn.
- Keep LLM context free of internal bookkeeping state.

## Decision
Persist auto-agents state via custom entries keyed by exact absolute path and storing the latest content hash.
At runtime, maintain the same map in memory for fast lookup.
On `session_start`, replay relevant custom entries to reconstruct the latest known hash per path.
When a triggering read discovers an `AGENTS.md` path whose current hash differs from the stored hash, emit a new visible custom message for that file and append a fresh state entry.

## Alternatives Considered

### Alternative A: Module-memory-only cache
**Status:** Rejected
This is simpler, but it breaks on reloads and session restoration.
The invariant is session-scoped, not process-scoped.
A process-only cache would be too fragile.

### Alternative B: Use file mtimes instead of content hashes
**Status:** Rejected
This is cheaper but weaker.
The request explicitly calls for re-reading when content changes.
Content hashes directly encode that rule and avoid false positives from metadata-only updates.

### Alternative C: Deduplicate by realpath or inode identity
**Status:** Rejected
This could reduce duplicate loads when symlinks are involved, but it would diverge from the already preserved requirement and from Pi’s existing exact-path-string dedupe approach in resource loading.
Keeping exact absolute path identity makes behavior easier to reason about and matches the plan assumptions.

## Consequences
- Positive: behavior survives reloads and resumed sessions.
- Positive: dedupe logic is deterministic and auditable.
- Positive: bookkeeping stays out of LLM context.
- Trade-off: the session history accumulates small state entries over time.
- Trade-off: symlinked aliases to the same file will be treated as distinct if their absolute paths differ.
