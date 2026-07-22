---
date: 2026-07-22T12:58:23-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 70a090449fe5b7628ec0175c2c8e730e1d4a1dca
branch: main
repository: vamos
stage: outline
plan_dir: thoughts/CoreyCole/plans/2026-07-22_12-58-23_vamos-golangci-remediation
project: github.com/CoreyCole/vamos
related_projects: []
---

# Outline: Vamos GolangCI Remediation

## Overview

Adopt the dotfiles GolangCI policy locally. Reduce correctness and error-handling findings first. Keep broad formatter/style debt out of this remediation.

Direct outline: no `design.md`; baseline is `context/outline/2026-07-22_12-58-23_lint-baseline.md`.

**Scope invariant:** remediate every finding from each slice's named `golangci-lint run --enable-only ... ./...` command, including test files. The command output on base commit `70a0904` is the authoritative file inventory; do not silently narrow a slice to only the example paths below.

## Package / File Structure

- `.golangci.yml` — exact local copy of shared policy.
- `cmd/vamos-runtime/internal/qrspicmd/` — lock/error flow fixes.
- `server/services/{markdown,workspaces,agentchat}/` — vet and service error fixes.
- `pkg/` and `server/` test files — assertions and explicit cleanup intent.

## Slices

### Slice 1: Local policy and definite dead-code findings

**Files:**

- `.golangci.yml` (new)
- `server/services/markdown/workspace_candidates.go` (modify)
- `server/services/workspaces/discovery.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `pkg/datastarui/components/sheet/variants.go` (modify)
- `server/services/agentchat/{workflows/completion.go,workspace_projection.go,workspace_ui.go}` (modify)
- `cmd/build-agents/internal/build/lock_test.go`, `server/services/agentchat/workspace_lifecycle_test.go`, `server/services/workspaces/impl_workspace_sync_test.go`, and QRSPI transition tests (modify)
- Focused tests beside changed production paths (modify when behavior needs coverage)

```go
// Remove tautological err != nil branches.
// Remove assignments overwritten before their first read.
```

**Test checkpoint:** targeted package tests; rerun `golangci-lint run --enable-only govet,ineffassign,wastedassign ./...` and resolve every reported finding (14 at the recorded baseline), including test-only `govet`/`ineffassign` findings.

### Slice 2: Wrapped error semantics

**Files:**

- `cmd/agent-chat-wait-result/main.go` (modify)
- `cmd/vamos-runtime/internal/{chatcmd,qrspicmd}/` (modify)
- `pkg/agents/workflows/conversation/` (modify)
- all remaining files reported by `golangci-lint run --enable-only errorlint ./...`, including `cmd/build-agents/internal/build`, `pkg/ctl/verifycmd`, `server/services/{agentchat,examples/pickleball,theme,workspaces}` source and tests (modify)

```go
errors.Is(err, sentinel)
errors.As(err, &httpErr)
fmt.Errorf("context: %w", err)
```

**Test checkpoint:** focused handler/CLI tests; rerun `golangci-lint run --enable-only errorlint ./...` and resolve every reported finding (33 at the recorded baseline).

### Slice 3: Checked cleanup and output failures

**Files:**

- every source or test file reported by `golangci-lint run --enable-only errcheck ./...`, with the concentrated transaction, q-manager lock, renderer/SSE, applet-process, and metrics owners as the expected clusters (modify)

```go
// Explicitly discard only best-effort rollback/unlock cleanup.
defer func() { _ = tx.Rollback() }()
```

**Test checkpoint:** transaction/service, q-manager, renderer, SSE, and process tests; `golangci-lint run --enable-only errcheck ./...` clean or each remaining intentional discard is explicit and justified.

### Slice 4: Static analysis and unused ownership review

**Files:**

- every source or test file reported by `golangci-lint run --enable-only staticcheck,unused ./...`, including `cmd/server/main.go`, QRSPI/runtime, and Agent Chat integration/test helpers (modify)
- each confirmed dead `unused` symbol and its tests (modify/delete); retain reachable public/template/reflection seams only after tracing callers

```go
// Use non-nil contexts; retain only reachable public/template/reflection seams.
```

**Test checkpoint:** targeted affected packages; rerun `golangci-lint run --enable-only staticcheck,unused ./...` and resolve every reported finding (97 at the recorded baseline), after ownership tracing for every `unused` candidate.

## Out of Scope

- Bulk `golangci-lint fmt` rewrite.
- `nlreturn`, `paralleltest`, `tagliatelle`, `usetesting`, `mnd`, `perfsprint`, and other high-volume style queues.
- Deleting `unused` symbols without tracing callers, templates, generated code, or reflection.
