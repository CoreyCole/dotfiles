---
date: 2026-07-06T00:00:32-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 424859bd6e6b79a07d290f1ed49799d913fa9c8e
branch: creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes
repository: vamos
stage: outline
ticket: 'implementation-review follow-up: parent pane adoption'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
project: github.com/CoreyCole/vamos
related_projects: []
---

# Outline: q-manager parent pane adoption

## Overview

Make q-manager parent pane ownership adoptable from normal tmux CLI recovery commands. Shared helper updates local manager/delivery pane refs only for explicit `--manager-pane` or safe current-pane states; ambiguous live old parent gets action card. Product design skipped: internal runtime recovery fix, low product risk.

## Type Definitions

```go
type ManagerPaneAdoptionCommand string

const (
    ManagerPaneAdoptionStartNext    ManagerPaneAdoptionCommand = "start-next"
    ManagerPaneAdoptionContinue     ManagerPaneAdoptionCommand = "continue"
    ManagerPaneAdoptionManagerReady ManagerPaneAdoptionCommand = "manager-ready"
)

const (
    ActionManagerPaneAdoptionRequired = "manager_pane_adoption_required"
    ActionManagerPaneUnavailable      = "manager_pane_unavailable"
)

type ManagerPaneAdoptionOptions struct {
    StateFile    string
    Command      ManagerPaneAdoptionCommand
    ExplicitPane string
    CurrentPane  string
}

type PaneLiveness struct {
    PaneID  string
    Checked bool
    Exists  bool
    Error   string
}

type ManagerPaneAdoptionResult struct {
    State       ManagerState
    Changed     bool
    AdoptedPane string
    Reason      string
    Evidence    []string
    ActionCard  *ManagerActionCard
}

func ResolveManagerPaneAdoption(ctx context.Context, state ManagerState, opts ManagerPaneAdoptionOptions, d deps) (ManagerPaneAdoptionResult, error)
func managerPaneLiveness(ctx context.Context, pane string, d deps) PaneLiveness
func buildManagerPaneActionCard(state ManagerState, opts ManagerPaneAdoptionOptions, evidence []string, kind string) *ManagerActionCard
func managerPaneSafeCommand(opts ManagerPaneAdoptionOptions) string
```

```go
type ContinueOptions struct {
    StateFile   string
    PlanDir     string
    Stage       string
    Cwd         string
    Split       string
    PiModel     string
    ManagerPane string
    Timeout     time.Duration
    Output      string
    Usage       ManagerUsageInput
}
```

## State Changes

No durable QRSPI schema change. Local state only.

```go
type ManagerState struct {
    ManagerPaneID string               `json:"managerPaneId,omitempty"`
    Delivery      ManagerDeliveryState `json:"delivery,omitempty"`
    LastActionCard *ManagerActionCard  `json:"lastActionCard,omitempty"`
}

type ManagerDeliveryState struct {
    Status        string      `json:"status,omitempty"`
    ManagerPaneID string      `json:"managerPaneId,omitempty"`
    QueuedWake    *QueuedWake `json:"queuedWake,omitempty"`
}
```

## Package / File Structure

- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go` (new helper)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (command integration, delivery liveness)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (`ContinueOptions.ManagerPane`, action constants)
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go` (new helper/command tests)
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (dead-pane queue regression)
- `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go` / `manager_compaction_test.go` (existing path regressions if cleaner)
- `docs/q-manager.md` (manual recovery smoke)

## CLI Surface

```text
vamos qrspi continue --state-file <file> --manager-pane <pane>
vamos qrspi start-next --state-file <file> --manager-pane <pane>
vamos qrspi manager-ready --state-file <file> --manager-pane <pane>
```

```go
cmd.Flags().StringVar(&opts.ManagerPane, "manager-pane", "", "tmux pane ID for the parent q-manager session")
```

## Adoption Rules

```go
func ResolveManagerPaneAdoption(ctx context.Context, state ManagerState, opts ManagerPaneAdoptionOptions, d deps) (ManagerPaneAdoptionResult, error)
```

- Explicit pane: always rebind `ManagerPaneID`; also rebind `Delivery.ManagerPaneID` when delivery is compacting, queued, blank/dead, or explicit override targets delivery owner.
- Current env pane: auto-adopt only when no stored pane, selected stored/delivery pane dead/unavailable, delivery `compacting`, queued wake exists, or delivery pane missing.
- Live different stored/delivery pane + env only: no rebind; save action card with safe explicit command.
- Child-side delivery path: never adopt current env; only liveness-check selected pane and queue if unavailable.

## Slices

### Slice 1: Shared adoption helper + action card

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (action constants)
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go` (new)

```go
func ResolveManagerPaneAdoption(ctx context.Context, state ManagerState, opts ManagerPaneAdoptionOptions, d deps) (ManagerPaneAdoptionResult, error)
func managerPaneLiveness(ctx context.Context, pane string, d deps) PaneLiveness
func shouldRebindDeliveryPane(state ManagerState, adoptedPane string, explicit bool, selected PaneLiveness) bool
func buildManagerPaneActionCard(state ManagerState, opts ManagerPaneAdoptionOptions, evidence []string, kind string) *ManagerActionCard
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManagerPaneAdoption'`

### Slice 2: Continue and state-file start-next adoption

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/options.go`
- `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`

```go
func newContinueCommand(d deps) *cobra.Command
func RunContinue(ctx context.Context, opts ContinueOptions, d deps, out io.Writer) error
func RunStartNext(ctx context.Context, opts StartNextOptions, d deps, out io.Writer) (*StartNextResult, error)

func applyManagerPaneAdoption(ctx context.Context, stateFile string, state ManagerState, opts ManagerPaneAdoptionOptions, store StateStore, d deps, out io.Writer, output string) (ManagerState, bool, error)
```

**Test checkpoint:** command tests prove `continue --manager-pane` persists rebind, `start-next --state-file --manager-pane` rebinds before preflight/launch, env-only dead-pane adopts, env-only live conflict writes action card.

### Slice 3: Manager-ready shared adoption + dead-pane wake queue

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go`

```go
func RunManagerReady(ctx context.Context, opts ManagerReadyOptions, d deps, out io.Writer) error
func queueOrDeliverWake(ctx context.Context, stateFile string, state ManagerState, status ChildCompletionStatus, d deps) (ManagerState, WakeDeliveryInstruction, error)
func queueManagerWake(state ManagerState, status ChildCompletionStatus, payload string, reason string) ManagerState
func managerDeliveryPane(state ManagerState) string
```

**Test checkpoint:** dead selected pane -> `Wake.Mode="queue"`, reason `manager_pane_unavailable`, no paste, `LastActionCard.Kind=manager_pane_unavailable`; `manager-ready --manager-pane %new` flushes one current-generation wake and writes both pane refs.

### Slice 4: Regression docs and smoke commands

**Files:**

- `docs/q-manager.md`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`

```text
# old parent dead/unavailable
vamos qrspi continue --state-file <state>

# live-parent conflict / explicit adoption
vamos qrspi continue --state-file <state> --manager-pane "$TMUX_PANE"

# queued wake after compaction or dead pane
vamos qrspi manager-ready --state-file <state> --manager-pane "$TMUX_PANE"
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd` plus docs include manual parent replacement / queued wake smoke.

## Out of Scope

- Durable `qrspi_result` pane IDs or state-file refs.
- New `--force-manager-pane` / `--adopt-manager-pane` flag.
- Child-side current-pane adoption during `child-complete`.
- Pi wrapper/native compaction redesign.
- Hidden background manager runner.
