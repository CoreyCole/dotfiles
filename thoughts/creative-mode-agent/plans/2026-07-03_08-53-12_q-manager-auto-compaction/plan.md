---
date: 2026-07-03T12:04:37-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
branch: main
repository: vamos
stage: plan
ticket: q-manager auto-compact parent after child launch
plan_dir: thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Implementation Plan: q-manager parent auto-compaction

## Status

- [ ] Slice 1: CLI threshold, stable signal, and usage diagnostics
- [ ] Slice 2: Parent Pi q-manager wrapper command
- [ ] Slice 3: Wake reliability regressions
- [ ] Slice 4: Child context-exhaustion / no-result recovery
- [ ] Slice 5: Docs and operator runbook

## Implementation Workspace Prep

`/q-workspace` prepared the fresh filesystem copy for `/q-implement` after `/q-review [plan.md]` succeeded.

Plan workspace:

```text
/home/ruby/dotfiles/thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction
```

Implementation workspace:

```text
/home/ruby/dotfiles/context/vamos-2026-07-03_08-53-12_q-manager-auto-compaction
```

Selected workspace base:

```text
branch: origin/main
commit: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
actual workspace HEAD after workspace prep sync: 2f4ed07e7e576de1015e76daa2ecd07f7d75287c
```

Base decision: this is a normal parent plan, not an implementation-review follow-up and not an intentional continuation of an unmerged Graphite stack. Current trunk and `origin/main` both point at `2f4ed07e7e576de1015e76daa2ecd07f7d75287c`; no prior implementation stack exists for this plan, so latest trunk preserves all reviewed planning artifacts and avoids stacking onto unrelated dirty source-checkout edits.

Parent stack state: no parent implementation stack for this plan; treat it as already merged/not applicable. Expected Graphite parent for the first implementation slice is `main` at the selected base above.

Do not use `git worktree`. This workspace is a normal copied/cloned directory. If the workspace directory is dirty or missing when implementation starts, stop and ask before moving/replacing it.

The full plan directory is available from the implementation workspace at `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction` via the local thoughts symlink so `/q-implement [plan.md]` can load `AGENTS.md`, ADRs, questions, research, reviews, and handoffs.

Repository submission model: Vamos uses Graphite stack branches for feature work. Implement in the workspace selected by `/q-workspace`, complete and verify each tracked edit slice first, then create or modify the slice branch at the end of that slice with the final Conventional Commit message plus fenced `qrspi_commit` footer. Do not commit QRSPI implementation slices directly to `main` and do not pre-create future slice branches.

Command template after workspace prep:

```bash
/q-implement thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md
```

Related-project note: `github.com/earendil-works/pi-mono` is source-of-truth reference material for Pi extension APIs only. Implementation edits are in `github.com/CoreyCole/vamos` unless review explicitly asks for upstream Pi changes.

______________________________________________________________________

## Slice 1: CLI threshold, stable signal, and usage diagnostics

### Files

- `cmd/vamos-runtime/internal/qrspicmd/state.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root_test.go` (modify only if command list assertions need the new hidden flag)

### Changes

**`cmd/vamos-runtime/internal/qrspicmd/state.go`**:

Add local diagnostic usage sample to disposable manager state. Do not include it in durable QRSPI YAML.

```go
type ManagerState struct {
    SchemaVersion       int                  `json:"schemaVersion"`
    RepoID              string               `json:"repoId"`
    CanonicalPlanDir    string               `json:"canonicalPlanDir"`
    ManagerRunID        string               `json:"managerRunId"`
    SourceCwd           string               `json:"sourceCwd"`
    ImplementationCwd   string               `json:"implementationCwd,omitempty"`
    PiModel             string               `json:"piModel,omitempty"`
    ManagerPaneID       string               `json:"managerPaneId,omitempty"`
    ManagerSessionPath  string               `json:"managerSessionPath,omitempty"`
    LastManagerUsage    *ManagerUsageSample  `json:"lastManagerUsage,omitempty"`
    Delivery            ManagerDeliveryState `json:"delivery,omitempty"`
    LastActionCard      *ManagerActionCard   `json:"lastActionCard,omitempty"`
    ActiveChild         *ChildRunRef         `json:"activeChild,omitempty"`
    PendingCleanupChild *ChildRunRef         `json:"pendingCleanupChild,omitempty"`
    Workflow            wruntime.State       `json:"workflow"`
}
```

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Extend usage and compaction DTOs. `Source` is local diagnostic input so the parent wrapper can label samples as live Pi context without the Go CLI guessing from JSONL.

```go
const managerCompactionThresholdPercent = 90.0

type ManagerUsageInput struct {
    UsagePercent *float64 `json:"usagePercent,omitempty"`
    Tokens       *int     `json:"tokens,omitempty"`
    Window       *int     `json:"window,omitempty"`
    Source       string   `json:"source,omitempty"`
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
```

If existing tests or callers depend on `(ManagerState, bool, error)`, update the helper to return `(ManagerState, ManagerCompactionStatus, error)` and derive booleans from `status.Started` at call sites.

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

Update flag capture for both `start-next` and `continue`:

```go
var usageSource string
// ... existing usage flags ...
cmd.Flags().StringVar(&usageSource, "manager-usage-source", "", "diagnostic source for parent manager context usage")
_ = cmd.Flags().MarkHidden("manager-usage-source")
```

Update `usageFromChangedFlags`:

```go
func usageFromChangedFlags(cmd *cobra.Command, usagePercent float64, usageTokens, usageWindow int, usageSource string) ManagerUsageInput {
    var input ManagerUsageInput
    if cmd.Flags().Changed("manager-usage-percent") {
        input.UsagePercent = &usagePercent
    }
    if cmd.Flags().Changed("manager-usage-tokens") {
        input.Tokens = &usageTokens
    }
    if cmd.Flags().Changed("manager-usage-window") {
        input.Window = &usageWindow
    }
    if strings.TrimSpace(usageSource) != "" {
        input.Source = strings.TrimSpace(usageSource)
    }
    return input
}
```

Add diagnostic helpers:

```go
func managerUsageSample(input ManagerUsageInput, now time.Time) *ManagerUsageSample {
    percent, hasPercent := managerUsagePercent(input)
    if !hasPercent && input.Tokens == nil && input.Window == nil {
        return nil
    }
    sample := &ManagerUsageSample{
        Tokens:    input.Tokens,
        Window:    input.Window,
        Source:    firstNonEmpty(strings.TrimSpace(input.Source), "cli-explicit"),
        SampledAt: now.Format(time.RFC3339),
    }
    if hasPercent {
        sample.Percent = &percent
    }
    return sample
}

func readyCommand(stateFile string) string {
    return fmt.Sprintf("vamos qrspi manager-ready --state-file %s --manager-pane $TMUX_PANE", stateFile)
}
```

Rewrite `maybeStartManagerCompaction` with 90% threshold, sample persistence, queue-safe ordering, and stable parent-wrapper marker:

```go
func maybeStartManagerCompaction(ctx context.Context, state ManagerState, stateFile string, usage ManagerUsageInput, d deps, out io.Writer) (ManagerState, ManagerCompactionStatus, error) {
    _ = ctx
    out = ensureWriter(out)
    now := time.Now()
    if d.Clock != nil {
        now = d.Clock()
    }
    if sample := managerUsageSample(usage, now); sample != nil {
        state.LastManagerUsage = sample
    }

    percent, ok := managerUsagePercent(usage)
    if !ok {
        status := ManagerCompactionStatus{Reason: "no_explicit_usage_input"}
        saveUsageDiagnosticIfNeeded(d, stateFile, state, now)
        return state, status, writeCompactionDiagnostic(out, status)
    }
    if percent < managerCompactionThresholdPercent {
        status := ManagerCompactionStatus{Reason: "below_threshold", UsagePercent: fmt.Sprintf("%.1f", percent)}
        saveUsageDiagnosticIfNeeded(d, stateFile, state, now)
        return state, status, writeCompactionDiagnostic(out, status)
    }

    handoffPath, err := writeManagerOperationalHandoff(state, stateFile, now)
    if err != nil {
        return state, ManagerCompactionStatus{}, err
    }
    state.Delivery.Status = "compacting"
    if strings.TrimSpace(state.Delivery.ManagerPaneID) == "" {
        state.Delivery.ManagerPaneID = strings.TrimSpace(state.ManagerPaneID)
    }
    if err := stateStore(d, "", func() time.Time { return now }).Save(stateFile, state); err != nil {
        return state, ManagerCompactionStatus{}, err
    }
    status := ManagerCompactionStatus{
        Started:      true,
        Reason:       "threshold_met",
        UsagePercent: fmt.Sprintf("%.1f", percent),
        HandoffPath:  handoffPath,
        ReadyCommand: readyCommand(stateFile),
    }
    return state, status, writeCompactionDiagnostic(out, status)
}
```

Implement `saveUsageDiagnosticIfNeeded` so samples below threshold and missing-usage states persist when a state file already exists, but missing state files during init do not create unrelated side effects.

```go
func saveUsageDiagnosticIfNeeded(d deps, stateFile string, state ManagerState, now time.Time) {
    if strings.TrimSpace(stateFile) == "" || state.LastManagerUsage == nil {
        return
    }
    _ = stateStore(d, "", func() time.Time { return now }).Save(stateFile, state)
}
```

Replace `writeCompactionDiagnostic` with a status-driven version. Keep text concise for manager chat and include the stable marker only when queue-safe state has been saved:

```go
func writeCompactionDiagnostic(out io.Writer, status ManagerCompactionStatus) error {
    if out == nil {
        return nil
    }
    if status.Started {
        fmt.Fprintf(out, "manager compaction: started; usage %s%% >= %.0f%%; handoff written\n", status.UsagePercent, managerCompactionThresholdPercent)
        fmt.Fprintln(out, "q-manager-parent-compact: started")
        fmt.Fprintf(out, "handoff: %s\n", status.HandoffPath)
        fmt.Fprintf(out, "resume: pi @%s\n", status.HandoffPath)
        fmt.Fprintf(out, "ready: %s\n", status.ReadyCommand)
        return nil
    }
    switch status.Reason {
    case "below_threshold":
        _, err := fmt.Fprintf(out, "manager compaction: skipped; usage %s%% < %.0f%%\n", status.UsagePercent, managerCompactionThresholdPercent)
        return err
    default:
        _, err := fmt.Fprintln(out, "manager compaction: skipped; no explicit usage input")
        return err
    }
}
```

Update call sites in `RunStartNext` and `RunContinue`:

```go
launched, compaction, err := maybeStartManagerCompaction(ctx, launched, stateFile, opts.Usage, d, out)
if err != nil { return nil, err }
result.Compaction = compaction // if StartNextResult is extended; otherwise ignore status after writing text.
```

`buildManagerOperationalHandoff` should keep the same local/ephemeral refs and mention native compaction explicitly:

```text
Done: parent manager usage met native compaction threshold after launching child; delivery marked compacting so child wake queues safely before parent Pi ctx.compact() runs.
```

### Tests

**`cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go`**:

- Update `TestManagerCompactionThresholdWritesHandoffAndMarksCompacting` usage from `81.0` to `90.0` or `91.0`.
- Add `TestManagerCompactionSkipsBelowNinetyAndPersistsUsageDiagnostic`:

```go
usage := 89.9
updated, status, err := maybeStartManagerCompaction(t.Context(), state, stateFile, ManagerUsageInput{UsagePercent: &usage, Source: "pi-extension-context"}, deps{Clock: fixture.clock}, &out)
if err != nil || status.Started || updated.Delivery.Status == "compacting" { t.Fatalf(...) }
loaded := loadManagerState(t, stateFile)
if loaded.LastManagerUsage == nil || *loaded.LastManagerUsage.Percent != 89.9 || loaded.LastManagerUsage.Source != "pi-extension-context" { t.Fatalf(...) }
if !strings.Contains(out.String(), "usage 89.9% < 90%") { t.Fatalf(...) }
```

- Add `TestManagerCompactionStartedSignalIsStableAndQueueSafe`:

```go
usage := 90.0
updated, status, err := maybeStartManagerCompaction(...)
if !status.Started || status.HandoffPath == "" || status.ReadyCommand == "" { t.Fatalf(...) }
loaded := loadManagerState(t, stateFile)
if loaded.Delivery.Status != "compacting" { t.Fatalf(...) }
text := out.String()
for _, want := range []string{"q-manager-parent-compact: started", "handoff:", "ready: vamos qrspi manager-ready --state-file"} { ... }
```

- Keep `TestManagerCompactionQueuesAndFlushesWake`, but update threshold to exactly `90.0` and assert queueing still happens after state save.

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManager(Usage|Compaction)'
```

### Commit Message

`feat(qrspi): add q-manager compaction signal and diagnostics`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction"
  stage: "implement"
  slice: "1"
  summary: "Raise manager compaction trigger to 90%, persist live usage diagnostics, and emit stable parent compact signal after delivery is queue-safe."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md"
```

______________________________________________________________________

## Slice 2: Parent Pi q-manager wrapper command

### Files

- `.pi/extensions/q-manager-parent.ts` (new)
- `.pi/README.md` (modify)
- `package.json` / `pnpm-lock.yaml` (modify only if local extension type imports require adding `@earendil-works/pi-coding-agent`; preserve existing worker imports unless deliberately migrated)

### Changes

**`.pi/extensions/q-manager-parent.ts`** (new):

Create a project-local Pi extension command `/q-manager`. It is an adapter around the existing Go CLI only; it must not duplicate graph rules.

Use top-level imports only:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ContextUsage, ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);

type QManagerAction = "start-next" | "continue";

type ParsedArgs = {
  action: QManagerAction;
  passthrough: string[];
};

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
```

Register command:

```ts
export default function (pi: ExtensionAPI): void {
  pi.registerCommand("q-manager", {
    description: "Run q-manager start-next/continue with live parent usage sampling and native compaction",
    handler: async (args, ctx) => {
      const parsed = parseArgs(args);
      const usageFlags = usageFlagsFromContext(ctx.getContextUsage());
      const result = await runQManagerCLI(parsed.action, parsed.passthrough, usageFlags, ctx.cwd);
      publishCLIResult(ctx, result);
      if (result.exitCode !== 0) {
        ctx.ui.notify("q-manager CLI failed; parent compaction skipped", "error");
        return;
      }
      if (result.compaction.started) {
        compactParent(ctx, result.compaction);
      }
    },
  });
}
```

Implement arg parsing without a shell. It only needs normal q-manager paths/flags; quoted paths may be supported by a small state machine, but do not call `sh -c`.

```ts
function parseArgs(args: string): ParsedArgs {
  const parts = splitArgs(args.trim());
  const action = parts.shift();
  if (action !== "start-next" && action !== "continue") {
    throw new Error("usage: /q-manager start-next|continue [vamos qrspi flags]");
  }
  return { action, passthrough: parts };
}
```

Implement usage flags. Do not scan parent session JSONL. If Pi has no trusted usage after recent compaction (`percent === null` and `tokens === null`), pass no usage flags and skip native compact.

```ts
function usageFlagsFromContext(usage: ContextUsage | undefined): string[] {
  if (!usage) return [];
  if (usage.percent !== null) {
    return ["--manager-usage-percent", usage.percent.toFixed(1), "--manager-usage-source", "pi-extension-context"];
  }
  if (usage.tokens !== null && usage.contextWindow > 0) {
    return ["--manager-usage-tokens", String(usage.tokens), "--manager-usage-window", String(usage.contextWindow), "--manager-usage-source", "pi-extension-context"];
  }
  return [];
}
```

Run the CLI as an argv array. Prefer installed `vamos`; if implementation testing needs checkout-local command before install, allow `VAMOS_Q_MANAGER_BIN` to point at a binary path only, not arbitrary shell.

```ts
async function runQManagerCLI(action: QManagerAction, args: string[], usageFlags: string[], cwd: string): Promise<QManagerCLIResult> {
  const bin = process.env.VAMOS_Q_MANAGER_BIN?.trim() || "vamos";
  const cliArgs = ["qrspi", action, ...args, ...usageFlags];
  try {
    const { stdout, stderr } = await execFileAsync(bin, cliArgs, { cwd, maxBuffer: 1024 * 1024 });
    return { exitCode: 0, stdout, stderr, compaction: parseCompactionSignal(stdout) };
  } catch (error) {
    if (isExecError(error)) {
      const stdout = String(error.stdout ?? "");
      const stderr = String(error.stderr ?? "");
      return { exitCode: typeof error.code === "number" ? error.code : 1, stdout, stderr, compaction: parseCompactionSignal(stdout) };
    }
    throw error;
  }
}
```

Use a typed `isExecError` helper instead of `any`:

```ts
type ExecError = Error & { code?: unknown; stdout?: unknown; stderr?: unknown };

function isExecError(error: unknown): error is ExecError {
  return error instanceof Error && ("stdout" in error || "stderr" in error || "code" in error);
}
```

Parse only the stable marker/fields from Slice 1:

```ts
function parseCompactionSignal(stdout: string): QManagerCompactionSignal {
  if (!stdout.split(/\r?\n/).some((line) => line.trim() === "q-manager-parent-compact: started")) {
    return { started: false };
  }
  return {
    started: true,
    handoffPath: findLineValue(stdout, "handoff:"),
    readyCommand: findLineValue(stdout, "ready:"),
  };
}

function findLineValue(stdout: string, prefix: string): string | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim() || undefined;
  }
  return undefined;
}
```

Trigger native parent compaction only after the CLI has returned success and marker is present. `ctx.compact()` is fire-and-forget; use callbacks for notification only.

```ts
function compactParent(ctx: ExtensionCommandContext, signal: QManagerCompactionSignal): void {
  const ready = signal.readyCommand ?? "vamos qrspi manager-ready --state-file <state> --manager-pane $TMUX_PANE";
  const handoff = signal.handoffPath ?? "the q-manager operational handoff printed above";
  ctx.compact({
    customInstructions: `Read q-manager operational handoff: ${handoff}.\nAfter compaction, run exactly once:\n${ready}\nThen follow any flushed q_manager_child_wake.`,
    onComplete: () => ctx.ui.notify("q-manager parent compaction complete; run manager-ready", "info"),
    onError: (error) => ctx.ui.notify(`q-manager parent compaction failed: ${error.message}`, "error"),
  });
  ctx.ui.notify("q-manager parent compaction started", "info");
}
```

`publishCLIResult(ctx: ExtensionCommandContext, result: QManagerCLIResult)` should make concise stdout visible without bloating context. Acceptable minimal path: `ctx.ui.notify(first significant line, "info")` plus a displayed custom message if Pi rendering makes custom messages readable. Do not dump NDJSON.

**`.pi/README.md`**:

Add project-local extension listing:

```markdown
- `q-manager-parent` — `/q-manager start-next|continue` parent wrapper; samples live Pi context usage and triggers native parent compaction after q-manager delivery is queue-safe.
```

### Tests

- Add a small unit-testable helper section if desired by exporting pure helper functions from the extension, or keep helpers unexported and verify manually in Pi. If adding tests, include `.pi/extensions/**/*.ts` in a dedicated extension tsconfig or use a minimal `tsx`/`node --test` harness; do not break the existing Temporal worker build.
- Manual mocked test:
  1. Temporarily set `VAMOS_Q_MANAGER_BIN` to a fixture script that prints the stable marker and exits 0.
  1. Load Pi with `pi --extension .pi/extensions/q-manager-parent.ts` from the Vamos checkout.
  1. Run `/q-manager start-next --plan-dir <plan> --project-root <repo> --manager-pane <pane>`.
  1. Verify the wrapper passes `--manager-usage-*` only from `ctx.getContextUsage()` and calls `ctx.compact()` only after marker.
- Manual real smoke after Slice 1 is installed:

```bash
# From a parent Pi/tmux session in the implementation workspace:
/q-manager start-next --plan-dir thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction --project-root "$PWD" --manager-pane "$TMUX_PANE"
```

### Verify

```bash
pnpm exec tsc --noEmit --pretty false .pi/extensions/q-manager-parent.ts
# If direct tsc against a single extension is not supported by the repo config, verify by loading it:
pi --no-context-files --extension .pi/extensions/q-manager-parent.ts --help
```

Then run:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManager(Usage|Compaction)'
```

### Commit Message

`feat(qrspi): add parent pi q-manager command`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction"
  stage: "implement"
  slice: "2"
  summary: "Add project-local Pi /q-manager wrapper that samples live parent context usage and invokes native ctx.compact after CLI compacting signal."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md"
```

______________________________________________________________________

## Slice 3: Wake reliability regressions

### Files

- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go` (modify if end-to-end fixture is clearer)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery.go` (modify only if safe-command diagnostics need tightening)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify only for delivery/recovery text gaps found by tests)

### Changes

Protect the approved wake chain:

```text
child Pi extension -> qrspi child-complete -> session JSONL validation -> delivery queue/deliver -> parent pane wake
```

Keep behavior exactly one-current-generation wake:

- Normal ready delivery pastes one atomic wake to manager pane and sets `Delivery.LastDeliveryID`.
- While `Delivery.Status == "compacting"`, validated child completion stores `Delivery.QueuedWake` and does not paste.
- `RunManagerReady` marks delivery ready, updates current manager pane, checks generation/lifecycle, flushes the queued wake exactly once, and sets `LastDeliveryID`.
- If active child generation changed because of steer/rebind/mark-active/manual recovery, `manager-ready` suppresses old queued wake and writes `ActionSupersededQueuedWake`.
- No-wake recovery uses latest-session validation/rebind/continue; it must not ask operators to hand-edit state or durable YAML.

**`cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`**:

Add or tighten tests:

```go
func TestDeliveryNormalWakePersistsLastDeliveryID(t *testing.T) { ... }
func TestDeliveryQueuesValidatedWakeWhileCompactingWithoutPaste(t *testing.T) { ... }
func TestManagerReadyFlushesQueuedWakeExactlyOnce(t *testing.T) { ... }
func TestManagerReadySuppressesQueuedWakeAfterRebindGenerationChange(t *testing.T) { ... }
```

Use existing `recordingTmux` and `ChildCompletionStatus` fixtures. For exact-once, call `RunManagerReady` twice and assert one paste and second output `manager ready: no queued wake`.

**`cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go`**:

Add a test that proves `RunChildComplete` queues during compacting after session JSONL validation, and writes `validation-status.json` with `wake.mode == "queue"`.

```go
state := ManagerState{
    ManagerPaneID: "%parent",
    Delivery: ManagerDeliveryState{Status: "compacting", ManagerPaneID: "%parent"},
    Workflow: testWorkflowState(t, qrspi.NodeReviewPlan, nil),
    ActiveChild: &ChildRunRef{... ValidationStatusPath: validationPath, Generation: 1},
}
status, err := RunChildComplete(...)
if !status.Validated || status.Wake.Mode != "queue" { t.Fatalf(...) }
if len(tmux.pastes) != 0 { t.Fatalf(...) }
```

**`cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go`**:

Add no-wake recovery coverage:

```go
func TestNoWakeRecoveryValidateLatestApplyRebindContinues(t *testing.T) { ... }
```

Fixture:

1. State active child points at an older/missing session path or no delivery occurred.
1. A newer latest session JSONL in the active child session dir contains valid `qrspi_result`.
1. Run `RunValidateLatest(... ApplyRebind: true, Continue: true ...)` with fake runner for next child.
1. Assert active child generation increments, stale queued wake is cleared if present, graph decision is applied, and next child starts when policy says start.

If current `RunValidateLatest` already passes the existing test, only add assertions for stale wake suppression and safe command text from `RunInspect --sessions --latest`.

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestDelivery|TestChildComplete.*Queue|Test.*Latest|TestNoWake'
```

### Commit Message

`test(qrspi): cover q-manager wake recovery paths`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction"
  stage: "implement"
  slice: "3"
  summary: "Add regressions for normal wake delivery, queued wake flushing during parent compaction, stale wake suppression, and latest-session no-wake recovery."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md"
```

______________________________________________________________________

## Slice 4: Child context-exhaustion / no-result recovery

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_health_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/session_recovery_test.go` (modify if recovery command text changes)

### Changes

Separate two failure classes:

- **No-wake**: child has valid result, but manager wake/delivery failed. Recovery validates/rebinds latest session and continues.
- **Context exhaustion / terminal no-result**: child has no trustworthy `qrspi_result`; graph must not advance. Recovery preserves refs, compacts/resumes/steers same child when context-limit evidence exists, or relaunches same graph node only when no trustworthy artifact/result exists.

**`cmd/vamos-runtime/internal/qrspicmd/options.go`**:

Add action/status constants:

```go
const (
    ActiveChildContextExhausted ActiveChildHealthStatus = "context_exhausted_no_result"
)

const (
    ActionChildContextExhausted = "child_context_exhausted"
)
```

If keeping `ActiveChildHealthStatus` constants near existing health constants, place `ActiveChildContextExhausted` with the other statuses.

**`cmd/vamos-runtime/internal/qrspicmd/child_health.go`**:

Add evidence detection. Include both tmux/output diagnostics and the final child session text because provider context-limit failures can exist in the child JSONL even when the transcript tail is empty or truncated.

```go
func HasChildContextExhaustionEvidence(health ActiveChildHealth, sessionText string) bool {
    lines := append(append([]string{}, health.Evidence...), health.OutputTail...)
    if strings.TrimSpace(sessionText) != "" {
        lines = append(lines, sessionText)
    }
    for _, line := range lines {
        text := strings.ToLower(line)
        if strings.Contains(text, "context length") ||
           strings.Contains(text, "context window") ||
           strings.Contains(text, "context_length_exceeded") ||
           strings.Contains(text, "maximum context") ||
           strings.Contains(text, "context limit") ||
           strings.Contains(text, "compaction failed") {
            return true
        }
    }
    return false
}
```

In `InspectActiveChildHealth`, after output tail/status is loaded and before generic launch-failed classification, read the active child session's final assistant text when available and use it for context-exhaustion evidence before deciding whether this is a generic launch failure:

```go
sessionText := ""
if strings.TrimSpace(child.SessionPath) != "" {
    if text, err := ExtractFinalAssistantTextFromSession(child.SessionPath); err == nil {
        sessionText = text
    }
}
if status != nil && HasDoneMarker(child.DonePath) && !hasResult && HasChildContextExhaustionEvidence(health, sessionText) {
    health.Status = ActiveChildContextExhausted
    if strings.TrimSpace(sessionText) != "" {
        health.Evidence = append(health.Evidence, "session has context-limit/no-result evidence")
    }
    health.SafeCommand = fmt.Sprintf("pi --resume %s # then run /compact only if this is the exhausted child session", firstNonEmpty(child.SessionPath, child.SessionID))
    return health, nil
}
```

If `SessionPath` is empty, resolve it from `SessionDir`/`SessionID`/`Cwd` the same way `ReadChildResultText` does, then inspect that file. Do not require the provider error to appear in both JSONL and tmux output.

Keep `IsTerminalFailedChild` true only for cases where it is safe to clear/relaunch mechanically. Context exhaustion should produce its own action card first, not be silently cleared.

```go
func IsTerminalFailedChild(health ActiveChildHealth) bool {
    return health.Status == ActiveChildLaunchFailed
}
```

Add helper:

```go
func IsRecoverableNoResultChild(health ActiveChildHealth) bool {
    return health.Status == ActiveChildContextExhausted
}
```

**`cmd/vamos-runtime/internal/qrspicmd/root.go`**:

In `RunContinue`, after `InspectActiveChildHealth`, branch context exhaustion before generic terminal failed child handling:

```go
if IsRecoverableNoResultChild(health) {
    card := BuildChildContextExhaustedCard(health, state, opts.StateFile)
    state.LastActionCard = card
    _ = store.Save(opts.StateFile, state)
    return writeManagerActionCard(out, *card, opts.Output)
}
```

Implement card:

```go
func BuildChildContextExhaustedCard(health ActiveChildHealth, state ManagerState, stateFile string) *ManagerActionCard {
    evidence := append([]string{
        fmt.Sprintf("child: %s stage=%s", health.ChildID, health.Stage),
        fmt.Sprintf("session: %s", firstNonEmpty(health.SessionPath, health.SessionDir)),
        fmt.Sprintf("status: %s", health.Status),
    }, health.Evidence...)
    evidence = append(evidence, health.OutputTail...)
    return &ManagerActionCard{
        Kind:              ActionChildContextExhausted,
        Severity:          "warning",
        Summary:           "child ended without valid qrspi_result after context-limit evidence",
        Evidence:          evidence,
        RecommendedAction: "resume the same child and compact only if context-limit evidence is real; otherwise validate/rebind latest session or relaunch the same graph node",
        SafeCommand:       fmt.Sprintf("vamos qrspi inspect --state-file %s --sessions --latest", stateFile),
        ContinueCommand:   fmt.Sprintf("vamos qrspi recover-manual --state-file %s --mode latest-session --continue", stateFile),
        RequiresHuman:     false,
    }
}
```

Do not mark the child complete. Do not write synthetic `qrspi_result`. Do not advance workflow state from artifacts alone.

If the human/operator chooses relaunch, they should use existing `repair-state --clear-failed-child --relaunch` only after inspecting evidence that no trustworthy result/artifact can be salvaged. If artifacts were written, use `validate-latest --apply-rebind`, `recover-manual`, or `steer-child` to get a valid YAML result first.

**`cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go`**:

Add a no-result context-limit test. A child session contains provider error text but no fenced `qrspi_result`; done/status indicates terminal; output transcript may be empty. `RunChildComplete` should either reprompt while retry remains or, after retry exhaustion, wake manager with invalid-result action without advancing. For direct `RunContinue`, assert the context-exhausted action card appears.

**`cmd/vamos-runtime/internal/qrspicmd/child_health_test.go`**:

Add:

```go
func TestInspectActiveChildHealthDetectsContextExhaustionNoResult(t *testing.T) { ... }
func TestContinueContextExhaustionWritesActionCardWithoutAdvance(t *testing.T) { ... }
```

Assert:

- Health status is `context_exhausted_no_result`.
- `RunContinue` output contains `action: child_context_exhausted` and safe inspect command.
- Workflow current node remains the active child stage.
- Active child refs remain present.

### Verify

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'Test.*Context|TestChildCompleteInvalid|TestContinueActionCards'
```

### Commit Message

`fix(qrspi): preserve context-exhausted child recovery`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction"
  stage: "implement"
  slice: "4"
  summary: "Add action-card recovery for context-exhausted/no-result children so q-manager preserves refs and never advances without valid qrspi_result."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md"
```

______________________________________________________________________

## Slice 5: Docs and operator runbook

### Files

- `docs/q-manager.md` (modify)
- `.pi/skills/q-manager/SKILL.md` (modify)
- `.pi/README.md` (modify if not already done in Slice 2)
- `thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/AGENTS.md` (modify only if implementation discovers a new durable invariant)

### Changes

**`docs/q-manager.md`**:

Update the child wake/compaction section and manual smoke path:

- Normal path from parent Pi is now:

```text
/q-manager start-next --plan-dir <plan> --project-root <repo> --manager-pane "$TMUX_PANE"
/q-manager continue --state-file <state>
```

- Parent command samples live Pi context via `ctx.getContextUsage()`. Go CLI does not scan parent Pi JSONL for parent usage.
- Raw CLI `--manager-usage-*` flags remain debug/manual seam.
- Trigger is fresh usage `>=90%`, not `>80%`.
- Ordering: child launched and `ActiveChild` saved first; CLI writes handoff and saves `Delivery.Status=compacting`; only then parent wrapper calls native `ctx.compact()`.
- If child wakes during parent compaction, q-manager queues the validated wake. Fresh manager runs printed `manager-ready` exactly once and receives one current-generation wake.
- No-wake recovery commands:

```bash
vamos qrspi inspect --state-file <state> --sessions --latest
vamos qrspi validate-latest --state-file <state> --stage <node> --apply-rebind
vamos qrspi recover-manual --state-file <state> --mode latest-session --continue
```

- Child context exhaustion: use child `/compact` only with context-limit evidence; otherwise steer/resume/rebind/relaunch same node. Never invent YAML or advance from artifacts alone.

**`.pi/skills/q-manager/SKILL.md`**:

Update the wake-driven loop:

- Prefer `/q-manager start-next|continue` in parent Pi sessions so usage is sampled automatically.
- Keep raw `vamos qrspi start-next|continue --manager-usage-*` as debug/manual fallback.
- Replace all `above 80%` text with `fresh parent usage >=90%`.
- Add instruction: after native parent compaction, run the printed `manager-ready` command once, then follow flushed wake.
- Preserve concise text-output guidance; do not add NDJSON to happy path.
- Add context-exhaustion distinction: no-wake with valid result uses latest-session recovery; context-exhausted/no-result child uses child compact/resume/steer or same-node relaunch, and graph does not advance.

**`.pi/README.md`**:

If Slice 2 did not update it, add the extension bullet.

**Plan `AGENTS.md`**:

Only add a new bullet if implementation changes the durable approach, for example if the command name or marker differs from this plan. Do not duplicate this plan.

### Verify

```bash
rg -n "80%|above 80|manager-usage|ctx.getContextUsage|q-manager start-next|context exhaustion|manager-ready" docs/q-manager.md .pi/skills/q-manager/SKILL.md .pi/README.md
```

Then run targeted tests from previous slices:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd -run 'TestManager(Usage|Compaction)|TestDelivery|Test.*Latest|Test.*Context'
```

Full package check when implementation is complete:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
```

### Commit Message

`docs(qrspi): document q-manager parent auto-compaction`

```yaml
qrspi_commit:
  plan: "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction"
  stage: "implement"
  slice: "5"
  summary: "Update q-manager docs and skill for parent Pi wrapper, 90% native compaction trigger, queued wake recovery, and child exhaustion handling."
  artifacts:
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/design.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/outline.md"
    - "thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction/plan.md"
```

______________________________________________________________________

## Final Verification

Run after all slices:

```bash
go test ./cmd/vamos-runtime/internal/qrspicmd
rg -n "80%|above 80|q-manager-parent-compact|ctx.getContextUsage|ctx.compact|manager-ready" docs/q-manager.md .pi/skills/q-manager/SKILL.md .pi/extensions/q-manager-parent.ts cmd/vamos-runtime/internal/qrspicmd
```

Manual smoke from a parent Pi/tmux manager after rebuild/install:

```text
/q-manager start-next --plan-dir thoughts/creative-mode-agent/plans/2026-07-03_08-53-12_q-manager-auto-compaction --project-root <implementation-workspace> --manager-pane "$TMUX_PANE"
```

Expected evidence:

- Child pane launches visibly before parent compaction.
- State file contains `activeChild` before `delivery.status=compacting`.
- CLI output includes `q-manager-parent-compact: started` only after state is queue-safe.
- Parent native compaction starts from the Pi wrapper, not from Go JSONL scanning.
- A quick child result while parent compacts queues until `manager-ready`.
- `manager-ready` flushes exactly one current-generation wake.
- Latest-session recovery handles no-wake without hand-editing durable artifacts.
- Context-exhausted/no-result child gets an action card and same-node recovery, not graph advancement.
