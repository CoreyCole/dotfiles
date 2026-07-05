---
date: 2026-07-04T23:45:12-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 184fa8f9f7558eaf4a29fd50c9dafcfbd5a7ac0d
branch: creative-mode-agent/q-manager-auto-compaction_review-fixes
repository: vamos
stage: plan
ticket: 'implementation review follow-up: q-manager child context exhaustion'
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Implementation Plan: q-manager child context exhaustion recovery

## Status

- [ ] Slice 1: Terminal provider evidence parser.
- [ ] Slice 2: Health/recovery latest-evidence precedence.
- [ ] Slice 3: `child-complete` provider-context wake + delivery identity.
- [ ] Slice 4: Action-card/wake evidence and docs.
- [ ] Slice 5: Optional recovery summarizer helper.
- [ ] Slice 6: Regression suite and manual smoke notes.

## Implementation Workspace Prep

This is an implementation-review follow-up plan under `reviews/*_implementation-review/`. The parent implementation workspace already exists and this follow-up must stack on the reviewed implementation head.

Planned implementation workspace path:

```text
/home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction
```

Plan workspace:

```text
/home/ruby/dotfiles/thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review
```

After `/q-review [plan.md]` succeeds, skip `/q-workspace` and run `/q-implement [plan.md]` directly in the existing implementation workspace recorded above. Do not create a new copied workspace, do not reset to trunk, and do not use `git worktree`.

The full plan directory must also exist inside the implementation workspace at the same relative `thoughts/...` path so `/q-implement` can load `AGENTS.md`, `design.md`, ADRs, `outline.md`, `plan.md`, and nested reviews. If the copy diverges, sync this plan directory into the implementation workspace before editing code.

Repository submission model: Vamos uses Graphite slice branches. Implement and verify each tracked edit slice first, then create/modify a branch at the end of the slice with a name like `creative-mode-agent/q-manager-auto-compaction_child-context-recovery_review_plan_slice-N`. Commit with the conventional message and `qrspi_commit` YAML footer from that slice. Because this is a review-fix follow-up, the first slice branch must stack on the current reviewed implementation head/branch, not `origin/main` if the parent stack is still unmerged.

Command template for the next stages:

```bash
# plan review next
/q-review thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md

# after clean review-plan, same workspace implementation
cd /home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction
/q-implement thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md
```

If the implementation workspace is dirty with unrelated changes, stop and inspect before editing. Preserve other agents' work.

______________________________________________________________________

## Slice 1: Terminal provider evidence parser

### Files

- `cmd/vamos-runtime/internal/qrspicmd/session_result.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go` (modify)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/session_result.go`**:

Add imports:

```go
import (
    "crypto/sha256"
    "encoding/hex"
    // existing imports...
)
```

Extend JSONL structs and add the evidence model:

```go
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
```

Add a latest-assistant terminal metadata parser. It must scan the whole JSONL, remember the session header ID, and return the latest assistant message that has `stopReason` or `errorMessage`. It must not change `ExtractFinalAssistantTextFromSession`; provider errors are operational evidence, not QRSPI text.

```go
func LatestAssistantTerminalEvidence(path string) (AssistantTerminalEvidence, bool, error) {
    file, err := os.Open(path)
    if err != nil {
        return AssistantTerminalEvidence{}, false, err
    }
    defer file.Close()

    sessionID := ""
    var latest AssistantTerminalEvidence
    found := false
    scanner := bufio.NewScanner(file)
    scanner.Buffer(make([]byte, 64*1024), 1024*1024)
    lineNo := 0
    for scanner.Scan() {
        lineNo++
        line := bytes.TrimSpace(scanner.Bytes())
        if len(line) == 0 {
            continue
        }
        var entry sessionEntry
        if err := json.Unmarshal(line, &entry); err != nil {
            continue
        }
        if entry.Type == "session" && strings.TrimSpace(entry.ID) != "" {
            sessionID = entry.ID
            continue
        }
        if entry.Type != "message" || entry.Message == nil || entry.Message.Role != "assistant" {
            continue
        }
        if strings.TrimSpace(entry.Message.StopReason) == "" && strings.TrimSpace(entry.Message.ErrorMessage) == "" {
            continue
        }
        evidence := AssistantTerminalEvidence{
            SessionPath:  path,
            SessionID:    sessionID,
            Line:         lineNo,
            Timestamp:    entry.Timestamp,
            StopReason:   entry.Message.StopReason,
            ErrorMessage: entry.Message.ErrorMessage,
        }
        evidence.ContextWindowError = strings.EqualFold(evidence.StopReason, "error") && IsContextWindowErrorMessage(evidence.ErrorMessage)
        evidence.EvidenceID = terminalEvidenceID(evidence)
        latest = evidence
        found = true
    }
    if err := scanner.Err(); err != nil {
        return AssistantTerminalEvidence{}, false, err
    }
    return latest, found, nil
}
```

Add context-window detection and stable evidence identity:

```go
func IsContextWindowErrorMessage(message string) bool {
    text := strings.ToLower(message)
    needles := []string{
        "context window",
        "context length",
        "context_length_exceeded",
        "maximum context",
        "context limit",
        "input exceeds",
    }
    for _, needle := range needles {
        if strings.Contains(text, needle) {
            return true
        }
    }
    return false
}

func terminalEvidenceID(e AssistantTerminalEvidence) string {
    raw := strings.Join([]string{
        strings.TrimSpace(e.SessionID),
        filepath.Clean(strings.TrimSpace(e.SessionPath)),
        fmt.Sprintf("%d", e.Line),
        strings.TrimSpace(e.Timestamp),
        strings.TrimSpace(e.StopReason),
        strings.TrimSpace(e.ErrorMessage),
    }, "\x00")
    sum := sha256.Sum256([]byte(raw))
    return hex.EncodeToString(sum[:])[:16]
}
```

**`cmd/vamos-runtime/internal/qrspicmd/session_result_test.go`**:

Add fixtures and tests:

```go
func providerContextErrorLine(message string) string {
    return fmt.Sprintf(`{"type":"message","timestamp":"2026-07-04T23:15:59.015Z","message":{"role":"assistant","content":[],"provider":"openai-codex","model":"gpt-5.5","stopReason":"error","errorMessage":%q}}`, message)
}

func TestLatestAssistantTerminalEvidenceDetectsProviderContextError(t *testing.T) {
    path := filepath.Join(t.TempDir(), "session.jsonl")
    writeSessionTestFile(t, path, strings.Join([]string{
        sessionHeader("verify-1", "/tmp/repo"),
        assistantLine("older qrspi_result"),
        providerContextErrorLine("Codex error: Your input exceeds the context window of this model. Please adjust your input and try again."),
    }, "\n")+"\n")

    got, ok, err := LatestAssistantTerminalEvidence(path)
    if err != nil || !ok {
        t.Fatalf("LatestAssistantTerminalEvidence = %+v %v %v", got, ok, err)
    }
    if got.SessionID != "verify-1" || got.Line != 3 || got.StopReason != "error" || !got.ContextWindowError || got.EvidenceID == "" {
        t.Fatalf("evidence = %+v", got)
    }
}

func TestLatestAssistantTerminalEvidenceKeepsExtractorStrict(t *testing.T) {
    path := filepath.Join(t.TempDir(), "session.jsonl")
    writeSessionTestFile(t, path, sessionHeader("s", "/tmp/repo")+"\n"+providerContextErrorLine("context window exceeded")+"\n")
    _, err := ExtractFinalAssistantTextFromSession(path)
    if err == nil || !strings.Contains(err.Error(), "no assistant text containing qrspi_result") {
        t.Fatalf("expected no result error, got %v", err)
    }
}
```

### Tests

Run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestLatestAssistantTerminalEvidence|TestIsContextWindowErrorMessage|TestExtractFinalAssistantTextFromSession'
```

### Verify

- Empty-content `stopReason:"error"` + `errorMessage` context-window fixture returns `ContextWindowError=true`.
- Existing final-QRSPI extraction tests still pass.
- Evidence ID is stable across repeated reads of the same file.

### Commit Message

Subject: `fix(qrspi): parse child provider terminal evidence`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review"
  stage: "implement"
  slice: "1"
  summary: "Add Pi JSONL terminal provider/context-window evidence parser without weakening QRSPI result extraction."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 2: Health/recovery latest-evidence precedence

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go` (modify)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Add a distinct health status and terminal evidence on health:

```go
const (
    ActiveChildRunning                 ActiveChildHealthStatus = "running"
    ActiveChildFinishedNeedsValidation ActiveChildHealthStatus = "finished_success_needs_result_validation"
    ActiveChildLaunchFailed            ActiveChildHealthStatus = "launch_failed"
    ActiveChildContextExhausted        ActiveChildHealthStatus = "context_exhausted_no_result"
    ActiveChildProviderContextError    ActiveChildHealthStatus = "provider_context_error"
    ActiveChildPaneMissing             ActiveChildHealthStatus = "pane_missing"
    ActiveChildUnknown                 ActiveChildHealthStatus = "unknown"
)

type ActiveChildHealth struct {
    Status           ActiveChildHealthStatus     `json:"status"`
    ChildID          string                      `json:"childId,omitempty"`
    Stage            string                      `json:"stage,omitempty"`
    PaneID           string                      `json:"paneId,omitempty"`
    OutputPath       string                      `json:"outputPath,omitempty"`
    StatusPath       string                      `json:"statusPath,omitempty"`
    DonePath         string                      `json:"donePath,omitempty"`
    SessionDir       string                      `json:"sessionDir,omitempty"`
    SessionPath      string                      `json:"sessionPath,omitempty"`
    TerminalEvidence *AssistantTerminalEvidence  `json:"terminalEvidence,omitempty"`
    ExitCode         *int                        `json:"exitCode,omitempty"`
    OutputTail       []string                    `json:"outputTail,omitempty"`
    Evidence         []string                    `json:"evidence,omitempty"`
    SafeCommand      string                      `json:"safeCommand,omitempty"`
}
```

**`cmd/vamos-runtime/internal/qrspicmd/child_health.go`**:

Add helpers:

```go
func LatestTerminalEvidenceForActiveChild(state ManagerState) (AssistantTerminalEvidence, bool, error) {
    if state.ActiveChild == nil {
        return AssistantTerminalEvidence{}, false, nil
    }
    path, err := resolveActiveChildSessionPath(state.ActiveChild)
    if err != nil {
        return AssistantTerminalEvidence{}, false, err
    }
    return LatestAssistantTerminalEvidence(path)
}

func IsTerminalProviderContextError(health ActiveChildHealth) bool {
    return health.Status == ActiveChildProviderContextError ||
        (health.TerminalEvidence != nil && health.TerminalEvidence.ContextWindowError)
}
```

Change `InspectActiveChildHealth` ordering:

1. Build base health, read status/output as today.
1. Resolve active child session path before calling `ChildHasQRSPIResult`.
1. Call `LatestAssistantTerminalEvidence(health.SessionPath)`.
1. If evidence has `ContextWindowError=true`, return `ActiveChildProviderContextError` before checking for older `qrspi_result`.
1. Preserve old `ActiveChildContextExhausted` path for non-provider text/output context exhaustion.

Implementation shape:

```go
if strings.TrimSpace(health.SessionPath) == "" {
    if resolved, err := resolveActiveChildSessionPath(child); err == nil {
        health.SessionPath = resolved
    }
}
if strings.TrimSpace(health.SessionPath) != "" {
    if evidence, ok, err := LatestAssistantTerminalEvidence(health.SessionPath); err == nil && ok && evidence.ContextWindowError {
        health.Status = ActiveChildProviderContextError
        health.TerminalEvidence = &evidence
        health.Evidence = append(health.Evidence, providerContextEvidenceLines(evidence)...)
        health.SafeCommand = fmt.Sprintf("vamos qrspi inspect --state-file %s --sessions --latest", stateFile)
        return health, nil
    }
}
```

Update:

```go
func IsTerminalFailedChild(health ActiveChildHealth) bool {
    return health.Status == ActiveChildLaunchFailed
}

func IsRecoverableNoResultChild(health ActiveChildHealth) bool {
    return health.Status == ActiveChildContextExhausted || health.Status == ActiveChildProviderContextError
}
```

**`cmd/vamos-runtime/internal/qrspicmd/session_recovery.go`**:

Update `RunInspect` so recoverable provider/context health prints the health safe command, not generic `continue`, and includes evidence lines in text output:

```go
if health, err := InspectActiveChildHealth(ctx, state, opts.StateFile, d); err == nil {
    fmt.Fprintf(out, "active child health: %s\n", health.Status)
    for _, line := range health.Evidence {
        fmt.Fprintf(out, "evidence: %s\n", line)
    }
    if IsTerminalFailedChild(health) || IsRecoverableNoResultChild(health) {
        failedChildSafeCommand = health.SafeCommand
    }
}
```

Update `RunValidateLatest` direct path. After `FindLatestRelevantChildSession` and optional rebind, before `ReadChildResultText`, check the candidate session:

```go
if status, handled, err := validateLatestTerminalProviderContext(ctx, opts, state, candidate, d, out); handled || err != nil {
    return err
}
```

The helper should:

- Call `LatestAssistantTerminalEvidence(candidate.SessionPath)`.
- If no context-window provider evidence, return `handled=false`.
- If evidence exists and `opts.ApplyRebind` was false while the candidate differs from active child, return the existing “rerun with --apply-rebind” safety error.
- If bound or already active, build an `ActiveChildHealth` with `ActiveChildProviderContextError`, call `BuildChildContextExhaustedCard`, save `state.LastActionCard`, and write the action card instead of parsing stale YAML.
- JSON output should include `candidate`, `terminalEvidence`, and `actionCard`.

This explicitly covers `validate-latest --apply-rebind` without `--continue`, the outline-review gap.

### Tests

**`cmd/vamos-runtime/internal/qrspicmd/child_health_test.go`**:

Add a helper fixture:

```go
func writeSessionWithBlockedResultThenProviderError(t *testing.T, path, sessionID, cwd string) {
    t.Helper()
    writeSessionTestFile(t, path, strings.Join([]string{
        sessionHeader(sessionID, cwd),
        assistantLine(testResultYAML("verify", "blocked", "", "thoughts/example/verify.md", "stale blocked")),
        providerContextErrorLine("Codex error: Your input exceeds the context window of this model. Please adjust your input and try again."),
    }, "\n")+"\n")
}
```

Add tests:

- `TestInspectActiveChildHealthProviderContextErrorOutranksOlderResult`: status/done exists, old QRSPI then provider error => `ActiveChildProviderContextError`, not `ActiveChildFinishedNeedsValidation`; `TerminalEvidence` populated.
- `TestContinueProviderContextErrorWritesActionCardWithoutAdvance`: `RunContinue` writes `action: child_context_exhausted`, includes provider message/evidence ID, and leaves workflow node unchanged.

**`cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go`**:

Add tests:

- `TestRunValidateLatestApplyRebindProviderContextErrorDoesNotAcceptStaleResult`: latest session has stale blocked result + provider error; `RunValidateLatest(... ApplyRebind:true Continue:false ...)` writes action card and does not advance workflow.
- `TestRunValidateLatestApplyRebindContinueProviderContextErrorDoesNotAdvance`: same with `Continue:true`; `RunContinue` sees provider health and stops with the same card.

### Verify

Run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestInspectActiveChildHealth.*ProviderContext|TestContinue.*ProviderContext|TestRunValidateLatest.*ProviderContext'
```

Then full package:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
```

### Commit Message

Subject: `fix(qrspi): prefer latest provider context evidence`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review"
  stage: "implement"
  slice: "2"
  summary: "Make inspect, continue, and validate-latest surface terminal provider context errors before stale QRSPI text."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 3: `child-complete` provider-context wake + delivery identity

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (modify)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Add terminal evidence to validation status:

```go
type ChildCompletionStatus struct {
    Validated        bool                       `json:"validated"`
    ManagerNeeded    bool                       `json:"managerNeeded"`
    RetryExhausted   bool                       `json:"retryExhausted"`
    ChildID          string                     `json:"childId"`
    DeliveryID       string                     `json:"deliveryId"`
    Result           ChildCompletionResult      `json:"result,omitempty"`
    NextChild        NextChildInfo              `json:"nextChild,omitempty"`
    Wake             WakeDeliveryInstruction    `json:"wake"`
    ActionCard       *ManagerActionCard         `json:"actionCard,omitempty"`
    TerminalEvidence *AssistantTerminalEvidence `json:"terminalEvidence,omitempty"`
    Normalizations   []ResultNormalization      `json:"normalizations,omitempty"`
    Reason           string                     `json:"reason,omitempty"`
    Attempt          int                        `json:"attempt,omitempty"`
    RetryLimit       int                        `json:"retryLimit,omitempty"`
}
```

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

At the start of `RunChildComplete`, before `ReadChildResultText`, check terminal provider context evidence:

```go
if evidence, ok, evidenceErr := terminalEvidenceForActiveChildWithRefresh(state); evidenceErr != nil {
    // Do not fail child-complete solely because session has not appeared yet; fall through to existing validation.
} else if ok && evidence.ContextWindowError {
    status = childCompletionStatusFromTerminalEvidence(state, *child, evidence)
    state.ActiveChild.LifecycleStatus = "awaiting_manager"
    state.ActiveChild.LastDeliveryID = status.DeliveryID
    health := ActiveChildHealth{Status: ActiveChildProviderContextError, ChildID: child.ID, Stage: child.Stage, PaneID: child.TmuxPaneID, SessionDir: child.SessionDir, SessionPath: evidence.SessionPath, TerminalEvidence: &evidence, Evidence: providerContextEvidenceLines(evidence)}
    status.ActionCard = BuildChildContextExhaustedCard(health, state, opts.StateFile)
    state.LastActionCard = status.ActionCard
    state, status.Wake, err = queueOrDeliverWake(ctx, opts.StateFile, state, status, d)
    // write validation status, save state, output as existing function does
}
```

Use a bounded refresh helper because Pi `agent_end` may fire before final assistant JSONL persistence:

```go
func terminalEvidenceForActiveChildWithRefresh(state ManagerState) (AssistantTerminalEvidence, bool, error) {
    var lastErr error
    for attempt := 0; attempt < 4; attempt++ {
        evidence, ok, err := LatestTerminalEvidenceForActiveChild(state)
        if err == nil && ok {
            return evidence, true, nil
        }
        lastErr = err
        if attempt < 3 {
            time.Sleep(100 * time.Millisecond)
        }
    }
    return AssistantTerminalEvidence{}, false, lastErr
}
```

Keep the sleep small. Tests that already have the session file return on first attempt.

Add status/delivery helpers:

```go
func childCompletionStatusFromTerminalEvidence(state ManagerState, child ChildRunRef, evidence AssistantTerminalEvidence) ChildCompletionStatus {
    status := ChildCompletionStatus{
        Validated:        false,
        ManagerNeeded:    true,
        RetryExhausted:   false,
        ChildID:          child.ID,
        DeliveryID:       childCompletionDeliveryIDForTerminalEvidence(child, evidence),
        TerminalEvidence: &evidence,
        Reason:           "provider_context_error",
        Attempt:          child.ValidationRetryCount,
        RetryLimit:       invalidResultRetryLimit(state),
        Result: ChildCompletionResult{
            Stage:          child.Stage,
            Status:         string(ActionChildContextExhausted),
            Summary:        providerContextSummary(evidence),
            StageCompleted: providerContextSummary(evidence),
        },
    }
    if prior := readPriorValidationStatus(child.ValidationStatusPath); prior != nil {
        status.Result.Artifact = prior.Result.Artifact
        status.Result.PlanGoal = prior.Result.PlanGoal
        status.Result.KeyDecisions = prior.Result.KeyDecisions
    }
    return status
}

func childCompletionDeliveryIDForTerminalEvidence(child ChildRunRef, evidence AssistantTerminalEvidence) string {
    return strings.Join([]string{child.ID, fmt.Sprintf("%d", child.Generation), "provider_context_error", evidence.EvidenceID}, ":")
}

func providerContextSummary(e AssistantTerminalEvidence) string {
    return fmt.Sprintf("child provider context-window error in %s line %d: %s", firstNonEmpty(e.SessionID, filepath.Base(e.SessionPath)), e.Line, strings.TrimSpace(e.ErrorMessage))
}
```

Add `readPriorValidationStatus(path string) *ChildCompletionStatus` as best-effort JSON decode. Use it only for context fields; never mark the new status validated and never use its delivery ID.

Update `childCompletionWakePayload` in this slice or Slice 4 so provider context statuses carry terminal evidence fields. If easier, add minimal terminal evidence now and enrich in Slice 4.

### Tests

**`cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go`**:

Add `TestChildCompleteProviderContextErrorDeliversManagerWake`:

- State has active child with generation 1, validation path, manager pane.
- Existing session contains older valid `verify blocked` result then provider context error.
- `state.Delivery.LastDeliveryID` is the old blocked delivery ID.
- `RunChildComplete` returns `Validated=false`, `ManagerNeeded=true`, `Result.Status=child_context_exhausted`, `TerminalEvidence.ContextWindowError=true`, delivery ID contains `provider_context_error`, and wake mode is `deliver` or `queue` according to manager pane/compaction.
- Disk `validation-status.json` has the same terminal evidence.
- Loaded state `LastActionCard.Kind == ActionChildContextExhausted`.

Add `TestChildCompleteProviderContextErrorSuppressesSameEvidenceDuplicate`:

- First call delivers/queues with provider evidence ID.
- Second call on unchanged session returns wake suppress `duplicate_delivery`.

**`cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`**:

Add a focused delivery test for same generation old blocked delivery then provider evidence delivery:

```go
old := "child-1:1:verify:blocked::thoughts/example/verify.md"
new := "child-1:1:provider_context_error:abc123"
```

Assert `queueOrDeliverWake` does not suppress `new` when `LastDeliveryID == old`, but does suppress repeated `new`.

### Verify

Run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestChildComplete.*ProviderContext|TestQueueOrDeliverWake.*ProviderContext'
go test ./cmd/vamos-runtime/internal/qrspicmd
```

### Commit Message

Subject: `fix(qrspi): wake manager for child provider context errors`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review"
  stage: "implement"
  slice: "3"
  summary: "Have child-complete publish manager-needed provider-context recovery with distinct delivery identity."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 4: Action-card/wake evidence and docs

### Files

- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` (modify if not fully done in Slice 2)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `docs/q-manager.md` (modify)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

Add reusable evidence-line helpers:

```go
func providerContextEvidenceLines(e AssistantTerminalEvidence) []string {
    lines := []string{
        fmt.Sprintf("provider stopReason: %s", e.StopReason),
        fmt.Sprintf("provider error: %s", e.ErrorMessage),
        fmt.Sprintf("evidence id: %s", e.EvidenceID),
    }
    if e.SessionPath != "" {
        lines = append(lines, fmt.Sprintf("session: %s", e.SessionPath))
    }
    if e.SessionID != "" {
        lines = append(lines, fmt.Sprintf("session id: %s", e.SessionID))
    }
    if e.Line > 0 {
        lines = append(lines, fmt.Sprintf("line: %d", e.Line))
    }
    if e.Timestamp != "" {
        lines = append(lines, fmt.Sprintf("timestamp: %s", e.Timestamp))
    }
    return lines
}

func providerContextRecoverySafeCommand(stateFile string) string {
    return fmt.Sprintf("vamos qrspi inspect --state-file %s --sessions --latest", stateFile)
}

func providerContextRecoveryContinueCommand(stateFile string) string {
    return fmt.Sprintf("vamos qrspi recover-manual --state-file %s --mode latest-session --continue", stateFile)
}

func providerContextRecoverySummaryCommand(stateFile string, evidence AssistantTerminalEvidence) string {
    if strings.TrimSpace(evidence.SessionPath) == "" {
        return ""
    }
    return fmt.Sprintf("vamos qrspi recover-summary --state-file %s --session-file %s", stateFile, evidence.SessionPath)
}
```

Update `BuildChildContextExhaustedCard`:

- Accept both `ActiveChildContextExhausted` and `ActiveChildProviderContextError`.
- Include provider error/evidence lines when `health.TerminalEvidence != nil`.
- Safe command = `providerContextRecoverySafeCommand(stateFile)`.
- Continue command = `providerContextRecoveryContinueCommand(stateFile)`.
- Recommended action says relaunch same graph node after inspecting/recovering, not resume/compact blindly.

Update `childCompletionWakePayload` to include terminal evidence YAML when present. Keep existing fields stable and append:

```yaml
  terminal_evidence:
    session_path: %q
    session_id: %q
    line: %d
    timestamp: %q
    stop_reason: %q
    error_message: %q
    evidence_id: %q
    context_window_error: %t
```

The wake remains `q_manager_child_wake`, not `qrspi_result`.

**`cmd/vamos-runtime/internal/qrspicmd/session_recovery.go`**:

Ensure `RunInspect --sessions --latest` prints provider evidence and safe command when health is `provider_context_error`.

**`docs/q-manager.md`**:

Update q-manager recovery docs:

- `provider_context_error` / `child_context_exhausted` means latest child JSONL ended with provider context-window evidence and no trustworthy current QRSPI result.
- `validation-status.json` is a cache; latest terminal session evidence outranks older validated results.
- `validate-latest --apply-rebind` with or without `--continue` will not advance from stale older YAML when latest provider/context evidence exists.
- `recover-summary` is optional helper; it writes a same-stage recovery note and must not emit `qrspi_result`.

### Tests

Add/extend assertions:

- Action-card text contains provider error, evidence ID, session path, inspect command, latest-session continue command.
- `childCompletionWakePayload` includes `terminal_evidence` fields for provider context status.
- `RunInspect --sessions --latest` text output contains `provider_context_error`, provider error text, and `safe command: vamos qrspi inspect ...`.

Run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestRunContinueWritesChildContextExhaustedCard|TestRunInspect.*ProviderContext|TestChildComplete.*ProviderContext'
```

### Verify

Run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
grep -n "provider_context_error\|recover-summary\|validation-status" docs/q-manager.md
```

### Commit Message

Subject: `fix(qrspi): include provider context evidence in recovery cards`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review"
  stage: "implement"
  slice: "4"
  summary: "Expose terminal provider context evidence and safe recovery commands in action cards, wakes, inspect, and docs."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 5: Optional recovery summarizer helper

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/recovery_summary.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/recovery_summary_test.go` (new)
- `docs/q-manager.md` (modify)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Add options/request types:

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
    StateFile         string
    PlanDir           string
    ImplementationCwd string
    Stage             string
    ChildID           string
    SessionFile       string
    Evidence          AssistantTerminalEvidence
    LatestArtifact    string
    PromptPath        string
    NotePath          string
}
```

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

Register command:

```go
cmd.AddCommand(
    // existing commands...
    newRecoverSummaryCommand(d),
)
```

Add command constructor:

```go
func newRecoverSummaryCommand(d deps) *cobra.Command {
    opts := RecoverSummaryOptions{Output: "text", PiBinary: "pi"}
    cmd := &cobra.Command{
        Use:   "recover-summary --state-file <file> --session-file <jsonl>",
        Short: "Write a same-stage recovery summary prompt for a failed child session",
        RunE: func(cmd *cobra.Command, args []string) error {
            return RunRecoverSummary(cmd.Context(), opts, d, cmd.OutOrStdout())
        },
    }
    cmd.Flags().StringVar(&opts.StateFile, "state-file", "", "q-manager state file")
    cmd.Flags().StringVar(&opts.SessionFile, "session-file", "", "failed child Pi session JSONL file")
    cmd.Flags().StringVar(&opts.Stage, "stage", "", "QRSPI stage/node to recover")
    cmd.Flags().StringVar(&opts.PiBinary, "pi-binary", "pi", "Pi binary to launch for non-dry-run summarization")
    cmd.Flags().BoolVar(&opts.DryRun, "dry-run", false, "write prompt and recovery note target without launching Pi")
    cmd.Flags().StringVar(&opts.Output, "output", "text", "output format: text or json")
    return cmd
}
```

**`cmd/vamos-runtime/internal/qrspicmd/recovery_summary.go`**:

Implement deterministic prompt/note generation first; Pi launch can be best-effort and testable via `deps.CommandRunner`.

Core behavior:

1. Require `--state-file` and `--session-file`.
1. Load manager state.
1. Determine stage from flag, active child, or workflow current node.
1. Parse terminal evidence from session file; if it is not context-window evidence, still allow a summary but mark evidence as non-context.
1. Determine latest artifact from prior validation status or active action card evidence.
1. Build note path under `planDir/context/recovery/YYYY-MM-DD_HH-MM-SS_<stage>_<child-id>_context-recovery.md`.
1. Build prompt path under `filepath.Dir(stateFile)/prompts/recover-summary-<timestamp>.md`.
1. Write prompt with strict rules:
   - Read only the failed session tail and named artifacts unless asked.
   - Write the note at the exact note path.
   - Summarize completed work, commands, artifacts, terminal error, next same-stage tasks.
   - Warn what not to repeat.
   - Do not emit `qrspi_result`; do not advance graph; do not edit code.
1. In `--dry-run`, write a deterministic placeholder note with the same constraints and return paths.
1. In non-dry-run, call `d.CommandRunner.Run(ctx, opts.PiBinary, "@"+promptPath)` if runner exists; otherwise return an actionable error telling user to rerun with `--dry-run` or provide a runner.

Functions:

```go
func RunRecoverSummary(ctx context.Context, opts RecoverSummaryOptions, d deps, out io.Writer) error
func WriteRecoverySummaryPrompt(req RecoverySummaryRequest, promptPath string) error
func RecoverySummaryPath(planDir, stage, childID string, now time.Time) string
```

Prompt body must include:

```markdown
# q-manager recovery summarizer

You are a read-only recovery summarizer. Do not emit `qrspi_result`. Do not advance graph. Do not edit code.

Read:
- Failed session: [path]
- Plan memory: [planDir]/AGENTS.md
- Current stage artifacts as needed.

Write exactly: [notePath]

Include:
- Last reliable completed work.
- Terminal provider error evidence.
- Same-stage relaunch instructions.
- Commands/artifacts already checked.
- Avoid repeating huge outputs blindly.
```

### Tests

**`cmd/vamos-runtime/internal/qrspicmd/recovery_summary_test.go`**:

Add:

- `TestRecoverySummaryPathUsesPlanContextRecovery`: path under `context/recovery/`, safe slug, timestamp.
- `TestRunRecoverSummaryDryRunWritesPromptAndNote`: temp plan dir/state/session; dry-run creates prompt and note target; both contain no `qrspi_result` except the prohibition phrase is okay only as `Do not emit qrspi_result`; note says same-stage relaunch, no graph advance.
- `TestWriteRecoverySummaryPromptIncludesProviderEvidence`: prompt contains session path, evidence ID, provider message, note path.

### Verify

Run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'Test.*RecoverySummary|TestRunRecoverSummary'
go test ./cmd/vamos-runtime/internal/qrspicmd
```

### Commit Message

Subject: `feat(qrspi): add child recovery summary helper`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review"
  stage: "implement"
  slice: "5"
  summary: "Add recover-summary helper that writes same-stage recovery prompts/notes without fabricating QRSPI results."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md"
```

______________________________________________________________________

## Slice 6: Regression suite and manual smoke notes

### Files

- `cmd/vamos-runtime/internal/qrspicmd/session_result_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go` (modify)
- `docs/q-manager.md` (modify)

### Changes

Add final integrated regression helpers if they were not already centralized in earlier slices:

```go
func writeSessionWithBlockedResultThenProviderError(t *testing.T, dir string) string {
    t.Helper()
    path := filepath.Join(dir, "session.jsonl")
    writeSessionTestFile(t, path, strings.Join([]string{
        sessionHeader("verify-ctx", "/tmp/repo"),
        assistantLine(testResultYAML("verify", "blocked", "", "thoughts/example/verify.md", "stale blocked")),
        providerContextErrorLine("Codex error: Your input exceeds the context window of this model. Please adjust your input and try again."),
    }, "\n")+"\n")
    return path
}

func assertProviderContextRecoveryStatus(t *testing.T, status ChildCompletionStatus) {
    t.Helper()
    if status.Validated || !status.ManagerNeeded || status.Result.Status != ActionChildContextExhausted || status.TerminalEvidence == nil || !status.TerminalEvidence.ContextWindowError {
        t.Fatalf("status = %+v, want provider context recovery", status)
    }
}
```

Add one end-to-end-ish test around the original bug sequence:

- Active child has old blocked delivery ID as `state.Delivery.LastDeliveryID` and stale `validation-status.json`.
- Same session file has old blocked result then later provider error.
- `RunInspect --sessions --latest` reports provider context error.
- `RunValidateLatest --apply-rebind` stops with action card.
- `RunChildComplete` writes fresh terminal status and does not suppress as duplicate of old blocked delivery.
- `RunContinue` writes action card and does not advance workflow.

Keep this in one or two focused tests to avoid fragile command-output assertions.

Update `docs/q-manager.md` with a manual smoke recipe using copied failed JSONL fixtures:

```bash
# Given a q-manager state with active child/session refs:
vamos qrspi inspect --state-file <state.json> --sessions --latest
vamos qrspi validate-latest --state-file <state.json> --apply-rebind
vamos qrspi child-complete --state-file <state.json> --child-id <child-id> --output json
vamos qrspi continue --state-file <state.json>
```

Expected: all paths surface `provider_context_error` / `child_context_exhausted`, include session/evidence, and do not advance graph from stale older `qrspi_result`.

### Tests

Run full package:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
```

Then broader existing Vamos verification from this checkout:

```bash
go test ./server/config ./server/services/workspaces ./server/services/agentchat ./cmd/build-agents/internal/build
just build --no-restart
```

If `just build --no-restart` is too expensive in the implementation workspace, record why in the implementation handoff and at least run focused package tests.

### Verify

Manual smoke with synthetic temp fixture if possible:

1. Copy one failed bug-report JSONL into a temp plan `.sessions/pi` dir or use the test fixture generator.
1. Create/load a q-manager state pointing active child to that session.
1. Run the four commands above.
1. Confirm no fake `qrspi_result`, no graph advance, fresh terminal status/action card.

### Commit Message

Subject: `test(qrspi): cover child provider context recovery paths`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review"
  stage: "implement"
  slice: "6"
  summary: "Add integrated regression coverage and smoke docs for stale result followed by provider context error."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/reviews/2026-07-04_19-34-32_child-context-autocompaction_implementation-review/plan.md"
```

## Final Verification

After all slices:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
go test ./server/config ./server/services/workspaces ./server/services/agentchat ./cmd/build-agents/internal/build
just build --no-restart
```

Then rerun the blocked parent verify q-manager smoke if manager/runtime state is available. Expected: provider context-window child failures surface as recoverable manager-needed action cards with current session refs instead of stale validation/duplicate delivery.
