---
date: 2026-07-04T23:33:48-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 184fa8f9f7558eaf4a29fd50c9dafcfbd5a7ac0d
branch: creative-mode-agent/q-manager-auto-compaction_review-fixes
repository: vamos
stage: outline
ticket: 'implementation review follow-up: q-manager child context exhaustion'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Outline: q-manager child context exhaustion recovery

## Overview

Build deterministic child provider context-window recovery. Shared latest-session terminal evidence outranks stale QRSPI validation; child-complete/continue/inspect write manager-needed recovery with session refs and distinct delivery identity. Product design skipped: internal runtime recovery fix, low product-risk.

## Type Definitions

```go
type AssistantTerminalEvidence struct {
    SessionPath        string `json:"sessionPath,omitempty"`
    SessionID          string `json:"sessionId,omitempty"`
    Line               int    `json:"line,omitempty"`
    Timestamp          string `json:"timestamp,omitempty"`
    StopReason         string `json:"stopReason,omitempty"`
    ErrorMessage       string `json:"errorMessage,omitempty"`
    ContextWindowError bool   `json:"contextWindowError,omitempty"`
    EvidenceID         string `json:"evidenceId,omitempty"`
}

type sessionEntry struct {
    Type      string          `json:"type"`
    ID        string          `json:"id,omitempty"`
    Cwd       string          `json:"cwd,omitempty"`
    Timestamp string          `json:"timestamp,omitempty"`
    Message   *sessionMessage `json:"message,omitempty"`
}

type sessionMessage struct {
    Role         string          `json:"role"`
    Content      json.RawMessage `json:"content"`
    StopReason   string          `json:"stopReason,omitempty"`
    ErrorMessage string          `json:"errorMessage,omitempty"`
}

func LatestAssistantTerminalEvidence(path string) (AssistantTerminalEvidence, bool, error)
func IsContextWindowErrorMessage(message string) bool
func terminalEvidenceID(e AssistantTerminalEvidence) string
```

```go
type ChildCompletionStatus struct {
    Validated        bool                      `json:"validated"`
    ManagerNeeded    bool                      `json:"managerNeeded"`
    RetryExhausted   bool                      `json:"retryExhausted"`
    ChildID          string                    `json:"childId"`
    DeliveryID       string                    `json:"deliveryId"`
    Result           ChildCompletionResult     `json:"result,omitempty"`
    NextChild        NextChildInfo             `json:"nextChild,omitempty"`
    Wake             WakeDeliveryInstruction   `json:"wake"`
    ActionCard       *ManagerActionCard        `json:"actionCard,omitempty"`
    TerminalEvidence *AssistantTerminalEvidence `json:"terminalEvidence,omitempty"`
    Normalizations   []ResultNormalization     `json:"normalizations,omitempty"`
    Reason           string                    `json:"reason,omitempty"`
    Attempt          int                       `json:"attempt,omitempty"`
    RetryLimit       int                       `json:"retryLimit,omitempty"`
}

type ActiveChildHealth struct {
    Status           ActiveChildHealthStatus    `json:"status"`
    ChildID          string                     `json:"childId,omitempty"`
    Stage            string                     `json:"stage,omitempty"`
    PaneID           string                     `json:"paneId,omitempty"`
    OutputPath       string                     `json:"outputPath,omitempty"`
    StatusPath       string                     `json:"statusPath,omitempty"`
    DonePath         string                     `json:"donePath,omitempty"`
    SessionDir       string                     `json:"sessionDir,omitempty"`
    SessionPath      string                     `json:"sessionPath,omitempty"`
    TerminalEvidence *AssistantTerminalEvidence `json:"terminalEvidence,omitempty"`
    ExitCode         *int                       `json:"exitCode,omitempty"`
    OutputTail       []string                   `json:"outputTail,omitempty"`
    Evidence         []string                   `json:"evidence,omitempty"`
    SafeCommand      string                     `json:"safeCommand,omitempty"`
}
```

```go
const ActiveChildProviderContextError ActiveChildHealthStatus = "provider_context_error"

func LatestTerminalEvidenceForActiveChild(state ManagerState) (AssistantTerminalEvidence, bool, error)
func IsRecoverableNoResultChild(health ActiveChildHealth) bool
func IsTerminalProviderContextError(health ActiveChildHealth) bool
```

```go
type RecoverSummaryOptions struct {
    StateFile   string
    SessionFile string
    Stage       string
    Output      string
    PiBinary    string
    DryRun      bool
}

type RecoverySummaryRequest struct {
    StateFile        string
    PlanDir          string
    ImplementationCwd string
    Stage            string
    ChildID          string
    SessionFile      string
    Evidence         AssistantTerminalEvidence
    LatestArtifact   string
}

func RunRecoverSummary(ctx context.Context, opts RecoverSummaryOptions, d deps, out io.Writer) error
func WriteRecoverySummaryPrompt(req RecoverySummaryRequest, promptPath string) error
func RecoverySummaryPath(planDir, stage, childID string, now time.Time) string
```

## Database Schema

Not applicable. Runtime state JSON only.

## Package / File Structure

- `cmd/vamos-runtime/internal/qrspicmd/session_result.go` — JSONL terminal evidence parser.
- `cmd/vamos-runtime/internal/qrspicmd/child_health.go` — latest-evidence health precedence.
- `cmd/vamos-runtime/internal/qrspicmd/root.go` — `child-complete`, delivery IDs, wake/action card payload.
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` — inspect/latest-session/recovery integration.
- `cmd/vamos-runtime/internal/qrspicmd/recovery_summary.go` (new) — optional summarizer command.
- `cmd/vamos-runtime/internal/qrspicmd/*_test.go` — parser, health, completion, delivery, recovery-summary fixtures.
- `docs/q-manager.md` — operational command/update notes if command surface changes.

## API Surface

```go
func newRecoverSummaryCommand(d deps) *cobra.Command
func RunRecoverSummary(ctx context.Context, opts RecoverSummaryOptions, d deps, out io.Writer) error
```

```text
vamos qrspi recover-summary \
  --state-file <state.json> \
  --session-file <child.jsonl> \
  --stage <node> \
  [--dry-run] \
  [--output json]
```

## Slices

### Slice 1: Terminal evidence parser

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/session_result.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go` (modify)

```go
func LatestAssistantTerminalEvidence(path string) (AssistantTerminalEvidence, bool, error)
func IsContextWindowErrorMessage(message string) bool
func terminalEvidenceID(e AssistantTerminalEvidence) string
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestLatestAssistantTerminalEvidence|TestIsContextWindowErrorMessage'`; fixture with `content: []`, `stopReason:"error"`, Codex `errorMessage` returns context evidence and stable ID.

### Slice 2: Shared health/latest-session precedence

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/child_health.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go` (modify)

```go
func LatestTerminalEvidenceForActiveChild(state ManagerState) (AssistantTerminalEvidence, bool, error)
func InspectActiveChildHealth(ctx context.Context, state ManagerState, stateFile string, d deps) (ActiveChildHealth, error)
func IsTerminalProviderContextError(health ActiveChildHealth) bool
```

**Behavior:** latest provider context-window error wins before `ChildHasQRSPIResult`; `inspect --sessions --latest`, `continue`, `validate-latest --apply-rebind` with or without `--continue`, and `recover-manual --mode latest-session --continue` see same terminal provider/context state.

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestInspectActiveChildHealth.*ProviderContext|TestValidateLatest.*ProviderContext|TestRunContinue.*Context'`; old result + later error => provider/context health, direct `validate-latest` does not accept stale result, and no graph advance.

### Slice 3: child-complete recovery wake + delivery identity

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (modify)

```go
func childCompletionStatusFromTerminalEvidence(state ManagerState, child ChildRunRef, evidence AssistantTerminalEvidence) ChildCompletionStatus
func childCompletionDeliveryIDForTerminalEvidence(child ChildRunRef, evidence AssistantTerminalEvidence) string
func childCompletionWakePayload(stateFile string, state ManagerState, status ChildCompletionStatus) string
func BuildChildContextExhaustedCard(health ActiveChildHealth, state ManagerState, stateFile string) *ManagerActionCard
```

**Behavior:** `RunChildComplete` bounded-rechecks latest session evidence before parsing stale QRSPI text. Context-window provider error writes `validated=false`, `managerNeeded=true`, `result.status=child_context_exhausted`, `TerminalEvidence`, `LastActionCard`, validation status, and wake. Delivery ID shape: `childID:generation:provider_context_error:evidenceID`.

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestRunChildComplete.*ProviderContext|TestQueueOrDeliverWake.*ProviderContext'`; same child/generation old blocked delivery + later provider error delivers once, repeated same evidence suppresses duplicate.

### Slice 4: Action-card evidence and recovery commands

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `docs/q-manager.md` (modify if command text changes)

```go
func providerContextEvidenceLines(e AssistantTerminalEvidence) []string
func providerContextRecoverySafeCommand(stateFile string) string
func providerContextRecoveryContinueCommand(stateFile string) string
```

**Behavior:** action card/wake includes child ID, stage, pane when known, session path/session ID, line/timestamp/evidence ID, provider error, last known artifact/result when available, inspect command, latest-session continue command, and optional `recover-summary` command. No fake `qrspi_result`.

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestRunContinueWritesChildContextExhaustedCard|TestRunInspect.*ProviderContext'`; output contains session path, provider message, evidence ID, inspect command, continue command.

### Slice 5: Optional recovery summarizer helper

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/recovery_summary.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify command registration)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/recovery_summary_test.go` (new)

```go
func RunRecoverSummary(ctx context.Context, opts RecoverSummaryOptions, d deps, out io.Writer) error
func WriteRecoverySummaryPrompt(req RecoverySummaryRequest, promptPath string) error
func RecoverySummaryPath(planDir, stage, childID string, now time.Time) string
```

**Behavior:** command writes/launches a fresh read-only summarizer prompt using failed session tail, validation status, active child metadata, and latest artifact refs. Output note path: `context/recovery/YYYY-MM-DD_HH-MM-SS_<stage>_<child-id>_context-recovery.md`. Helper never emits `qrspi_result`, never advances graph, and default command can be dry-run/tested without Pi.

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestRunRecoverSummary'`; dry-run creates prompt/note target under plan `context/recovery/`, contains same-node relaunch instructions and no `qrspi_result`.

### Slice 6: Focused regression and manual smoke

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `docs/q-manager.md` (modify if recovery command added)

```go
func writeSessionWithBlockedResultThenProviderError(t *testing.T, dir string) string
func assertProviderContextRecoveryStatus(t *testing.T, status ChildCompletionStatus)
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd`; manual smoke with copied failed JSONL fixture confirms `inspect --sessions --latest`, `validate-latest --apply-rebind`, `child-complete`, and `continue` surface provider context recovery and do not advance graph.

## Out of Scope

- No parent manager compaction changes.
- No fake durable QRSPI result after provider failure.
- No required same-child steering generation change.
- No dependency on proactive child compaction for correctness.
- No host-private paths/domains in reusable runtime code.
- No DB/schema migration.
