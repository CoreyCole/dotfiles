---
date: 2026-07-16T17:11:25-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: 4f9dd2f8bac86d49e6a039b55a25a6e862cef00e
branch: main
repository: vamos
stage: research
ticket: q-manager concurrent wake cross-routing bug
plan_dir: thoughts/CoreyCole/plans/2026-07-15_15-17-01_q-manager-wake-cross-routing
project: github.com/CoreyCole/vamos
related_projects: []
question_doc: thoughts/CoreyCole/plans/2026-07-15_15-17-01_q-manager-wake-cross-routing/questions/2026-07-16_17-08-11_q-manager-wake-cross-routing.md
---

# Research: q-manager Wake Cross-Routing

## Brainstorm Summary

- Desired outcome: explain payload-to-pane cross-routing and the companion unreplaced-child symptom under concurrent q-manager operation.
- Scope: all q-manager traffic using the common tmux paste primitive—wakes, queued wakes, steering, and reprompts.
- Established correctness boundary: payload-to-pane pairing under arbitrary concurrent injections sharing one tmux server.
- Preserve multiline atomic prompt behavior; distinguish manager state/lock isolation from tmux transport isolation.
- No implementation approach is selected in this research.

## Research Question

Answer all questions in `questions/2026-07-16_17-08-11_q-manager-wake-cross-routing.md`, plus trace the subsequently reported symptom where a completed child pane remains open rather than being closed and replaced.

## Evidence Boundary

`AGENTS.md` and the question doc supplied framing only. Findings below come from current source, tests, the local tmux 3.6a manual, and a bounded isolated-tmux reproduction recorded at `context/research/tmux-buffer-semantics.txt`.

## Summary

Manager JSON state is separated by repository, canonical plan directory, and manager run ID. Different plan directories receive different state/lock directories; concurrent managers for the exact same canonical plan are rejected while the persisted 12-hour lock remains active (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:53-66`, `cmd/vamos-runtime/internal/qrspicmd/state_store.go:90-128`).

The text transport is not separated. Every production `PasteText` call writes its payload to the same tmux-server-global named buffer `q-manager-wake`, then reads that buffer in a second tmux command to paste into an exact pane (`cmd/vamos-runtime/internal/qrspicmd/tmux.go:39-46`). A deterministic isolated-tmux run reproduced the harmful interleaving: A set `WAKE_FROM_A`, B overwrote it with `WAKE_FROM_B`, then A pasted into pane A and pane A displayed `WAKE_FROM_B` (`context/research/tmux-buffer-semantics.txt:50-82`).

The unreplaced-child symptom follows from this failure mode. A's wake can be lost while B's wake is delivered to both B and A; A's state is therefore never continued. If manager A follows the foreign wake's state file, `continue` detects that B's recorded live manager pane differs from A's current pane and stops with `manager_pane_adoption_required` before validation, transition, next-child launch, or cleanup (`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go:99-115`, `cmd/vamos-runtime/internal/qrspicmd/root.go:3026-3045`). Child cleanup only occurs after a graph decision marks the old child pending, a replacement starts, and the old pane is killed (`cmd/vamos-runtime/internal/qrspicmd/root.go:3383-3389`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1460-1514`, `cmd/vamos-runtime/internal/qrspicmd/root.go:4129-4165`).

## Detailed Findings

### 1. State-file and lock isolation

`CanonicalPlanDir` joins a relative plan path to `projectRoot`, converts it to an absolute path, and cleans it; `RepoID` similarly converts the project root to a cleaned absolute path (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:31-51`). The state/lock key is SHA-256 over `RepoID + NUL + CanonicalPlanDir` (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:53-59`).

A state file is `<state-root>/<key-hash>/<manager-run-id>.json`; the lock is `<state-root>/<key-hash>/lock.json` (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:61-67`). Manager run IDs contain local timestamp through nanoseconds (`cmd/vamos-runtime/internal/qrspicmd/root.go:4081-4083`). Thus:

- Same checkout, different canonical plan directories: different key hashes, lock files, and state directories (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:53-67`).
- Exact same repository and canonical plan directory: same lock path, while each accepted run would have its own run-ID state filename (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:61-67`).

Initialization acquires the key lock before saving manager state (`cmd/vamos-runtime/internal/qrspicmd/root.go:588-603`; `cmd/vamos-runtime/internal/qrspicmd/prompt_file.go:68-81`). `AcquireLock` serializes lock-file inspection with `flock`; a different owner receives `LockConflictError` while `ExpiresAt` is in the future, and an expired lock may be replaced (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:90-128`). The default TTL is 12 hours (`cmd/vamos-runtime/internal/qrspicmd/state_store.go:16`).

Tests cover canonical path cleaning, separate state-root placement, same-owner reacquisition, different-owner rejection, expiry replacement, and four simultaneous owners contending for one key (`cmd/vamos-runtime/internal/qrspicmd/state_store_test.go:41-171`). The manager integration test also verifies a preexisting owner blocks `RunInit` for the same key (`cmd/vamos-runtime/internal/qrspicmd/integration_test.go:158-178`).

### 2. Payload-to-pane data flows

#### Direct and queued wakes

`RunChildComplete` loads the explicit state file, requires its active child, and rejects a requested child ID that differs from that state's active child (`cmd/vamos-runtime/internal/qrspicmd/root.go:1557-1583`). Valid and retry-exhausted results receive a delivery ID and enter `queueOrDeliverWake` (`cmd/vamos-runtime/internal/qrspicmd/root.go:1623-1644`, `cmd/vamos-runtime/internal/qrspicmd/root.go:1691-1719`).

`queueOrDeliverWake` suppresses missing/duplicate delivery IDs, constructs the wake payload, queues during compaction or absent/unavailable manager panes, otherwise selects the delivery pane and calls `pasteWake` (`cmd/vamos-runtime/internal/qrspicmd/root.go:1946-2021`). Pane selection prefers `Delivery.ManagerPaneID`, then `ManagerPaneID` (`cmd/vamos-runtime/internal/qrspicmd/root.go:2039-2044`). `pasteWake` calls `PasteText` and then sends Enter to the same pane (`cmd/vamos-runtime/internal/qrspicmd/root.go:2053-2063`).

The wake payload embeds stage/status/outcome/artifact, child ID, originating state file, policy, summaries, next-child context, and the continuation command for that state file (`cmd/vamos-runtime/internal/qrspicmd/root.go:2079-2128`). Queued wakes preserve delivery ID, child ID/generation, and the full payload in state (`cmd/vamos-runtime/internal/qrspicmd/root.go:2024-2036`; `cmd/vamos-runtime/internal/qrspicmd/state.go:25-39`). `manager-ready` later flushes through the same `pasteWake` path (`cmd/vamos-runtime/internal/qrspicmd/root.go:2492-2535`).

#### Reprompts and steering

`RunRepromptChild` loads the supplied state file, validates active-child stage and pane, builds the correction prompt, then calls `PasteText` and sends Enter to the active child's pane (`cmd/vamos-runtime/internal/qrspicmd/root.go:2789-2843`). `RunSteerChild` likewise loads state, validates the active child and optional stage, then calls `PasteText` and sends Enter to that child's pane (`cmd/vamos-runtime/internal/qrspicmd/root.go:2845-2902`).

#### Initial child prompt

Initial stage prompts do not pass through `PasteText`: `RunChild` writes/uses a prompt file and starts Pi with `@<prompt-file>` in a newly split pane (`cmd/vamos-runtime/internal/qrspicmd/root.go:1426-1456`; `cmd/vamos-runtime/internal/qrspicmd/child.go:106-168`).

### 3. Shared resources and harmful interleaving

`ShellTmuxClient.PasteText` always executes:

1. `tmux set-buffer -b q-manager-wake <text>`
1. `tmux paste-buffer -p -r -b q-manager-wake -t <pane-id>`

as two separate child processes (`cmd/vamos-runtime/internal/qrspicmd/tmux.go:39-46`, `cmd/vamos-runtime/internal/qrspicmd/tmux.go:76-82`). There is no mutex, process lock, run ID, child ID, delivery ID, or pane ID in the buffer name (`cmd/vamos-runtime/internal/qrspicmd/tmux.go:43-46`).

The concrete harmful ordering is:

1. Process A sets `q-manager-wake` to payload A.
1. Process B sets the same buffer to payload B.
1. Process A pastes the current buffer into pane A.
1. Pane A receives payload B even though A's pane target was correct.

The isolated reproduction performed exactly that ordering across two sessions on one temporary tmux server; pane A captured `WAKE_FROM_B`, and `list-buffers` showed the one global named buffer containing B (`context/research/tmux-buffer-semantics.txt:50-82`).

The same race applies to wake-vs-wake, wake-vs-steer, wake-vs-reprompt, steer-vs-reprompt, and same-kind concurrent calls because all reach the same production method (`cmd/vamos-runtime/internal/qrspicmd/root.go:2053-2063`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2827-2839`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2882-2894`).

### 4. tmux semantics used by q-manager

The local runtime is tmux 3.6a (`context/research/tmux-buffer-semantics.txt:1-2`). Its local manual describes buffers as global, says explicitly named buffers are not subject to automatic `buffer-limit` deletion, and describes `set-buffer` as setting/overwriting the named buffer (`context/research/tmux-buffer-semantics.txt:5-17`, `context/research/tmux-buffer-semantics.txt:37-48`).

The manual says `paste-buffer -t` inserts the selected buffer into the specified pane; `-r` preserves LF rather than replacing it with CR, and `-p` adds bracketed-paste controls when the application requests bracketed paste mode (`context/research/tmux-buffer-semantics.txt:26-36`). These flags preserve the multiline payload behavior after buffer selection; they do not couple the preceding `set-buffer` command to the later `paste-buffer` command (`cmd/vamos-runtime/internal/qrspicmd/tmux.go:43-46`).

Because the buffer list is global to the tmux server, windows and sessions on that server share the named buffer. The two-session reproduction observed the same buffer from both manager sessions (`context/research/tmux-buffer-semantics.txt:50-82`).

### 5. Tests and missing scenarios

Current tests establish:

- Exact `-t <pane>` arguments and the fixed `q-manager-wake` name, serially (`cmd/vamos-runtime/internal/qrspicmd/tmux_test.go:29-38`).
- One ready wake, duplicate suppression, queue/flush, unavailable-pane queueing, manager-pane adoption, and stale queued-wake supersession through an in-memory `recordingTmux` (`cmd/vamos-runtime/internal/qrspicmd/delivery_test.go:11-388`).
- Reprompt payload and pane selection through `recordingTmux` (`cmd/vamos-runtime/internal/qrspicmd/reprompt_test.go:81-144`).
- End-to-end validated wake flow, next-child launch, and old-pane cleanup through fakes (`cmd/vamos-runtime/internal/qrspicmd/integration_test.go:249-364`, `cmd/vamos-runtime/internal/qrspicmd/integration_test.go:520-558`).
- Concurrent acquisition of one manager lock key (`cmd/vamos-runtime/internal/qrspicmd/state_store_test.go:142-171`).
- Live manager-pane mismatch stops `continue` with an adoption action card (`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go:197-235`).

Repository search found no test that concurrently invokes the production `ShellTmuxClient.PasteText`, forces an interleaving between its two tmux commands, checks two payloads against two panes, or mixes wake/steer/reprompt traffic. `recordingTmux.PasteText` records `(pane,text)` as one in-memory operation, so tests above the transport boundary cannot expose the named-buffer overwrite (`cmd/vamos-runtime/internal/qrspicmd/reprompt_test.go:13-58`).

### 6. Incident diagnostics and observability

A pasted wake is self-identifying: it carries `child_id`, `state_file`, result metadata, and an exact continue command (`cmd/vamos-runtime/internal/qrspicmd/root.go:2088-2128`). Manager state separately records manager/delivery pane IDs, queued payload identity, last delivery ID, active-child pane/session/status paths, and active-child last delivery ID (`cmd/vamos-runtime/internal/qrspicmd/state.go:7-58`). Validation status is written per child after completion (`cmd/vamos-runtime/internal/qrspicmd/root.go:1725-1735`). These fields can show that pane A's transcript contains a wake naming state/child B.

They cannot prove that production `PasteText` pasted the intended bytes. After `PasteText` returns, `queueOrDeliverWake` records the intended status delivery ID as delivered without recording the buffer name/content observed by `paste-buffer` or a payload-to-target transport event (`cmd/vamos-runtime/internal/qrspicmd/root.go:2017-2021`). The fixed buffer itself retains only the most recently set content (`context/research/tmux-buffer-semantics.txt:37-48`, `context/research/tmux-buffer-semantics.txt:81-82`).

Pane-selection failures and content-substitution failures therefore leave different evidence:

- Wrong pane selection: state pane IDs/current pane/liveness can disagree, and pane-adoption diagnostics include stored, delivery, and current panes (`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go:235-269`).
- Correct target with wrong content: destination pane may match state A, but the text inside it names state/child B; A's state may still record A's delivery ID as delivered (`cmd/vamos-runtime/internal/qrspicmd/root.go:2017-2021`, `cmd/vamos-runtime/internal/qrspicmd/root.go:2088-2128`).

### 7. Companion unreplaced-child symptom

For a valid graph transition, `decideValidatedResult` marks the current child as pending cleanup (`cmd/vamos-runtime/internal/qrspicmd/root.go:3376-3389`). `RunChild` starts and saves the replacement first, then kills the pending old pane, selects a layout around the new pane, clears pending cleanup, and saves again (`cmd/vamos-runtime/internal/qrspicmd/root.go:1460-1514`, `cmd/vamos-runtime/internal/qrspicmd/root.go:4136-4165`). Tests explicitly require cleanup after successful replacement and preservation of the old pane when replacement start fails (`cmd/vamos-runtime/internal/qrspicmd/child_test.go:237-317`).

With the reproduced transport interleaving, A's wake is overwritten and never reaches manager A. No `continue` runs against state A, so its completed active child is never marked pending and no replacement/cleanup runs. If manager A instead follows foreign wake B, `RunContinue` compares B's stored live manager pane with current pane A; the live conflict produces an action card and returns before active-child validation or transition (`cmd/vamos-runtime/internal/qrspicmd/root.go:3026-3045`, `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go:99-115`). The test for this path leaves the recorded manager pane unchanged and writes `manager_pane_adoption_required` (`cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption_test.go:197-235`).

A separate targeting discrepancy exists in replacement launch plumbing: `RunChild` computes and stores `ChildRunRequest.ParentPaneID` (`cmd/vamos-runtime/internal/qrspicmd/root.go:1416-1455`), but `TmuxChildRunner` converts the request to a `TmuxSplitRequest` containing only cwd/direction/command (`cmd/vamos-runtime/internal/qrspicmd/child.go:179-187`), and production `SplitPane` targets `os.Getenv("TMUX_PANE")` rather than `ChildRunRequest.ParentPaneID` (`cmd/vamos-runtime/internal/qrspicmd/tmux.go:13-18`). Under normal invocation those values are expected to identify the same manager pane; after cross-routed operator action or explicit pane rebinding, they can differ.

## Code References

- `cmd/vamos-runtime/internal/qrspicmd/state_store.go:16-128` — state root, canonical identities, key hash, paths, and persisted lock behavior.
- `cmd/vamos-runtime/internal/qrspicmd/state.go:7-70` — manager, delivery, queued-wake, active-child, and lock fields.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:1557-1735` — child completion validation and wake dispatch.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:1946-2128` — wake queueing, pane selection, delivery, and payload.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2789-2902` — reprompt and steering delivery.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:2999-3158` — continue flow and early pane-adoption stop.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:3376-3428` — pending-cleanup decision and next-child launch.
- `cmd/vamos-runtime/internal/qrspicmd/root.go:4129-4165` — old-child pane cleanup after replacement.
- `cmd/vamos-runtime/internal/qrspicmd/tmux.go:13-46` — split targeting and production shared-buffer paste transport.
- `cmd/vamos-runtime/internal/qrspicmd/manager_pane_adoption.go:39-132` — manager pane matching, adoption, and live-conflict stop.
- `context/research/tmux-buffer-semantics.txt:1-82` — local tmux manual evidence and deterministic cross-routing reproduction.

## Historical Context

None requested or used.

## Surprises

- State files are separate, but all processes converge on one explicit tmux-server-global buffer name between two commands (`cmd/vamos-runtime/internal/qrspicmd/tmux.go:39-46`).
- The exact pane target test passes while payload identity can still be wrong; target correctness and content correctness are independent at this boundary (`cmd/vamos-runtime/internal/qrspicmd/tmux_test.go:29-38`, `context/research/tmux-buffer-semantics.txt:50-82`).
- The reported unreplaced-child pane is consistent with the wake being lost or a foreign-state continuation stopping at the existing manager-pane conflict guard before cleanup (`cmd/vamos-runtime/internal/qrspicmd/root.go:3026-3045`, `cmd/vamos-runtime/internal/qrspicmd/root.go:4129-4165`).
- Replacement launch carries a parent pane in `ChildRunRequest`, but production split targeting reads the invoking process's `TMUX_PANE` instead (`cmd/vamos-runtime/internal/qrspicmd/root.go:1416-1455`, `cmd/vamos-runtime/internal/qrspicmd/tmux.go:13-18`).

## Open Questions

- The specific incident's pane transcripts and state files were not provided, so research cannot determine whether its exact ordering duplicated B's wake into both panes, swapped two payloads, or mixed wake traffic with steering/reprompt traffic.
- The specific incident's state age was not provided, so research cannot determine whether any exact-plan lock had expired; this is unnecessary for the reproduced cross-plan transport failure.
