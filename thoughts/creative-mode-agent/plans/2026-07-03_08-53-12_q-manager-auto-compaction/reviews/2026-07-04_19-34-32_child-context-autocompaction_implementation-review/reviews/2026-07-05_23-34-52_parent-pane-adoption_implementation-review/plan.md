---
date: 2026-07-06T00:11:58-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 424859bd6e6b79a07d290f1ed49799d913fa9c8e
branch: creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes
repository: vamos
stage: plan
ticket: 'implementation-review follow-up: parent pane adoption'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
project: github.com/CoreyCole/vamos
related_projects: []
---

# Implementation Plan: q-manager parent pane adoption

## Status

- [ ] Slice 1: Shared adoption helper + action cards
- [ ] Slice 2: Continue and state-file start-next adoption
- [ ] Slice 3: Manager-ready adoption + dead-pane wake queue
- [ ] Slice 4: Regression docs and full qrspicmd verification

## Implementation Workspace Prep

This is an implementation-review follow-up plan. The implementation workspace already exists and must be reused:

```text
/home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction
```

Plan workspace:

```text
/home/ruby/dotfiles/thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review
```

Do not create a new implementation workspace for this nested `reviews/*_implementation-review/` follow-up. After `/q-review [plan.md]` succeeds, route directly to `/q-implement [plan.md]` in the existing implementation workspace recorded above. If `/q-workspace` is accidentally invoked by runtime/human tooling, it must confirm/reuse this same workspace and must not reset the repo to trunk or overwrite a dirty checkout.

Workspace invariants:

- Implementation happens in a normal copied filesystem workspace, never a git worktree.
- `/q-plan` does not create, move, or clean workspace directories.
- `/q-workspace`, if used for recovery only, must stop before replacing/moving any dirty existing workspace and must preserve an explicit backup name if a human asks to move it aside.
- The full plan dir must remain present at the same relative `thoughts/...` path inside the workspace so `/q-implement` can load `AGENTS.md`, ADRs, design, outline, plan, reviews, questions, and research.
- This repo uses Graphite slice branches. Implement and verify each tracked edit slice first, then run `gt create ..._review_plan_slice-N` or `gt modify` at the end of the slice with the final conventional commit message. Do not pre-create future slice branches.

Same-workspace command template after plan review:

```bash
# from /home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction
/q-implement thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/plan.md
```

## Repository Submission Model

Vamos feature work uses the prepared implementation workspace plus Graphite slice branches. For this review-fix follow-up, stack branches on the current implementation workspace branch `creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review-fixes`. Each slice with tracked edits gets one Graphite commit after code and tests for that slice pass. Commit messages must use Conventional Commits plus the fenced `qrspi_commit` footer shown in each slice.

______________________________________________________________________

## Slice 1: Shared adoption helper + action cards

### Files

- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify action constants)
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go` (new)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Add action constants beside existing `ActionChildContextExhausted`:

```go
ActionManagerPaneAdoptionRequired = "manager_pane_adoption_required"
ActionManagerPaneUnavailable      = "manager_pane_unavailable"
```

**`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go`** (new):

```go
package qrspicmd

import (
    "context"
    "fmt"
    "strings"
)

type ManagerPaneAdoptionCommand string

const (
    ManagerPaneAdoptionStartNext    ManagerPaneAdoptionCommand = "start-next"
    ManagerPaneAdoptionContinue     ManagerPaneAdoptionCommand = "continue"
    ManagerPaneAdoptionManagerReady ManagerPaneAdoptionCommand = "manager-ready"
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

func ResolveManagerPaneAdoption(ctx context.Context, state ManagerState, opts ManagerPaneAdoptionOptions, d deps) (ManagerPaneAdoptionResult, error) {
    opts.StateFile = strings.TrimSpace(opts.StateFile)
    opts.ExplicitPane = strings.TrimSpace(opts.ExplicitPane)
    opts.CurrentPane = strings.TrimSpace(opts.CurrentPane)

    result := ManagerPaneAdoptionResult{State: state}
    stored := strings.TrimSpace(state.ManagerPaneID)
    delivery := strings.TrimSpace(state.Delivery.ManagerPaneID)
    selected := firstNonEmpty(delivery, stored)
    selectedLive := managerPaneLiveness(ctx, selected, d)
    storedLive := managerPaneLiveness(ctx, stored, d)
    deliveryLive := managerPaneLiveness(ctx, delivery, d)
    currentLive := managerPaneLiveness(ctx, opts.CurrentPane, d)
    result.Evidence = managerPaneEvidence(state, opts, storedLive, deliveryLive, currentLive)

    if opts.ExplicitPane != "" {
        result.State.ManagerPaneID = opts.ExplicitPane
        if shouldRebindDeliveryPane(state, opts.ExplicitPane, true, selectedLive) {
            result.State.Delivery.ManagerPaneID = opts.ExplicitPane
        }
        result.Changed = result.State.ManagerPaneID != state.ManagerPaneID || result.State.Delivery.ManagerPaneID != state.Delivery.ManagerPaneID
        result.AdoptedPane = opts.ExplicitPane
        result.Reason = "explicit_manager_pane"
        result.Evidence = append(result.Evidence, "adoption: explicit --manager-pane")
        return result, nil
    }

    if opts.CurrentPane == "" {
        result.Reason = "no_current_manager_pane"
        return result, nil
    }
    if currentLive.Checked && !currentLive.Exists {
        result.Reason = "current_manager_pane_unavailable"
        result.Evidence = append(result.Evidence, "adoption: current TMUX_PANE unavailable; not adopted")
        return result, nil
    }
    if selected != "" && selected == opts.CurrentPane {
        if state.ManagerPaneID == "" {
            result.State.ManagerPaneID = opts.CurrentPane
            result.Changed = true
        }
        if shouldRebindDeliveryPane(state, opts.CurrentPane, false, selectedLive) && state.Delivery.ManagerPaneID != opts.CurrentPane {
            result.State.Delivery.ManagerPaneID = opts.CurrentPane
            result.Changed = true
        }
        result.AdoptedPane = opts.CurrentPane
        result.Reason = "current_matches_manager_pane"
        return result, nil
    }
    if selected != "" && selectedLive.Exists {
        result.ActionCard = buildManagerPaneActionCard(state, opts, result.Evidence, ActionManagerPaneAdoptionRequired)
        result.Reason = "live_manager_pane_conflict"
        return result, nil
    }
    if managerPaneAutoAdoptionAllowed(state, selectedLive) {
        result.State.ManagerPaneID = opts.CurrentPane
        if shouldRebindDeliveryPane(state, opts.CurrentPane, false, selectedLive) {
            result.State.Delivery.ManagerPaneID = opts.CurrentPane
        }
        result.Changed = result.State.ManagerPaneID != state.ManagerPaneID || result.State.Delivery.ManagerPaneID != state.Delivery.ManagerPaneID
        result.AdoptedPane = opts.CurrentPane
        result.Reason = "safe_current_pane_adoption"
        result.Evidence = append(result.Evidence, "adoption: safe current TMUX_PANE")
        return result, nil
    }
    return result, nil
}

func managerPaneAutoAdoptionAllowed(state ManagerState, selected PaneLiveness) bool {
    if !selected.Checked || strings.TrimSpace(selected.PaneID) == "" || !selected.Exists {
        return true
    }
    if strings.EqualFold(state.Delivery.Status, "compacting") && !selected.Exists {
        return true
    }
    if state.Delivery.QueuedWake != nil && !selected.Exists {
        return true
    }
    return false
}

func shouldRebindDeliveryPane(state ManagerState, adoptedPane string, explicit bool, selected PaneLiveness) bool {
    if strings.TrimSpace(adoptedPane) == "" {
        return false
    }
    if explicit {
        return true
    }
    if strings.TrimSpace(state.Delivery.ManagerPaneID) == "" {
        return true
    }
    if strings.EqualFold(state.Delivery.Status, "compacting") || state.Delivery.QueuedWake != nil {
        return true
    }
    return selected.Checked && strings.TrimSpace(selected.PaneID) == strings.TrimSpace(state.Delivery.ManagerPaneID) && !selected.Exists
}

func managerPaneLiveness(ctx context.Context, pane string, d deps) PaneLiveness {
    pane = strings.TrimSpace(pane)
    live := PaneLiveness{PaneID: pane}
    if pane == "" {
        return live
    }
    live.Checked = true
    ok, err := tmuxClient(d).PaneExists(ctx, TmuxPane{ID: pane})
    live.Exists = ok && err == nil
    if err != nil {
        live.Error = err.Error()
    }
    return live
}

func buildManagerPaneActionCard(state ManagerState, opts ManagerPaneAdoptionOptions, evidence []string, kind string) *ManagerActionCard {
    summary := "q-manager parent pane adoption needs explicit operator intent"
    recommended := "rerun from the intended parent tmux pane with --manager-pane"
    if kind == ActionManagerPaneUnavailable {
        summary = "q-manager manager pane unavailable; wake queued for explicit parent recovery"
        recommended = "run manager-ready from the intended parent tmux pane"
    }
    return &ManagerActionCard{
        Kind:              kind,
        Severity:          "warning",
        Summary:           summary,
        Evidence:          evidence,
        RecommendedAction: recommended,
        SafeCommand:       managerPaneSafeCommand(opts),
        ContinueCommand:   continueCommand(opts.StateFile),
        RequiresHuman:     false,
    }
}

func managerPaneSafeCommand(opts ManagerPaneAdoptionOptions) string {
    stateFile := strings.TrimSpace(opts.StateFile)
    switch opts.Command {
    case ManagerPaneAdoptionStartNext:
        return fmt.Sprintf("vamos qrspi start-next --state-file %s --manager-pane \"$TMUX_PANE\"", stateFile)
    case ManagerPaneAdoptionManagerReady:
        return fmt.Sprintf("vamos qrspi manager-ready --state-file %s --manager-pane \"$TMUX_PANE\"", stateFile)
    default:
        return fmt.Sprintf("vamos qrspi continue --state-file %s --manager-pane \"$TMUX_PANE\"", stateFile)
    }
}

func managerPaneEvidence(state ManagerState, opts ManagerPaneAdoptionOptions, stored, delivery, current PaneLiveness) []string {
    evidence := []string{
        fmt.Sprintf("state file: %s", opts.StateFile),
        fmt.Sprintf("command: %s", opts.Command),
        fmt.Sprintf("stored manager pane: %s", firstNonEmpty(state.ManagerPaneID, "<empty>")),
        fmt.Sprintf("delivery manager pane: %s", firstNonEmpty(state.Delivery.ManagerPaneID, "<empty>")),
        fmt.Sprintf("current TMUX_PANE: %s", firstNonEmpty(opts.CurrentPane, "<empty>")),
        fmt.Sprintf("delivery status: %s", firstNonEmpty(state.Delivery.Status, "<empty>")),
        fmt.Sprintf("queued wake: %t", state.Delivery.QueuedWake != nil),
    }
    for _, live := range []PaneLiveness{stored, delivery, current} {
        if live.Checked {
            line := fmt.Sprintf("pane liveness: %s exists=%t", live.PaneID, live.Exists)
            if live.Error != "" {
                line += " error=" + live.Error
            }
            evidence = append(evidence, line)
        }
    }
    return evidence
}
```

Implementation notes:

- Keep helper in package `qrspicmd` so tests can call unexported helpers.
- Use existing `tmuxClient(d)` helper rather than directly reading `d.Tmux`.
- Keep auto-adoption conservative: if the current env pane is unavailable, do not adopt it; if a different selected old manager/delivery pane is live and no explicit pane is provided, return action card instead of rebinding.
- Pane IDs stay local state/action-card evidence only; do not add them to `qrspi_result` YAML.

### Tests

**`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`**:

Add focused helper tests using existing `recordingTmux` from `reprompt_test.go`:

```go
func TestManagerPaneAdoptionExplicitRebindsLiveDifferentParent(t *testing.T) {
    state := ManagerState{ManagerPaneID: "%old", Delivery: ManagerDeliveryState{ManagerPaneID: "%old"}}
    got, err := ResolveManagerPaneAdoption(t.Context(), state, ManagerPaneAdoptionOptions{StateFile: "state.json", Command: ManagerPaneAdoptionContinue, ExplicitPane: "%new", CurrentPane: "%env"}, deps{Tmux: &recordingTmux{}})
    if err != nil { t.Fatal(err) }
    if got.ActionCard != nil || !got.Changed || got.State.ManagerPaneID != "%new" || got.State.Delivery.ManagerPaneID != "%new" || got.Reason != "explicit_manager_pane" {
        t.Fatalf("adoption = %+v", got)
    }
}

func TestManagerPaneAdoptionCurrentPaneWhenStoredBlank(t *testing.T) {
    got, err := ResolveManagerPaneAdoption(t.Context(), ManagerState{}, ManagerPaneAdoptionOptions{StateFile: "state.json", Command: ManagerPaneAdoptionContinue, CurrentPane: "%parent"}, deps{Tmux: &recordingTmux{}})
    if err != nil { t.Fatal(err) }
    if !got.Changed || got.State.ManagerPaneID != "%parent" || got.ActionCard != nil {
        t.Fatalf("adoption = %+v", got)
    }
}

func TestManagerPaneAdoptionCurrentPaneWhenStoredDead(t *testing.T) {
    state := ManagerState{ManagerPaneID: "%dead", Delivery: ManagerDeliveryState{ManagerPaneID: "%dead"}}
    tmux := &recordingTmux{missingPanes: map[string]bool{"%dead": true}}
    got, err := ResolveManagerPaneAdoption(t.Context(), state, ManagerPaneAdoptionOptions{StateFile: "state.json", Command: ManagerPaneAdoptionStartNext, CurrentPane: "%new"}, deps{Tmux: tmux})
    if err != nil { t.Fatal(err) }
    if !got.Changed || got.State.ManagerPaneID != "%new" || got.State.Delivery.ManagerPaneID != "%new" {
        t.Fatalf("adoption = %+v", got)
    }
}

func TestManagerPaneAdoptionLiveConflictRequiresExplicitPane(t *testing.T) {
    state := ManagerState{ManagerPaneID: "%old", Delivery: ManagerDeliveryState{ManagerPaneID: "%old"}}
    got, err := ResolveManagerPaneAdoption(t.Context(), state, ManagerPaneAdoptionOptions{StateFile: "state.json", Command: ManagerPaneAdoptionContinue, CurrentPane: "%new"}, deps{Tmux: &recordingTmux{}})
    if err != nil { t.Fatal(err) }
    if got.Changed || got.ActionCard == nil || got.ActionCard.Kind != ActionManagerPaneAdoptionRequired || !strings.Contains(got.ActionCard.SafeCommand, "continue --state-file state.json --manager-pane") {
        t.Fatalf("adoption = %+v", got)
    }
}

func TestManagerPaneAdoptionDoesNotAdoptUnavailableCurrentPane(t *testing.T) {
    tmux := &recordingTmux{missingPanes: map[string]bool{"%new": true}}
    got, err := ResolveManagerPaneAdoption(t.Context(), ManagerState{}, ManagerPaneAdoptionOptions{StateFile: "state.json", Command: ManagerPaneAdoptionContinue, CurrentPane: "%new"}, deps{Tmux: tmux})
    if err != nil { t.Fatal(err) }
    if got.Changed || got.State.ManagerPaneID != "" || got.Reason != "current_manager_pane_unavailable" {
        t.Fatalf("adoption = %+v", got)
    }
}
```

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManagerPaneAdoption'
```

### Commit Message

`feat(qrspi): add q-manager pane adoption helper`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review"
  stage: "implement"
  slice: "1"
  summary: "Add shared manager-pane adoption decisions and action-card helpers."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 2: Continue and state-file start-next adoption

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go`
- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/start_next_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Add the `ManagerPane` field to `ContinueOptions`:

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

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

Add the CLI flag in `newContinueCommand` beside the existing model/split flags:

```go
cmd.Flags().StringVar(&opts.ManagerPane, "manager-pane", "", "tmux pane ID for the parent q-manager session")
```

Add a small command integration helper near other manager helpers:

```go
func applyManagerPaneAdoption(
    ctx context.Context,
    stateFile string,
    state ManagerState,
    opts ManagerPaneAdoptionOptions,
    store StateStore,
    d deps,
    out io.Writer,
    output string,
) (ManagerState, bool, error) {
    opts.StateFile = stateFile
    adoption, err := ResolveManagerPaneAdoption(ctx, state, opts, d)
    if err != nil {
        return state, false, err
    }
    state = adoption.State
    if adoption.ActionCard != nil {
        state.LastActionCard = adoption.ActionCard
        if err := store.Save(stateFile, state); err != nil {
            return state, true, err
        }
        return state, true, writeManagerActionCard(out, *adoption.ActionCard, output)
    }
    if adoption.Changed {
        if err := store.Save(stateFile, state); err != nil {
            return state, false, err
        }
    }
    return state, false, nil
}
```

Integrate it in `RunStartNext` immediately after `resolveOrInitStartState` and before state-file preflight/active-child checks:

```go
state, stateFile, err := resolveOrInitStartState(ctx, opts, d)
if err != nil { return nil, err }
store := stateStore(d, "", clock)
if strings.TrimSpace(opts.StateFile) != "" {
    var stopped bool
    state, stopped, err = applyManagerPaneAdoption(ctx, stateFile, state, ManagerPaneAdoptionOptions{
        Command:      ManagerPaneAdoptionStartNext,
        ExplicitPane: opts.ManagerPane,
        CurrentPane:  CaptureManagerPaneID(""),
    }, store, d, out, opts.Output)
    if err != nil { return nil, err }
    if stopped { return nil, nil }
}
```

Then keep preflight using the updated `state.ManagerPaneID`:

```go
PreflightOptions{StateFile: stateFile, ManagerPaneID: state.ManagerPaneID, UsesExtension: true}
```

Remove the later duplicate `store := stateStore(...)` declaration if needed; use the one created before adoption.

Integrate in `RunContinue` after state load / `PiModel` update / default `PlanDir` resolution and before the `state.ActiveChild == nil` check:

```go
state, stopped, err := applyManagerPaneAdoption(ctx, opts.StateFile, state, ManagerPaneAdoptionOptions{
    Command:      ManagerPaneAdoptionContinue,
    ExplicitPane: opts.ManagerPane,
    CurrentPane:  CaptureManagerPaneID(""),
}, store, d, out, opts.Output)
if err != nil { return err }
if stopped { return nil }
```

When `startNextChildFromDecision` calls `RunChild`, pass the explicit manager pane through as a belt-and-suspenders launch hint while relying on saved state for normal behavior:

```go
ManagerPane: opts.ManagerPane,
```

Do the same in `RunStartNext`'s direct `RunChild` call:

```go
ManagerPane: opts.ManagerPane,
```

This is safe because explicit `--manager-pane` now means operator rebind intent, and blank preserves the stored-state behavior.

### Tests

Add command integration tests.

**`cmd/vamos-runtime/internal/qrspicmd/start_next_test.go`**:

```go
func TestStartNextStateFileManagerPaneRebindsBeforeLaunch(t *testing.T) {
    fixture := newManagerFlowFixture(t)
    stateFile := filepath.Join(fixture.stateRoot, "state.json")
    saveManagerState(t, stateFile, ManagerState{
        RepoID: fixture.projectRoot, CanonicalPlanDir: fixture.planDir, SourceCwd: fixture.projectRoot,
        ManagerPaneID: "%old",
        Workflow: testWorkflowState(t, qrspi.NodeResearch, nil),
    })
    runner := &fakeChildRunner{panes: []string{"%child"}}
    result, err := RunStartNext(t.Context(), StartNextOptions{StateFile: stateFile, ManagerPane: "%new"}, deps{Clock: fixture.clock, Runner: runner, Tmux: &recordingTmux{}}, &bytes.Buffer{})
    if err != nil { t.Fatalf("RunStartNext error = %v", err) }
    if result.ActiveChild == nil || len(runner.started) != 1 || runner.started[0].ParentPaneID != "%new" {
        t.Fatalf("result=%+v started=%+v", result, runner.started)
    }
    loaded := loadManagerState(t, stateFile)
    if loaded.ManagerPaneID != "%new" || loaded.Delivery.ManagerPaneID != "%new" {
        t.Fatalf("loaded = %+v", loaded)
    }
}
```

**`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`**:

Add continue path tests. Use existing helpers (`writePiSession`, `testResultYAML`, `testWorkflowState`) to create a valid completed active child.

```go
func TestContinueManagerPaneRebindsBeforeNextChildLaunch(t *testing.T) {
    fixture := newManagerFlowFixture(t)
    stateFile := filepath.Join(fixture.stateRoot, "state.json")
    sessionDir := filepath.Join(fixture.dir, "sessions")
    sessionPath := writePiSession(t, sessionDir, "session.jsonl", "session-1", fixture.projectRoot, assistantLine(testResultYAML("question", "complete", "complete", "thoughts/example/questions/q.md", "")))
    saveManagerState(t, stateFile, ManagerState{
        RepoID: fixture.projectRoot, CanonicalPlanDir: fixture.planDir, SourceCwd: fixture.projectRoot,
        ManagerPaneID: "%old",
        Workflow: testWorkflowState(t, qrspi.NodeQuestion, nil),
        ActiveChild: &ChildRunRef{ID: "child-1", Stage: "question", Cwd: fixture.projectRoot, SessionID: "session-1", SessionDir: sessionDir, SessionPath: sessionPath, ValidationStatusPath: filepath.Join(fixture.dir, "validation.json"), LifecycleStatus: "completed", Generation: 1},
    })
    runner := &fakeChildRunner{panes: []string{"%research"}}
    err := RunContinue(t.Context(), ContinueOptions{StateFile: stateFile, ManagerPane: "%new"}, deps{Clock: fixture.clock, Runner: runner, Tmux: &recordingTmux{}}, &strings.Builder{})
    if err != nil { t.Fatalf("RunContinue error = %v", err) }
    if len(runner.started) != 1 || runner.started[0].ParentPaneID != "%new" {
        t.Fatalf("started = %+v", runner.started)
    }
    loaded := loadManagerState(t, stateFile)
    if loaded.ManagerPaneID != "%new" {
        t.Fatalf("loaded = %+v", loaded)
    }
}

func TestContinueCurrentPaneLiveConflictWritesActionCard(t *testing.T) {
    fixture := newManagerFlowFixture(t)
    stateFile := filepath.Join(fixture.stateRoot, "state.json")
    saveManagerState(t, stateFile, ManagerState{
        RepoID: fixture.projectRoot, CanonicalPlanDir: fixture.planDir, SourceCwd: fixture.projectRoot,
        ManagerPaneID: "%old",
        Workflow: testWorkflowState(t, qrspi.NodeQuestion, nil),
        ActiveChild: &ChildRunRef{ID: "child-1", Stage: "question", Cwd: fixture.projectRoot},
    })
    t.Setenv("TMUX_PANE", "%new")
    err := RunContinue(t.Context(), ContinueOptions{StateFile: stateFile}, deps{Clock: fixture.clock, Tmux: &recordingTmux{}}, &strings.Builder{})
    if err != nil { t.Fatalf("RunContinue error = %v", err) }
    loaded := loadManagerState(t, stateFile)
    if loaded.LastActionCard == nil || loaded.LastActionCard.Kind != ActionManagerPaneAdoptionRequired || loaded.ManagerPaneID != "%old" {
        t.Fatalf("loaded = %+v", loaded)
    }
}
```

Also add a test for env-only dead-pane adoption in either helper or command path:

```go
func TestStartNextCurrentPaneAdoptsDeadStoredPane(t *testing.T) { ... t.Setenv("TMUX_PANE", "%new"); deps{Tmux: &recordingTmux{missingPanes: map[string]bool{"%old": true}}, Runner: runner} ... }
```

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'Test(StartNext.*ManagerPane|Continue.*ManagerPane|ManagerPaneAdoption)'
```

### Commit Message

`feat(qrspi): adopt q-manager pane from continue and start-next`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review"
  stage: "implement"
  slice: "2"
  summary: "Wire manager-pane adoption into continue and state-file start-next."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 3: Manager-ready adoption + dead-pane wake queue

### Files

- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` (only if existing compaction assertions need output updates)
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

Refactor queue creation into a helper near `queueOrDeliverWake`:

```go
func queueManagerWake(state ManagerState, status ChildCompletionStatus, payload, reason string) ManagerState {
    state.Delivery.QueuedWake = &QueuedWake{
        DeliveryID:      status.DeliveryID,
        ChildID:         status.ChildID,
        ChildGeneration: activeChildGeneration(state),
        Payload:         payload,
        QueuedAt:        time.Now().Format(time.RFC3339),
    }
    return state
}
```

Replace the two inline queued-wake assignments in `queueOrDeliverWake` with `queueManagerWake(...)`.

Before `pasteWake`, add pane liveness check and queue unavailable manager wakes:

```go
paneID := managerDeliveryPane(state)
if paneID == "" {
    state = queueManagerWake(state, status, payload, "manager_pane_missing")
    return state, WakeDeliveryInstruction{Mode: "queue", Payload: payload, Reason: "manager_pane_missing"}, nil
}
if live := managerPaneLiveness(ctx, paneID, d); live.Checked && !live.Exists {
    evidence := managerPaneEvidence(state, ManagerPaneAdoptionOptions{StateFile: stateFile, Command: ManagerPaneAdoptionManagerReady}, managerPaneLiveness(ctx, state.ManagerPaneID, d), managerPaneLiveness(ctx, state.Delivery.ManagerPaneID, d), PaneLiveness{})
    evidence = append(evidence, fmt.Sprintf("selected manager pane unavailable: %s", paneID))
    state = queueManagerWake(state, status, payload, "manager_pane_unavailable")
    state.LastActionCard = buildManagerPaneActionCard(state, ManagerPaneAdoptionOptions{StateFile: stateFile, Command: ManagerPaneAdoptionManagerReady}, evidence, ActionManagerPaneUnavailable)
    return state, WakeDeliveryInstruction{Mode: "queue", Payload: payload, Reason: "manager_pane_unavailable"}, nil
}
if err := pasteWake(ctx, d, paneID, payload); err != nil { ... }
```

Important: do not call `CaptureManagerPaneID("")` in `queueOrDeliverWake`; `child-complete` may be running from a child-side process and must not infer parent pane from that environment.

Refactor `RunManagerReady` to use the shared adoption helper before clearing `Delivery.Status` to ready:

```go
state, stopped, err := applyManagerPaneAdoption(ctx, opts.StateFile, state, ManagerPaneAdoptionOptions{
    Command:      ManagerPaneAdoptionManagerReady,
    ExplicitPane: opts.ManagerPane,
    CurrentPane:  CaptureManagerPaneID(""),
}, store, d, out, opts.Output)
if err != nil { return err }
if stopped { return nil }

pane := strings.TrimSpace(opts.ManagerPane)
if pane == "" { pane = CaptureManagerPaneID("") }
if pane == "" { pane = managerDeliveryPane(state) }
state.Delivery.Status = "ready"
state, flushed, err = flushQueuedWake(ctx, state, pane, d)
```

Preserve current visible behavior:

- `manager-ready --manager-pane %new` writes both `ManagerPaneID` and `Delivery.ManagerPaneID`.
- `manager-ready` from current tmux env may auto-adopt only safe states.
- Stale queued wakes remain suppressed by `flushQueuedWake` generation checks.
- If no pane can be selected for queued wake flush, keep the existing clear error.

### Tests

**`cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`**:

Add dead-pane queue regression:

```go
func TestDeliveryQueuesWhenSelectedManagerPaneUnavailable(t *testing.T) {
    dir := t.TempDir()
    stateFile := filepath.Join(dir, "state.json")
    state := ManagerState{
        ManagerPaneID: "%dead",
        ActiveChild: &ChildRunRef{ID: "child-1", Generation: 1, LifecycleStatus: "completed"},
    }
    status := ChildCompletionStatus{
        Validated: true, ChildID: "child-1", DeliveryID: "child-1:1:plan:complete:complete:artifact",
        Result: ChildCompletionResult{Stage: "plan", Status: "complete", Outcome: "complete", Artifact: "artifact"},
    }
    tmux := &recordingTmux{missingPanes: map[string]bool{"%dead": true}}
    queued, wake, err := queueOrDeliverWake(t.Context(), stateFile, state, status, deps{Tmux: tmux})
    if err != nil { t.Fatalf("queueOrDeliverWake error = %v", err) }
    if wake.Mode != "queue" || wake.Reason != "manager_pane_unavailable" || queued.Delivery.QueuedWake == nil || len(tmux.pastes) != 0 {
        t.Fatalf("wake=%+v state=%+v pastes=%#v", wake, queued, tmux.pastes)
    }
    if queued.LastActionCard == nil || queued.LastActionCard.Kind != ActionManagerPaneUnavailable || !strings.Contains(queued.LastActionCard.SafeCommand, "manager-ready") {
        t.Fatalf("action card = %+v", queued.LastActionCard)
    }
}
```

Add manager-ready env adoption/flush test:

```go
func TestManagerReadyCurrentPaneAdoptsUnavailableDeliveryAndFlushes(t *testing.T) {
    dir := t.TempDir()
    stateFile := filepath.Join(dir, "state.json")
    saveManagerState(t, stateFile, ManagerState{
        ManagerPaneID: "%dead",
        Delivery: ManagerDeliveryState{Status: "compacting", ManagerPaneID: "%dead", QueuedWake: &QueuedWake{DeliveryID: "wake-1", ChildID: "child-1", ChildGeneration: 1, Payload: "wake"}},
        ActiveChild: &ChildRunRef{ID: "child-1", Generation: 1, LifecycleStatus: "completed"},
    })
    t.Setenv("TMUX_PANE", "%new")
    tmux := &recordingTmux{missingPanes: map[string]bool{"%dead": true}}
    if err := RunManagerReady(t.Context(), ManagerReadyOptions{StateFile: stateFile}, deps{Tmux: tmux}, &strings.Builder{}); err != nil { t.Fatal(err) }
    loaded := loadManagerState(t, stateFile)
    if loaded.ManagerPaneID != "%new" || loaded.Delivery.ManagerPaneID != "%new" || loaded.Delivery.QueuedWake != nil || loaded.Delivery.LastDeliveryID != "wake-1" {
        t.Fatalf("loaded = %+v", loaded)
    }
    if len(tmux.pastes) != 1 || tmux.pastes[0].pane.ID != "%new" {
        t.Fatalf("pastes = %#v", tmux.pastes)
    }
}
```

Re-run existing delivery and manager compaction tests. If the new liveness check changes fake behavior, keep `recordingTmux.PaneExists` returning true for any nonblank pane not listed in `missingPanes`.

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'Test(Delivery|ManagerReady|ManagerCompaction|ManagerPaneAdoption)'
```

### Commit Message

`feat(qrspi): queue wakes for unavailable manager panes`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review"
  stage: "implement"
  slice: "3"
  summary: "Share manager-ready adoption and queue dead-pane wakes with recovery evidence."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 4: Regression docs and full qrspicmd verification

### Files

- `docs/q-manager.md`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`

### Changes

**`docs/q-manager.md`**:

Update the manual tmux smoke path to document parent pane adoption/replacement:

- Keep the initial explicit parent pane command.
- Add recovery cases after the child-completion wake step:

```text
If the original parent pane was replaced or is unavailable, run the normal raw CLI recovery command from the intended new parent tmux pane:

vamos qrspi continue --state-file <state> --manager-pane "$TMUX_PANE"

If `continue` or `start-next --state-file` reports `manager_pane_adoption_required`, the stored parent pane is still live and differs from current `$TMUX_PANE`; rerun the safe command printed in the action card only from the intended parent pane.

If child completion queued a wake because the selected manager pane was unavailable, run:

vamos qrspi manager-ready --state-file <state> --manager-pane "$TMUX_PANE"

Then follow the flushed wake or run `vamos qrspi continue --state-file <state>` from that parent pane.
```

Add a compacting interaction note:

```text
Parent Pi `/q-manager` wrapper remains the preferred live path because it samples `ctx.getContextUsage()` for native compaction. Plain `vamos qrspi continue/start-next --manager-pane "$TMUX_PANE"` is the recovery/debug path and now safely adopts parent pane ownership when the stored pane is stale or explicit operator intent is supplied.
```

Do not mention local state-file IDs in durable `qrspi_result` examples.

**Tests**:

Run the whole package and add/adjust any missing assertion discovered by review:

- command registration should now include `continue --manager-pane`; existing `TestRootRegistersExpectedCommands` needs no expected command change unless flag assertions exist.
- If no test covers the live-conflict output text, assert `writeManagerActionCard` output contains `action: manager_pane_adoption_required` and `safe command: vamos qrspi continue --state-file ... --manager-pane "$TMUX_PANE"`.
- If no test covers delivery action-card output through `RunChildComplete`, add one by combining the dead-pane state from Slice 3 with `RunChildComplete` instead of direct `queueOrDeliverWake`.

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
just build --no-restart
```

If `just build --no-restart` is too broad or fails for unrelated environment setup, capture the exact failure in the implementation handoff and at minimum keep the package test green.

### Commit Message

`docs(qrspi): document q-manager parent pane recovery`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review"
  stage: "implement"
  slice: "4"
  summary: "Document and verify parent-pane adoption smoke paths."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/reviews/2026-07-05_23-34-52_parent-pane-adoption_implementation-review/plan.md"
```

______________________________________________________________________

## Final Verification Checklist

- [ ] `go test ./cmd/vamos-runtime/internal/qrspicmd`
- [ ] `just build --no-restart` or documented environment-specific blocker
- [ ] Manual/no-op CLI sanity from tmux if available:
  - [ ] `vamos qrspi continue --help` includes `--manager-pane`.
  - [ ] `vamos qrspi start-next --help` still includes `--manager-pane`.
  - [ ] `vamos qrspi manager-ready --help` still includes `--manager-pane`.
- [ ] `docs/q-manager.md` explains current-pane adoption, live-parent action card, and dead-pane queued wake.
- [ ] `plan.md` checkboxes updated as slices complete.

## ADR Traceability

- ADR `safe-current-pane-adoption`: Slices 1 and 2 add the shared helper and wire it into `continue` / state-file `start-next`; Slice 3 wires `manager-ready`.
- ADR `explicit-manager-pane-adoption-intent`: Slice 2 adds `continue --manager-pane` and makes `start-next --state-file --manager-pane` persist rebinds.
- ADR `dead-pane-wake-queues`: Slice 3 liveness-checks selected wake target and queues with action-card evidence; Slice 4 documents recovery commands.
