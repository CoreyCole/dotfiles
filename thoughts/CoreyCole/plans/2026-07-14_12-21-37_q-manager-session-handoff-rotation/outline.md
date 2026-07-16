---
date: 2026-07-16T16:05:08-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
last_updated_at: 2026-07-16T16:29:36-07:00
git_commit: 7ca824d7960e617861f647fd6314da34b2cff1fc
branch: main
repository: vamos
stage: outline
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Outline: q-manager session handoff rotation

## Overview

Add proactive 75% `turn_end` rotation requests to manager and managed-child Pi extensions. Reuse merged graph-wide child handoff auto-resume unchanged: child monitoring only requests q-handoff; existing `RunChildComplete` validates, launches q-resume successor, notifies, and cleans up. Replace parent native compaction with validated manager operational handoff, exact-pane `/new`, fresh `session_start` claim/injection, and `agent_start` readiness.

## Merged Baseline

Already implemented; regression-only scope:

- all 15 agent nodes accept same-node handoff
- exact-stage/symlink-safe artifact validation
- per-state operation lock
- fresh same-stage q-resume child launch
- replacement lineage and duplicate recovery
- durable wake before predecessor cleanup
- exact manager-pane child split targeting

Canonical evidence: `context/outline/2026-07-16_16-02-04_merged-handoff-auto-resume-baseline.md`.

## Type Definitions

Persist rotation beside existing workflow/child/delivery state:

```go
type RotationRole string

const (
    RotationRoleManager RotationRole = "manager"
    RotationRoleChild   RotationRole = "child"
)

type RotationPhase string

const (
    RotationRequested      RotationPhase = "requested"
    RotationHandoffReady   RotationPhase = "handoff_ready"
    RotationReplacing      RotationPhase = "replacing"
    RotationSuccessorReady RotationPhase = "successor_ready"
    RotationFailed         RotationPhase = "failed"
)

type RotationConfig struct {
    ThresholdPercent float64 `json:"thresholdPercent"`
}

type SessionRotation struct {
    ID                  string              `json:"id"`
    Role                RotationRole        `json:"role"`
    Phase               RotationPhase       `json:"phase"`
    SourceNodeID        wruntime.NodeID     `json:"sourceNodeId"`
    SourceSessionPath   string              `json:"sourceSessionPath,omitempty"`
    SourceChildID       string              `json:"sourceChildId,omitempty"`
    SourceGeneration    int                 `json:"sourceGeneration,omitempty"`
    Usage               ManagerUsageSample  `json:"usage"`
    ThresholdPercent    float64             `json:"thresholdPercent"`
    HandoffArtifact     string              `json:"handoffArtifact,omitempty"`
    HandoffResult       json.RawMessage     `json:"handoffResult,omitempty"`
    SuccessorSessionPath string             `json:"successorSessionPath,omitempty"`
    SuccessorChildID    string              `json:"successorChildId,omitempty"`
    RequestedAt         string              `json:"requestedAt"`
    UpdatedAt           string              `json:"updatedAt"`
    LastError           string              `json:"lastError,omitempty"`
}

type RotationState struct {
    Config  RotationConfig    `json:"config"`
    Manager *SessionRotation  `json:"manager,omitempty"`
    Child   *SessionRotation  `json:"child,omitempty"`
}
```

Extend existing state, preserving merged child fields:

```go
type ManagerState struct {
    // existing fields
    Rotations RotationState `json:"rotations,omitempty"`
}
```

Request/manager lifecycle surfaces:

```go
type RotationRequestOptions struct {
    StateFile   string
    Role        RotationRole
    ChildID     string
    SessionPath string
    Usage       ManagerUsageInput
}

type RotationRequestStatus struct {
    Requested  bool             `json:"requested"`
    Reason     string           `json:"reason"`
    RotationID string           `json:"rotationId,omitempty"`
    StateFile  string           `json:"stateFile,omitempty"`
    Prompt     string           `json:"prompt,omitempty"`
}

type ManagerRotationCompleteOptions struct {
    StateFile   string
    RotationID string
    SessionPath string
}

type ManagerRotationClaimOptions struct {
    StateFile            string
    RotationID           string
    ManagerPane          string
    PreviousSessionPath  string
    SuccessorSessionPath string
}

type ManagerReadyOptions struct {
    // existing fields
    RotationID string
    SessionPath string
}
```

Manager handoff has a dedicated parser, not workflow movement:

```go
type ManagerHandoffResult struct {
    Stage    string          `yaml:"stage"`
    Status   string          `yaml:"status"`
    Outcome  string          `yaml:"outcome"`
    Artifact string          `yaml:"artifact"`
    Raw      json.RawMessage `yaml:"-"`
}

type ManagerHandoffFrontmatter struct {
    Stage       string `yaml:"stage"`
    Status      string `yaml:"status"`
    HandoffType string `yaml:"handoff_type"`
    RotationID string `yaml:"rotation_id"`
}
```

Extension-side stable JSON contract:

```ts
type RotationRequestResult = {
  requested: boolean;
  reason: string;
  rotationId?: string;
  stateFile?: string;
  prompt?: string;
};

type ManagerRotationClaimResult = {
  claimed: boolean;
  reason: string;
  kickoff?: string;
};
```

## CLI Surface

```text
vamos qrspi rotation-request \
  --state-file <file> \
  --role manager|child \
  [--child-id <id>] \
  --session-path <jsonl> \
  --usage-percent <percent> \
  --output json

vamos qrspi manager-rotation-complete \
  --state-file <file> --rotation-id <id> --session-path <jsonl>

vamos qrspi manager-rotation-claim \
  --state-file <file> --rotation-id <id> \
  --manager-pane <pane> --previous-session-path <old-jsonl> \
  --session-path <new-jsonl> --output json

vamos qrspi manager-ready \
  --state-file <file> --rotation-id <id> --session-path <new-jsonl> \
  --manager-pane <pane>
```

`start-next`/initialization accepts configurable `--rotation-threshold-percent`; state default is `75`. Request compares usage under existing operation lock. Missing/null usage is represented by no request, never guessed. Successful `start-next` and `continue` text output both expose the same stable `state: <path>` marker so the parent extension can bind direct operations and conversational q-manager CLI tool results.

## Extension Lifecycle

### Managed child

```ts
pi.on("turn_end", async (_event, ctx) => {
  const usage = ctx.getContextUsage();
  const result = await requestRotation({
    role: "child",
    stateFile: process.env.Q_MANAGER_STATE_FILE,
    childId: process.env.Q_MANAGER_CHILD_ID,
    sessionPath: ctx.sessionManager.getSessionFile(),
    usage,
  });
  if (result.requested && result.prompt) {
    pi.sendUserMessage(result.prompt, { deliverAs: "steer" });
  }
});
```

Keep existing `agent_end` → `child-complete`. The request CLI verifies child ID and exact JSONL under the operation lock, safely binds `ActiveChild.SessionPath` when still empty, and copies the current `ActiveChild.Generation` into the rotation record. It must not trust an environment generation: `mark-child-active` and manual rebind intentionally change delivery generation without restarting the child process. On matching handoff auto-resume, `completeHandoffContinuation` marks the child rotation successor-ready from persisted continuation lineage. Generic/manual handoffs continue identically without requiring a rotation record.

Managed child `session_before_compact` cancels Pi compaction; provider exhaustion remains explicit terminal evidence.

### Manager

Parent extension binds the active state file from the stable `state:` line after either a direct `/q-manager start-next|continue` operation or a successful matching `vamos qrspi start-next|continue` bash tool result produced by conversational q-manager. It maps the completed assistant bash call to its non-error tool result before trusting the marker, so arbitrary prose containing `state:` cannot bind the manager. It stores state file/rotation ID in module state plus process environment so same-process `/new` extension reload can claim; child processes are excluded when `Q_MANAGER_CHILD_ID` is set.

Hooks:

1. `turn_end`: request manager rotation; persist binding; steer returned manager-handoff prompt.
1. `agent_settled`: when manager rotation is requested, invoke `manager-rotation-complete` against current JSONL.
1. CLI validates result/artifact, persists replacing state, then sends `/new` + Enter to exact stored manager pane once.
1. fresh `session_start(reason: "new")`: invoke `manager-rotation-claim` with `event.previousSessionFile` plus the fresh JSONL; claim only when the previous file equals the persisted rotation source, then inject returned kickoff with `pi.sendUserMessage`.
1. fresh `agent_start`: invoke extended `manager-ready`; mark successor-ready and flush one queued wake.
1. `session_before_compact`: cancel managed parent compaction.

If the Pi process restarts and process environment is lost, state + manager handoff/action card remain the deterministic manual claim/recovery source.

## Manager Operational Handoff Contract

New `.pi/skills/q-manager-handoff/SKILL.md` owns stop-work instructions. Artifact lives under canonical plan `handoffs/` and includes:

- exact rotation ID
- plan/current node/latest result and artifact
- state file, manager run/pane/source session
- active child ID/stage/pane/session/output/status/done refs
- whether waiting on child and queued delivery state
- exact successor continuation instruction

Frontmatter:

```yaml
stage: q-manager
status: in_progress
handoff_type: q-manager-operational
rotation_id: <id>
```

Final result requires `stage: q-manager`, `status: handoff`, no outcome, and primary artifact equal to the validated operational handoff. Local refs remain markdown-only.

## File Structure

- `cmd/vamos-runtime/internal/qrspicmd/options.go`
- `cmd/vamos-runtime/internal/qrspicmd/state.go`
- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/rotation.go` (new; state transitions/prompt/result validation)
- `cmd/vamos-runtime/internal/qrspicmd/rotation_test.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js`
- `.pi/extensions/q-manager-parent.ts`
- `.pi/skills/q-manager-handoff/SKILL.md` (new)
- `.pi/skills/q-manager/SKILL.md`
- `.pi/skills/q-handoff/SKILL.md`
- `docs/q-manager.md`
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` (remove/replace)

No workflow-definition, q-resume, DB, schema, or upstream Pi source changes expected.

## Slices

### Slice 1: Proactive child rotation through merged auto-resume

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/options.go`
- `cmd/vamos-runtime/internal/qrspicmd/state.go`
- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/rotation.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/rotation_test.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js`

Add rotation config/state, `rotation-request`, idempotent child ID/session checks with locked generation snapshot, child `turn_end` monitor, steering prompt, and managed compaction cancellation. Link matching merged continuation lineage to successor-ready; leave generic handoffs unchanged.

```go
func RunRotationRequest(ctx context.Context, opts RotationRequestOptions, d deps, out io.Writer) error
func requestSessionRotation(state ManagerState, opts RotationRequestOptions, now time.Time) (ManagerState, RotationRequestStatus, error)
func completeChildRotation(state ManagerState, source ChildRunRef, successor ChildRunRef) ManagerState
```

**Test checkpoint:** `go test ./cmd/vamos-runtime/internal/qrspicmd` proves below/null/pending/stale-session suppression, one 75% request, exact child steering prompt, current generation is copied after `mark-child-active`/rebind without disabling the current session, and matching handoff completion reuses one merged q-resume successor. Existing guided/discuss, artifact safety, duplicate callback, wake, and cleanup tests remain green.

### Slice 2: Manager operational handoff and same-pane fresh session

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/rotation.go`
- `cmd/vamos-runtime/internal/qrspicmd/rotation_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go`
- `.pi/extensions/q-manager-parent.ts`
- `.pi/skills/q-manager-handoff/SKILL.md` (new)
- `.pi/skills/q-manager/SKILL.md`

Add manager monitoring, direct/conversational state binding, operational handoff validation, exact-pane `/new`, fresh-session claim/kickoff injection, and `agent_start` ready acknowledgement. Queue wakes in `replacing`; during this intermediate slice continue to recognize legacy `compacting` as queue-only so existing compaction tests remain green, then delete that temporary branch in Slice 3. Reuse existing `manager-ready` lock and delivery flush.

```go
func RunManagerRotationComplete(ctx context.Context, opts ManagerRotationCompleteOptions, d deps, out io.Writer) error
func validateManagerHandoffResult(state ManagerState, rotation SessionRotation, sessionPath string) (ManagerHandoffResult, ManagerHandoffFrontmatter, error)
func RunManagerRotationClaim(ctx context.Context, opts ManagerRotationClaimOptions, d deps, out io.Writer) error
func claimManagerSuccessor(state ManagerState, opts ManagerRotationClaimOptions, now time.Time) (ManagerState, string, error)
```

**Test checkpoint:** focused Go/fake-tmux tests prove artifact/result validation precedes one exact-pane `/new`; stale/duplicate completion and claim cannot replace twice; a claim whose `previousSessionFile` differs from the persisted source is rejected; a matching fresh claim records the new JSONL and returns exact kickoff; wake stays queued until matching `manager-ready`; `/new`, claim, injection, and ready failures preserve handoff/source/successor refs.

### Slice 3: Remove compaction and verify repeated rotation

**Files:**

- `cmd/vamos-runtime/internal/qrspicmd/options.go`
- `cmd/vamos-runtime/internal/qrspicmd/root.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` (remove/replace)
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go`
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go`
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go`
- `.pi/extensions/q-manager-parent.ts`
- `.pi/skills/q-manager/SKILL.md`
- `.pi/skills/q-handoff/SKILL.md`
- `docs/q-manager.md`

Delete fixed 90% manager compaction types/signals, `ctx.compact()` path, `compacting` wording, and manual post-compaction contract. Preserve `manager-ready` as fresh-rotation acknowledgement/recovery. Update operator docs and action cards for requested/handoff-ready/replacing/successor-ready.

**Test checkpoint:** focused package tests, race test, vet, and `just build --no-restart` pass. Controlled low-threshold tmux story proves repeated child rotation uses one q-resume successor per handoff; manager remains in same pane with new JSONL and automatic kickoff; queued wake flushes only after successor start; old sessions stay inspectable; no native compaction or pane accumulation occurs.

## Failure Matrix

| Condition | Behavior |
| --- | --- |
| below/null usage | no request |
| duplicate same owner/rotation | return existing request; no second steering |
| stale child ID/session | reject request; snapshot current generation only after identity matches |
| child valid handoff | merged auto-resume; matching rotation successor-ready |
| child invalid/launch/wake/cleanup failure | merged action cards and recovery; rotation keeps evidence |
| manager invalid/missing handoff | no `/new`; source remains active |
| manager `/new` send failure | replacing/failed with retryable exact-pane action |
| fresh claim mismatch | no injection or wake flush |
| injection/start acknowledgement missing | successor ref retained; delivery remains replacing |
| manager process restart | manual state-file/rotation claim from durable handoff |
| provider overflow | explicit context-error recovery; no compaction/fabrication |

## Out of Scope

- Changes to merged graph-wide handoff or child auto-resume semantics
- Auto-running normal complete transitions
- Aggregate tool-output budgeting or exact provider-payload accounting
- Upstream Pi changes
- Child same-pane `/new`
- Product UI, database, or compatibility migration
