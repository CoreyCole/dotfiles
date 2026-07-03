---
date: 2026-07-03T11:45:23-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
stage: outline
ticket: q-manager auto-compact parent after child launch
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Outline: q-manager parent auto-compaction

## Overview

Add parent-side Pi q-manager command/wrapper. It samples live parent usage with `ctx.getContextUsage()`, runs existing `vamos qrspi start-next` / `continue`, then triggers native `ctx.compact()` only after CLI saved child refs and delivery `compacting`. Product design not used: internal runtime/control-plane feature.

Human clarification preserved: Go CLI validates child session JSONL for child results, but does not scan JSONL for parent usage. Parent usage comes only from live parent Pi extension context.

## Type Definitions

```go
const managerCompactionThresholdPercent = 90.0

type ManagerUsageInput struct {
    UsagePercent *float64 `json:"usagePercent,omitempty"`
    Tokens       *int     `json:"tokens,omitempty"`
    Window       *int     `json:"window,omitempty"`
}

type ManagerUsageSample struct {
    Percent   *float64 `json:"percent,omitempty"`
    Tokens    *int     `json:"tokens,omitempty"`
    Window    *int     `json:"window,omitempty"`
    Source    string   `json:"source"`
    SampledAt string   `json:"sampledAt"`
}

type ManagerCompactionStatus struct {
    Started      bool   `json:"started"`
    Reason       string `json:"reason,omitempty"`
    UsagePercent string `json:"usagePercent,omitempty"`
    HandoffPath  string `json:"handoffPath,omitempty"`
    ReadyCommand string `json:"readyCommand,omitempty"`
}

type ManagerState struct {
    LastManagerUsage *ManagerUsageSample `json:"lastManagerUsage,omitempty"`
}
```

```ts
import type { ContextUsage, ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

type QManagerAction = "start-next" | "continue";

type QManagerCLIResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  compaction: QManagerCompactionSignal;
};

type QManagerCompactionSignal = {
  started: boolean;
  handoffPath?: string;
  readyCommand?: string;
};

function usageFlagsFromContext(usage: ContextUsage | undefined): string[];
function runQManagerCLI(action: QManagerAction, args: string[], usageFlags: string[], cwd: string): Promise<QManagerCLIResult>;
function parseCompactionSignal(stdout: string): QManagerCompactionSignal;
function compactParent(ctx: ExtensionCommandContext, signal: QManagerCompactionSignal): void;
```

## Database Schema

No database change. q-manager state remains local JSON under user state dir.

```json
{
  "lastManagerUsage": {
    "percent": 91.2,
    "tokens": 182400,
    "window": 200000,
    "source": "pi-extension-context",
    "sampledAt": "2026-07-03T11:45:23-07:00"
  },
  "delivery": {
    "status": "compacting"
  }
}
```

## Package / File Structure

- `.pi/extensions/q-manager-parent.ts` (new) — project-local parent Pi command/wrapper.
- `cmd/vamos-runtime/internal/qrspicmd/state.go` — local usage sample field.
- `cmd/vamos-runtime/internal/qrspicmd/options.go` — compaction status/result type updates.
- `cmd/vamos-runtime/internal/qrspicmd/root.go` — 90% threshold, usage sample persistence, stable compact signal.
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` — threshold/signal/diagnostic coverage.
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` — queue/flush/stale wake regression coverage.
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` or `integration_test.go` — no-wake/context-exhaustion recovery coverage.
- `docs/q-manager.md` — normal path uses parent Pi command; CLI usage flags are debug seam.
- `.pi/skills/q-manager/SKILL.md` — operator runbook wording.

## API Surface

### Parent Pi command

```text
/q-manager start-next --plan-dir <path> --project-root <path> [existing start-next flags]
/q-manager continue --state-file <file> [existing continue flags]
```

Behavior:

- Command runs inside parent manager Pi process.
- Calls `ctx.getContextUsage()` at manager-turn boundary.
- If usage has `percent`, passes `--manager-usage-percent <percent>`.
- Else if usage has `tokens` and `contextWindow`, passes token/window flags.
- Else runs CLI without usage flags; no native compact.
- Shows concise CLI output in manager chat.
- Calls `ctx.compact()` only when CLI output carries stable compaction-started signal.

### CLI text signal

```text
manager compaction: started; usage 91.2% >= 90%; handoff written
q-manager-parent-compact: started
handoff: /path/to/handoffs/YYYY-MM-DD_HH-MM-SS_q-manager-operational-handoff.md
ready: vamos qrspi manager-ready --state-file /path/state.json --manager-pane $TMUX_PANE
```

### Native compact instructions

```text
Read q-manager operational handoff: <handoffPath>.
After compaction, run exactly once:
<readyCommand>
Then follow any flushed q_manager_child_wake.
```

## Slices

### Slice 1: CLI threshold, signal, and diagnostics

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/state.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` (modify)

```go
func managerUsagePercent(input ManagerUsageInput) (float64, bool)
func managerUsageSample(input ManagerUsageInput, now time.Time) *ManagerUsageSample
func maybeStartManagerCompaction(ctx context.Context, state ManagerState, stateFile string, usage ManagerUsageInput, d deps, out io.Writer) (ManagerState, ManagerCompactionStatus, error)
func writeCompactionDiagnostic(out io.Writer, status ManagerCompactionStatus) error
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManager(Usage|Compaction)'`

### Slice 2: Parent Pi q-manager command/wrapper

**Files:**

- `.pi/extensions/q-manager-parent.ts` (new)
- `.pi/README.md` (modify if command should be advertised)

```ts
export default function (pi: ExtensionAPI): void;
function usageFlagsFromContext(usage: ContextUsage | undefined): string[];
function parseArgs(args: string): { action: QManagerAction; passthrough: string[] };
function runQManagerCLI(action: QManagerAction, args: string[], usageFlags: string[], cwd: string): Promise<QManagerCLIResult>;
function parseCompactionSignal(stdout: string): QManagerCompactionSignal;
function compactParent(ctx: ExtensionCommandContext, signal: QManagerCompactionSignal): void;
```

**Test checkpoint:** load extension in Pi, run `/q-manager start-next ...` at mocked/manual high usage; CLI launches child first, then parent native compaction starts only after compact signal.

### Slice 3: Wake/recovery safety regressions

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go` (modify if fixture needed)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` (modify only if diagnostics missing)

```go
func queueOrDeliverWake(ctx context.Context, stateFile string, state ManagerState, status ChildCompletionStatus, d deps) (ManagerState, WakeDeliveryInstruction, error)
func RunManagerReady(ctx context.Context, opts ManagerReadyOptions, d deps, out io.Writer) error
func RunValidateLatest(ctx context.Context, opts ValidateLatestOptions, d deps, out io.Writer) (*ValidateLatestResult, error)
func RunRecoverManual(ctx context.Context, opts RecoverManualOptions, d deps, out io.Writer) error
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestDelivery|Test.*Latest|Test.*RetryExhausted'`

### Slice 4: Docs and operator runbook

**Files:**

- `docs/q-manager.md` (modify)
- `.pi/skills/q-manager/SKILL.md` (modify)
- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/AGENTS.md` (already updated with JSONL clarification)
- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md` (already updated with JSONL clarification)

```text
Normal path: /q-manager start-next / continue from parent Pi.
Debug path: raw vamos qrspi start-next / continue with explicit --manager-usage-* flags.
Recovery: inspect latest, validate-latest --apply-rebind, recover-manual --mode latest-session --continue.
Child exhaustion: compact child only with context-limit evidence; otherwise steer/resume/rebind or relaunch same node.
```

**Test checkpoint:** `rg -n "80%|JSONL|manager-usage|ctx.getContextUsage|q-manager start-next" docs/q-manager.md .pi/skills/q-manager/SKILL.md`

## Out of Scope

- Go CLI scanning Pi JSONL for parent context usage.
- Durable `qrspi_result` carrying manager state, usage samples, state files, panes, or session refs.
- Hidden/background child runner replacing visible tmux child sessions.
- Multi-wake queue; one active child plus generation/lifecycle stale suppression remains enough.
- Pi core/session metadata changes.
