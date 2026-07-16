---
date: 2026-07-16T16:17:12-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 7ca824d7960e617861f647fd6314da34b2cff1fc
branch: main
repository: vamos
stage: plan
ticket: q-manager manager/child pre-limit handoff rotation
plan_dir: thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation
project: github.com/CoreyCole/vamos
related_projects:
  - github.com/earendil-works/pi-mono
---

# Implementation Plan: q-manager session handoff rotation

## Status

- [ ] Slice 1: Proactive child rotation through merged auto-resume
- [ ] Slice 2: Manager operational handoff and same-pane fresh session
- [ ] Slice 3: Remove native compaction, document recovery, and verify repeated rotation

## Scope and submission model

Primary implementation is only in `github.com/CoreyCole/vamos`. `github.com/earendil-works/pi-mono` is read-only API evidence; do not edit or submit upstream Pi changes. Use project-local Pi extension hooks and the existing built-in `/new` lifecycle.

Vamos uses Graphite feature stacks. In the prepared implementation copy, implement and verify each tracked-edit slice on the current base/top branch, then create that slice branch at the end with `gt create q-manager-session-handoff-rotation_slice-N -m "$(cat /tmp/slice-commit-message.txt)"`. Do not pre-create future branches. After the branch exists, write the implementation handoff and amend it with `gt modify --no-interactive`. Preserve the three-commit stack for `/vamos-merge`; do not commit directly to `main` and do not squash the stack.

## Implementation Workspace Prep

`/q-workspace` will create or repair the fresh filesystem copy after `/q-review [plan.md]` succeeds.

Planned workspace path:

```text
/Users/swarm/dotfiles/context/vamos-2026-07-14_12-21-37_q-manager-session-handoff-rotation
```

Implementation happens in a normal copied directory, never a git worktree. `/q-workspace`, not this planning stage, chooses the final base after review edits. This is a normal parent plan, so use latest clean `origin/main` unless final review records a different safe parent. Create the copy with `cp -ac` on macOS or `cp -a --reflink=auto` on Linux.

The workspace copy is the isolation boundary. The full plan directory must exist at the same relative `thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation` path so implementation can load questions, research, ADRs, reviews, and handoffs. If the candidate workspace already exists and is dirty, stop; move it aside only after explicit approval and with an explicit backup name.

This is not an implementation-review follow-up. If this later becomes a review-fix plan, `/q-workspace` must first prove whether the parent implementation stack top is merged. An unmerged review-fix workspace must base on the exact parent stack top, and its first Graphite branch must report that top from `gt parent`.

Command template:

```text
/q-workspace thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/plan.md
```

______________________________________________________________________

## Slice 1: Proactive child rotation through merged auto-resume

### Goal

Persist an idempotent 75% context-usage rotation request at child `turn_end`, steer exact q-handoff work, cancel managed-child compaction, then mark the request ready only when the already-merged child continuation lineage proves a fresh q-resume successor. Do not add another child launcher, artifact validator, or wake protocol.

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/state.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/rotation.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/rotation_test.go` (new)
- `cmd/vamos-runtime/internal/qrspicmd/child.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js` (modify)

### Changes

#### `options.go`: rotation contracts and CLI inputs

Add string-backed role/phase types and JSON contracts. Keep `ManagerUsageInput` as the shared input shape because both extensions consume Pi's `ContextUsage`; do not infer a percentage when Pi supplies neither percentage nor a valid token/window pair.

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

const defaultRotationThresholdPercent = 75.0

type RotationRequestOptions struct {
    StateFile       string
    Role            RotationRole
    ChildID         string
    ChildGeneration int
    SessionPath     string
    Usage           ManagerUsageInput
    Output          string
}

type RotationRequestStatus struct {
    Requested  bool   `json:"requested"`
    Reason     string `json:"reason"`
    RotationID string `json:"rotationId,omitempty"`
    StateFile  string `json:"stateFile,omitempty"`
    Prompt     string `json:"prompt,omitempty"`
}
```

Add `RotationThresholdPercent float64` to `InitOptions` and `StartNextOptions`. Register `--rotation-threshold-percent` on `init` and `start-next`; zero means use 75, not disabled. Validate `0 < threshold < 100`. Existing-state `start-next` updates the persisted config under the state operation lock before checking/launching a child so operators can raise the threshold during controlled tests without editing JSON.

Add `newRotationRequestCommand` to `newCommand`:

```text
vamos qrspi rotation-request \
  --state-file <file> --role manager|child \
  --session-path <jsonl> --usage-percent <percent> --output json
```

Child calls additionally require `--child-id` and `--child-generation`. Support token/window flags as the same explicit alternative used by `managerUsagePercent`.

#### `state.go`: durable request state beside current ownership

Extend `ManagerState`, preserving all existing workflow, delivery, and continuation fields:

```go
type RotationConfig struct {
    ThresholdPercent float64 `json:"thresholdPercent"`
}

type SessionRotation struct {
    ID                   string             `json:"id"`
    Role                 RotationRole       `json:"role"`
    Phase                RotationPhase      `json:"phase"`
    SourceNodeID         wruntime.NodeID    `json:"sourceNodeId"`
    SourceSessionPath    string             `json:"sourceSessionPath,omitempty"`
    SourceChildID        string             `json:"sourceChildId,omitempty"`
    SourceGeneration     int                `json:"sourceGeneration,omitempty"`
    Usage                ManagerUsageSample `json:"usage"`
    ThresholdPercent     float64            `json:"thresholdPercent"`
    HandoffArtifact      string             `json:"handoffArtifact,omitempty"`
    HandoffResult        json.RawMessage    `json:"handoffResult,omitempty"`
    SuccessorSessionPath string             `json:"successorSessionPath,omitempty"`
    SuccessorChildID     string             `json:"successorChildId,omitempty"`
    RequestedAt          string             `json:"requestedAt"`
    UpdatedAt            string             `json:"updatedAt"`
    LastError            string             `json:"lastError,omitempty"`
}

type RotationState struct {
    Config  RotationConfig   `json:"config"`
    Manager *SessionRotation `json:"manager,omitempty"`
    Child   *SessionRotation `json:"child,omitempty"`
}
```

Add `Rotations RotationState` to `ManagerState`. Initialize the default threshold in `InitialManagerState`, `RunInit`, and `resolveOrInitStartState`; normalize older zero-valued state to 75 at the first locked request/config update rather than maintaining a compatibility branch.

#### `rotation.go`: locked request transition and role-specific prompts

Implement the command as a thin locked wrapper:

```go
func RunRotationRequest(ctx context.Context, opts RotationRequestOptions, d deps, out io.Writer) error {
    if err := validateRotationRequestOptions(opts); err != nil { return err }
    store := stateStore(d, "", clockOrNow(d))
    lock, err := store.AcquireOperationLock(ctx, opts.StateFile)
    if err != nil { return err }
    defer lock.Release()

    state, err := store.Load(opts.StateFile)
    if err != nil { return err }
    next, status, err := requestSessionRotation(state, opts, clockOrNow(d)())
    if err != nil { return err }
    if err := store.Save(opts.StateFile, next); err != nil { return err }
    return writeRotationRequestOutput(out, opts.Output, status)
}
```

`requestSessionRotation` must:

1. Normalize config to default 75 and persist the supplied usage sample even when no request is created.
1. Return `unknown_usage` for absent/null usage and `below_threshold` for a valid sample below config.
1. For child requests, require the current `ActiveChild.ID`, `Generation`, stage, and non-empty session path to match. Reject stale ID/generation without mutating a newer request.
1. For manager requests, bind `ManagerSessionPath` only when empty; once bound, reject a different source session. Slice 2 will advance this owner only through a matching fresh-session claim/readiness path.
1. Suppress a second request while the same role has `requested`, `handoff_ready`, or `replacing`. A `successor_ready` record is historical and may be replaced only by a request from the current successor identity.
1. Generate a deterministic collision-safe ID from role, source identity, and timestamp using the existing run-ID pattern.
1. Persist source node, exact source session, child ID/generation when applicable, usage, threshold, timestamps, and `requested` phase before returning `Requested=true`.
1. Return an exact prompt. Child prompt says: stop normal work; read `.pi/skills/q-handoff/SKILL.md`; checkpoint the exact active graph node; include the rotation ID in the handoff notes; emit graph-valid `status: handoff` with no outcome and the handoff as primary artifact. Manager prompt is added in Slice 2.

Keep transition helpers pure where possible so table tests can assert old/new state without filesystem setup.

#### `child.go`: export the persisted generation

The outline's stale-generation check requires data that is not currently in the child process environment. Add `Generation int` to `ChildRunRequest`; pass the generation selected for the new `ChildRunRef` into the request, and add:

```go
"Q_MANAGER_CHILD_GENERATION=" + strconv.Itoa(req.Generation),
```

Do not derive generation inside JavaScript and do not default a missing value to the active state. Update `BuildChildCommand` tests to assert exact child ID, generation, state file, and extension path wiring.

#### `root.go`: command wiring and child-success linkage

Register flags/output for `rotation-request`. Move reusable usage conversion helpers (`managerUsagePercent`, `managerUsageSample`) into `rotation.go` or leave them in `root.go` until Slice 3 removes compaction; avoid duplicate calculations.

After `completeHandoffContinuation` has persisted the replacement and confirmed:

```go
continuation.LaunchKind == ChildLaunchResumeHandoff
continuation.ContinuationOf == source.ID
continuation.ContinuationDeliveryID == intent.DeliveryID
```

call:

```go
launched = completeChildRotation(launched, source, *continuation, clock())
```

`completeChildRotation` is a no-op for generic/manual handoffs or mismatched IDs/generations. For a matching requested child rotation, set `SuccessorChildID`, preserve the exact source/handoff evidence, clear `LastError`, and set `successor_ready` before the existing validation-status write, wake delivery, and predecessor cleanup. Never launch from this helper.

Recovery through `recoverExistingHandoffContinuation` must also call the idempotent helper so a crash after replacement persistence but before rotation-state save converges from existing lineage.

#### `q_manager_child_extension.js`: completed-turn monitor

Retain the existing `agent_end` completion flow. Add a bounded `spawn` helper for `rotation-request --output json`, parse integer generation strictly, and install:

```js
pi.on("turn_end", async (_event, ctx) => {
  const usage = ctx.getContextUsage();
  if (!usage || usage.percent === null) return;
  const result = await requestRotation({
    stateFile: process.env.Q_MANAGER_STATE_FILE || "",
    childId: process.env.Q_MANAGER_CHILD_ID || "",
    childGeneration: Number(process.env.Q_MANAGER_CHILD_GENERATION || ""),
    sessionPath: ctx.sessionManager.getSessionFile() || "",
    usagePercent: usage.percent,
  });
  if (result?.requested === true && result.prompt) {
    pi.sendUserMessage(result.prompt, { deliverAs: "steer" });
  }
});

pi.on("session_before_compact", () => ({ cancel: true }));
```

Only cancel compaction in this generated managed-child extension. Unknown usage makes no CLI request and no steering message. The CLI's persisted pending record remains the authoritative duplicate guard; a JavaScript boolean may reduce calls but must not replace durable idempotency.

Use a one-megabyte stdout cap and resolve malformed/nonzero CLI responses to no steering while retaining process stderr in the existing child status diagnostics where practical. Never send follow-up delivery.

### Tests

#### `rotation_test.go`

Add table and transition tests for:

- default 75 config and explicit threshold override;
- absent/null, 74.9, and 75.0 usage;
- token/window percentage fallback;
- exact one request for duplicate `turn_end` callbacks;
- stale child ID, generation, or source session suppression;
- manager source binding and stale manager rejection;
- role-specific prompt contains exact state/rotation/node and child q-handoff instruction;
- generic handoff leaves rotation untouched;
- matching persisted continuation lineage marks only the requested child rotation `successor_ready`;
- restart recovery from existing continuation performs the same idempotent update.

#### `child_test.go`

Assert `BuildChildCommand` exports `Q_MANAGER_CHILD_GENERATION` from the persisted `ChildRunRef`, including incremented manual-rebind generations. Assert no empty/made-up generation is accepted by rotation-request.

#### `child_completion_test.go`

Extend a current guided handoff continuation fixture with a child rotation request. Assert one replacement child, matching `ContinuationOf`, `SuccessorChildID`, `successor_ready`, one wake, and predecessor cleanup. Repeat `RunChildComplete` and assert no second launch or phase regression. Keep a separate generic handoff case proving no rotation is required.

#### `integration_test.go`

Exercise the Cobra command with JSON output and explicit child identity. Verify invalid role/usage flags fail without usage text, and valid requests persist before output reports `requested: true`.

### Verify

```bash
gofmt -w cmd/vamos-runtime/internal/qrspicmd/{options.go,state.go,prompt_file.go,root.go,rotation.go,rotation_test.go,child.go,child_test.go,child_completion_test.go,integration_test.go}
node --check cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js
go test ./cmd/vamos-runtime/internal/qrspicmd
```

Regression checkpoint: existing graph-wide handoff, safe artifact, duplicate callback, wake delivery, and pending cleanup tests remain green.

### Commit Message

````text
feat(qrspi): add proactive child session rotation

Persist threshold-triggered child rotation requests at turn_end and route valid handoffs through the existing q-resume continuation lineage.

```yaml
qrspi_commit:
  plan: "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation"
  stage: "implement"
  slice: "1"
  summary: "Add idempotent 75% child handoff requests and link them to merged successor lineage."
  artifacts:
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/design.md"
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/outline.md"
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/plan.md"
```

````

______________________________________________________________________

## Slice 2: Manager operational handoff and same-pane fresh session

### Goal

Make manager rotation durable and exact: manager `turn_end` requests an operational handoff; settled completion validates final YAML and the in-plan artifact before one exact-pane `/new`; fresh `session_start(reason: "new")` claims only the persisted predecessor; kickoff injection starts the successor; `agent_start` acknowledges readiness and releases one current wake.

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/state.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/rotation.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/rotation_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go` (modify)
- `.pi/extensions/q-manager-parent.ts` (modify)
- `.pi/skills/q-manager-handoff/SKILL.md` (new)
- `.pi/skills/q-manager/SKILL.md` (modify)

### Changes

#### `options.go` / `state.go`: manager completion, claim, and convergent `/new` delivery

Add:

```go
type ManagerRotationCompleteOptions struct {
    StateFile   string
    RotationID string
    SessionPath string
    Output      string
}

type ManagerRotationClaimOptions struct {
    StateFile            string
    RotationID           string
    ManagerPane          string
    PreviousSessionPath  string
    SuccessorSessionPath string
    Output               string
}

type ManagerRotationClaimResult struct {
    Claimed bool   `json:"claimed"`
    Reason  string `json:"reason"`
    Kickoff string `json:"kickoff,omitempty"`
}
```

Extend `ManagerReadyOptions` with optional `RotationID` and `SessionPath`. General pane-recovery calls without a pending manager rotation remain valid; if a manager rotation is `replacing`, readiness must provide and match both fields.

To reuse current wake-delivery convergence for `/new`, add replacement-delivery evidence to `SessionRotation`:

```go
type RotationReplacementDelivery string

const (
    RotationPasteAndSubmit RotationReplacementDelivery = "paste_and_submit"
    RotationSubmitOnly     RotationReplacementDelivery = "submit_only"
)

ReplacementDelivery RotationReplacementDelivery `json:"replacementDelivery,omitempty"`
PastedPaneID        string                      `json:"pastedPaneId,omitempty"`
```

Persist `submit_only` immediately after a successful `/new` paste and before Enter. If Enter fails, a source-session retry submits the already-pasted command only when the same pane/source/rotation still match. Never paste `/new` twice. Once replacement submission succeeds, duplicate completion returns the existing replacing state and sends no keys.

#### `root.go`: new Cobra surfaces

Register:

```text
vamos qrspi manager-rotation-complete \
  --state-file <file> --rotation-id <id> --session-path <old-jsonl>

vamos qrspi manager-rotation-claim \
  --state-file <file> --rotation-id <id> --manager-pane <pane> \
  --previous-session-path <old-jsonl> --session-path <new-jsonl> --output json

vamos qrspi manager-ready \
  --state-file <file> --rotation-id <id> --session-path <new-jsonl> \
  --manager-pane <pane>
```

All state mutation uses the existing per-state operation lock. Keep raw commands usable for deterministic recovery/action cards.

#### `rotation.go`: manager result/artifact commit point

Define a dedicated parser, not a workflow transition:

```go
type ManagerHandoffResult struct {
    Stage    string `yaml:"stage"`
    Status   string `yaml:"status"`
    Outcome  string `yaml:"outcome"`
    Artifact string `yaml:"artifact"`
}

type ManagerHandoffFrontmatter struct {
    Stage       string `yaml:"stage"`
    Status      string `yaml:"status"`
    HandoffType string `yaml:"handoff_type"`
    RotationID string `yaml:"rotation_id"`
}
```

`RunManagerRotationComplete` must:

1. Lock/load and require the exact manager rotation ID, source session, source node, and `requested` phase. Permit only idempotent retry of an interrupted replacement for the same still-active source.
1. Read the last non-error/non-aborted assistant text from the exact source JSONL with `ExtractLastAssistantTextFromSession`.
1. Extract fenced `qrspi_result` YAML and require `stage: q-manager`, `status: handoff`, empty outcome, and one artifact.
1. Resolve the artifact with the existing symlink-safe `resolvePlanArtifact`, requiring a regular file inside the canonical mapped `handoffs/` directory.
1. Parse frontmatter and require `stage: q-manager`, `status: in_progress`, `handoff_type: q-manager-operational`, and exact rotation ID.
1. Marshal/store the validated manager result and real artifact path, then persist `handoff_ready`. No tmux action may occur before this save.
1. Set delivery status to `replacing`, preserve the manager pane, persist `replacing` plus replacement-delivery intent, then target exactly that pane with `/new` and Enter using the convergent paste/submit state above.
1. On validation failure, leave the source active and phase `requested` with `LastError`; on tmux failure, retain validated handoff/source/replacement evidence and write a precise action card. Never compact or fabricate YAML.

The manager request prompt returned from `requestSessionRotation` must identify the exact rotation and instruct the current manager to stop normal orchestration, read `.pi/skills/q-manager-handoff/SKILL.md`, write the operational artifact, and emit its final manager handoff YAML. It must not ask the manager to run `/new`; the CLI owns replacement only after validation.

#### `rotation.go`: strict fresh-session claim

`RunManagerRotationClaim` locks and calls a pure helper:

```go
func claimManagerSuccessor(state ManagerState, opts ManagerRotationClaimOptions, now time.Time) (ManagerState, ManagerRotationClaimResult, error)
```

Require:

- phase `replacing` and exact rotation ID;
- exact stored manager/delivery pane;
- `PreviousSessionPath` equals persisted `SourceSessionPath` after path normalization;
- non-empty successor JSONL differs from source;
- no different successor has already claimed the rotation.

A matching claim stores `SuccessorSessionPath` and `ManagerSessionPath` but keeps phase/delivery `replacing`. Return an exact kickoff containing the canonical q-manager skill read, exact operational handoff read, current graph node, state file as a clearly local ref, and instruction to continue manager orchestration from the handoff. A duplicate claim by the same successor returns the same kickoff; a different predecessor/successor never injects.

Do not mark `successor_ready` from claim. If extension injection throws, persisted source/successor/handoff refs remain, delivery remains queued, and rerunning the printed `manager-rotation-claim` command returns the same kickoff for manual injection.

#### `root.go`: rotation-aware readiness and wake queueing

Change `queueOrDeliverWake` to queue with `manager_replacing` while delivery status is `replacing`. In `RunManagerReady`, before pane adoption/flush:

- if a manager rotation is replacing, require exact rotation ID, exact claimed successor session, and exact pane;
- then set manager rotation `successor_ready`, clear `LastError`, set `ManagerSessionPath` to successor, and set delivery `ready`;
- flush at most one lineage-current queued wake with existing generation/submit-only rules;
- clean a pending predecessor child only after queued delivery is gone.

A stale old manager, unrelated `/new`, or duplicate ready call cannot advance or flush a newer rotation.

#### `.pi/extensions/q-manager-parent.ts`: bind, monitor, claim, inject, acknowledge

Replace command-time compaction logic with one lifecycle controller. Keep conversational `/q-manager` behavior.

1. Parse the stable `state: <path>` line from successful `start-next` output. For `continue`, also extract explicit `--state-file`. Store the binding in module state and `process.env.Q_MANAGER_STATE_FILE`; never bind in a managed child (`Q_MANAGER_CHILD_ID` set).
1. Remove live usage flags from `start-next|continue`; proactive sampling belongs to `turn_end`.
1. At manager `turn_end`, call `rotation-request --role manager` with current JSONL and usage percentage. On `requested`, persist `Q_MANAGER_ROTATION_ID` in process environment and send the returned prompt as steering exactly once.
1. At `agent_settled`, when a rotation ID is pending for the current JSONL, call `manager-rotation-complete`. Do not call `ctx.compact()`.
1. At fresh `session_start`, only for `reason === "new"`, call `manager-rotation-claim` with `event.previousSessionFile`, `process.env.TMUX_PANE`, and `ctx.sessionManager.getSessionFile()`. On `claimed`, use `pi.sendUserMessage(result.kickoff)` from the fresh extension instance. Never paste kickoff behind `/new`.
1. At the fresh successor's first `agent_start`, call `manager-ready` with rotation ID, successor session, and pane. Clear only the process-env rotation ID after successful acknowledgement.
1. Cancel `session_before_compact` only when this process is bound as a manager or managed child. Unmanaged ordinary Pi sessions must retain normal Pi behavior.

Use `pi.exec` or the existing bounded `execFile` helper consistently; all CLI JSON is typed and parsed defensively. A CLI failure records/notifies recovery but does not silently clear the binding or rotation ID.

Type-check against `@earendil-works/pi-coding-agent`: `session_start.previousSessionFile` is the mandatory predecessor claim, and event handlers may call `pi.sendUserMessage`; no command-only `ctx.newSession()` or upstream API is needed.

#### `.pi/skills/q-manager-handoff/SKILL.md`: dedicated stop-work contract

Create a focused skill with no normal stage reasoning. It must:

- enter stop-work mode immediately;
- read current state/result only enough to write one artifact;
- use metadata from `spec_metadata.sh`;
- write under the canonical plan `handoffs/` directory;
- include durable refs separately from local/ephemeral refs;
- require frontmatter:

```yaml
stage: q-manager
status: in_progress
handoff_type: q-manager-operational
rotation_id: <exact request id>
```

Required body fields:

- durable plan path, current node, latest canonical QRSPI result/artifact, operational handoff path;
- local state file, source cwd, manager run/pane/source JSONL;
- active child ID/stage/generation/pane/session/output/status/done/validation refs;
- waiting/queued-delivery state;
- exact successor instruction: read q-manager skill and this handoff, then continue the wake-driven manager loop.

Final response is fenced YAML with top-level `qrspi_result`, `stage: q-manager`, `status: handoff`, no outcome, and primary artifact equal to this handoff. Local refs never become structured durable YAML fields.

#### `.pi/skills/q-manager/SKILL.md`: successor semantics

Replace the compaction/manual-ready section with:

- manager binding begins after successful `/q-manager start-next|continue`;
- 75% `turn_end` steering invokes the dedicated manager handoff skill;
- validated replacement is same-pane `/new`;
- fresh session claim/injection and first `agent_start` readiness are automatic;
- predecessor JSONL remains inspectable;
- action-card/raw CLI recovery is used for failed replacement/claim/injection;
- never issue a duplicate continuation while child handoff auto-resume is already active.

### Tests

#### `rotation_test.go`

Add focused fake-state/fake-tmux tests:

- missing/malformed manager result leaves phase requested and sends no keys;
- artifact outside plan, symlink escape, wrong frontmatter stage/type/rotation, outcome present, and mismatched source session all reject before `/new`;
- valid handoff persists `handoff_ready` then `replacing` and sends `/new` plus Enter to the exact stored pane;
- paste success/submit failure persists `submit_only`; retry sends only Enter;
- duplicate completion after successful submission sends no additional keys;
- claim rejects wrong pane, wrong `previousSessionFile`, same source/successor path, and second different successor;
- matching claim stores successor JSONL and returns deterministic kickoff without readiness;
- duplicate same-successor claim returns the same kickoff;
- manager-ready rejects source session/stale rotation, accepts the claimed successor once, and is idempotent after `successor_ready`;
- failed `/new`, claim, or readiness preserves source, handoff, successor (when known), queued wake, and actionable error evidence.

#### `delivery_test.go`

Rename compacting fixtures to replacing. Assert child wake queues throughout manager handoff/replacement/claim and flushes only after matching successor `manager-ready`. Keep current pane-unavailable, submit-only, duplicate-delivery, stale-generation, and pending-cleanup coverage.

#### `integration_test.go`

Exercise complete/claim/ready Cobra parsing and JSON output. Verify `--previous-session-path` is required and reaches the strict claim check. Add one command-level happy path from manager session JSONL + artifact through fake tmux replacement and fresh claim.

#### Extension verification

Type-check the extension directly because root `tsconfig.json` does not include `.pi/extensions`:

```bash
pnpm exec tsc --noEmit --target ES2022 --module ES2022 --moduleResolution bundler --strict --skipLibCheck .pi/extensions/q-manager-parent.ts
```

Then run a controlled Pi smoke test in Slice 3; Go tests alone cannot prove runtime reload ordering.

### Verify

```bash
gofmt -w cmd/vamos-runtime/internal/qrspicmd/{options.go,state.go,root.go,rotation.go,rotation_test.go,delivery_test.go,integration_test.go}
pnpm exec tsc --noEmit --target ES2022 --module ES2022 --moduleResolution bundler --strict --skipLibCheck .pi/extensions/q-manager-parent.ts
go test ./cmd/vamos-runtime/internal/qrspicmd
```

### Commit Message

````text
feat(qrspi): rotate manager sessions through durable handoff

Validate manager operational handoffs before exact-pane /new, then claim and start only the fresh session descended from the persisted source JSONL.

```yaml
qrspi_commit:
  plan: "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation"
  stage: "implement"
  slice: "2"
  summary: "Add validated same-pane manager replacement with strict predecessor claim and queued-wake readiness."
  artifacts:
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/design.md"
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/outline.md"
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/plan.md"
```

````

______________________________________________________________________

## Slice 3: Remove native compaction, document recovery, and verify repeated rotation

### Goal

Delete the superseded fixed-90% command-time compaction path and terminology, make fresh-session rotation the only managed continuation mechanism, update operator/agent guidance, and prove repeated manager/child rotation in controlled tmux without pane accumulation or stale ownership.

### Files

- `cmd/vamos-runtime/internal/qrspicmd/options.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/state.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/root.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/manager_compaction_test.go` (delete)
- `cmd/vamos-runtime/internal/qrspicmd/rotation_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/child_completion_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/delivery_test.go` (modify)
- `cmd/vamos-runtime/internal/qrspicmd/integration_test.go` (modify)
- `.pi/extensions/q-manager-parent.ts` (modify)
- `.pi/skills/q-manager/SKILL.md` (modify)
- `.pi/skills/q-handoff/SKILL.md` (modify)
- `.pi/skills/q-manager-handoff/SKILL.md` (modify if smoke-test wording reveals gaps)
- `docs/q-manager.md` (modify)

### Changes

#### Go runtime cleanup

Delete:

- `managerCompactionThresholdPercent`;
- `ManagerCompactionStatus` and `ManagerCompactionOptions`;
- command-time usage fields/flags from `StartNextOptions`, `ContinueOptions`, `start-next`, and `continue`;
- `maybeStartManagerCompaction`, `writeCompactionDiagnostic`, `writeManagerOperationalHandoff`, and old compaction handoff builders;
- both calls made after child launch;
- `compacting`, `manager_compacting`, `q-manager-parent-compact: started`, and native-compaction action-card language;
- `LastManagerUsage` if no longer referenced outside the rotation record.

Retain the usage input/sample helper in `rotation.go` for proactive manager and child requests. Retain `manager-ready` for rotation acknowledgement and general queued-delivery recovery. Delivery statuses become `replacing` and `ready`; rotation phases remain the detailed source of truth.

Delete `manager_compaction_test.go`. Move still-valid usage math, queue-before-replacement, exact-once flush, and readiness assertions into `rotation_test.go` / `delivery_test.go`; do not lose coverage under a rename.

Add grep assertions or explicit tests ensuring no production path invokes native `ctx.compact()` and no Go output emits the old stable signal.

#### Parent/child extension cleanup

Remove `QManagerCompactionSignal`, `parseCompactionSignal`, `compactParent`, command-time usage flag injection, and every `ctx.compact()` call from `.pi/extensions/q-manager-parent.ts`.

Managed parent and generated child extensions cancel `session_before_compact`; cancellation is scoped to bound q-manager roles. Provider overflow remains a terminal provider error handled by existing recovery cards. Do not add compaction fallback.

#### Skills and docs

Update `.pi/skills/q-handoff/SKILL.md` manager-operational sections to route only through `.pi/skills/q-manager-handoff/SKILL.md`. Remove references to auto-compaction handoffs and manual post-compaction readiness.

Update `docs/q-manager.md` and `.pi/skills/q-manager/SKILL.md` with:

- default/configurable 75% completed-turn policy;
- usage is estimated and unknown usage does not trigger;
- steering runs after the full tool batch;
- child flow: q-handoff -> existing q-resume successor -> durable wake -> old-pane cleanup;
- manager flow: operational handoff -> validation -> exact-pane `/new` -> predecessor-authenticated claim -> kickoff -> ready/flush;
- source and successor JSONL inspection commands;
- phase meanings and action-card recovery for handoff, `/new`, claim, injection, and readiness failures;
- same-pane manager means no manager pane growth; child predecessor closes only after successor/wake durability;
- no aggregate tool-output cap and no mathematical guarantee against one extreme batch;
- no native managed compaction or fabricated QRSPI result.

Keep `manager-ready --state-file ... --manager-pane ...` documented for pane-unavailable queued-delivery recovery when no manager rotation is pending. For a pending manager rotation, document required `--rotation-id` and `--session-path` ownership proof.

### Tests

Update all old compaction-named tests/fixtures and expected strings. Preserve these cases:

- queue while manager is replacing;
- exact one flush after matching successor readiness;
- pane adoption only when safe;
- stale generation suppression;
- delivery paste/submit retry convergence;
- provider-context error never advances graph or fabricates YAML.

Add production-source grep checks in test or verification:

```bash
! rg -n 'ctx\.compact\(|q-manager-parent-compact|manager_compacting|manager compaction|compacting' \
  .pi/extensions/q-manager-parent.ts \
  cmd/vamos-runtime/internal/qrspicmd \
  .pi/skills/q-manager/SKILL.md \
  .pi/skills/q-handoff/SKILL.md \
  docs/q-manager.md
```

### Controlled tmux verification

Run from the prepared implementation workspace with `VAMOS_PACKAGE_ROOT="$PWD"` so the stable launcher builds this checkout. Use a disposable test plan/state, a dedicated tmux session, and a threshold low enough to trigger predictably. Never point the story at a canonical main manager state.

#### Child story

1. Start a dedicated manager pane and launch one long-running agent node with `--rotation-threshold-percent 1`.
1. Observe one persisted child rotation request and one steering prompt only after a completed tool batch.
1. Let the child emit a valid exact-stage handoff. Confirm `RunChildComplete` creates one fresh q-resume child with `ContinuationOf=<source>`, records `successor_ready`, delivers/queues one wake, then closes the predecessor pane.
1. Before a second automatic cycle can run indefinitely, raise the existing state's threshold to `99` through `start-next --state-file ... --rotation-threshold-percent 99`; active-child protection must remain intact.
1. Inspect both JSONLs and handoff artifact; confirm no fabricated complete result and no extra child pane.
1. Repeat once by lowering the threshold again, then restore 99 and confirm lineage moves forward exactly once.

#### Manager story

1. In a separate disposable manager run, bind the parent with `/q-manager start-next ... --rotation-threshold-percent 1`.
1. Confirm manager steering writes one operational handoff and final `stage: q-manager`, `status: handoff` YAML.
1. Observe same pane ID before/after, different JSONL, fresh `session_start` claim whose `previousSessionFile` equals source, and automatic kickoff.
1. Arrange a child wake during `replacing`; confirm it stays queued until the successor's first `agent_start` calls matching `manager-ready`, then appears once as steering.
1. Raise threshold to 99, inspect predecessor/successor JSONLs, then repeat one controlled manager rotation. Pane count must remain stable.
1. Exercise one mismatched-predecessor claim from the CLI and confirm no kickoff/readiness/wake flush.

Capture commands, pane IDs, state excerpts, JSONL paths, and outcomes in the final implementation handoff or `context/implement/` evidence. Kill only the disposable tmux session after evidence is saved.

### Verify

```bash
gofmt -w cmd/vamos-runtime/internal/qrspicmd/{options.go,state.go,root.go,rotation.go,rotation_test.go,child_completion_test.go,delivery_test.go,integration_test.go}
node --check cmd/vamos-runtime/internal/qrspicmd/assets/q_manager_child_extension.js
pnpm exec tsc --noEmit --target ES2022 --module ES2022 --moduleResolution bundler --strict --skipLibCheck .pi/extensions/q-manager-parent.ts
go test ./cmd/vamos-runtime/internal/qrspicmd
go test -race ./cmd/vamos-runtime/internal/qrspicmd
go vet ./cmd/vamos-runtime/internal/qrspicmd
just build --no-restart
! rg -n 'ctx\.compact\(|q-manager-parent-compact|manager_compacting|manager compaction|compacting' \
  .pi/extensions/q-manager-parent.ts \
  cmd/vamos-runtime/internal/qrspicmd \
  .pi/skills/q-manager/SKILL.md \
  .pi/skills/q-handoff/SKILL.md \
  docs/q-manager.md
```

Run the controlled child and manager tmux stories after deterministic checks pass. Do not use plain `just build`; this verification must not restart a configured service.

### Commit Message

````text
refactor(qrspi): remove native compaction rotation

Make durable fresh-session handoff rotation the only managed continuation path and document deterministic replacement recovery.

```yaml
qrspi_commit:
  plan: "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation"
  stage: "implement"
  slice: "3"
  summary: "Delete fixed-90% compaction behavior and verify repeated manager/child fresh-session rotation."
  artifacts:
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/design.md"
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/outline.md"
    - "thoughts/CoreyCole/plans/2026-07-14_12-21-37_q-manager-session-handoff-rotation/plan.md"
```

````

______________________________________________________________________

## Final acceptance checklist

- [ ] Both managed roles request at completed `turn_end`, default 75%, steering only.
- [ ] Unknown usage creates no request and no guessed percentage.
- [ ] Child generation/session ownership is exact and exported from persisted state.
- [ ] Child completion reuses one merged q-resume continuation and cleanup transaction.
- [ ] Manager result and operational artifact validate before any `/new` input.
- [ ] `/new` paste/submit is convergent and never duplicated.
- [ ] Fresh manager claim matches pane, rotation ID, and Pi `event.previousSessionFile` exactly.
- [ ] Kickoff injection occurs only from fresh `session_start`; readiness only from successor `agent_start`.
- [ ] Wakes queue during replacement and flush once for current lineage.
- [ ] Managed parent/child compaction is cancelled; no native compaction fallback remains.
- [ ] Focused, race, vet, no-restart build, and two-cycle controlled tmux evidence pass.
- [ ] Predecessor JSONLs/handoffs remain inspectable and pane count does not grow.

```
```
