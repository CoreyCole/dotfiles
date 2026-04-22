---
date: 2026-04-19T12:28:58-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: 4d68d114259d3838cd99620291985a662dd4b048
branch: main
repository: cn-agents
stage: plan
ticket: "pkg/agents standalone SDK: SQLite-backed Pi session tree + Temporal/Datastar chat revive/fork demo"
plan_dir: "thoughts/creative-mode-agent/plans/2026-04-19_01-47-47_pkg-agents-sdk-pi-temporal-datastar-chat"
---

# Implementation Plan: SQLite-backed Pi Session Tree Chat

## Status
- [ ] Slice 1: New thread + first completed turn
- [ ] Slice 2: Resume latest head in a brand-new workflow
- [ ] Slice 3: Fork from an earlier message with shared ancestry
- [ ] Slice 4: Right-hand artifact pane with run-scoped file tree

## Slice 1: New thread + first completed turn

### Files
- `db/migrations/schema.sql` (modify)
- `db/queries/agent_threads.sql` (new)
- `db/queries/agent_entries.sql` (new)
- `db/queries/agent_runs.sql` (new)
- `pkg/agents/conversation/types.go` (new)
- `pkg/agents/workflows/conversation/workflow.go` (new)
- `pkg/agents/temporal/manager.go` (modify)
- `pkg/agents/temporal/workers/ts/types.ts` (modify)
- `pkg/agents/temporal/workers/ts/conversation.ts` (new)
- `pkg/agents/temporal/workers/ts/activities.ts` (modify)
- `pkg/agents/temporal/workers/ts/worker.ts` (modify)
- `server/services/agentchat/args.go` (new)
- `server/services/agentchat/notifier.go` (new)
- `server/services/agentchat/service.go` (new)
- `server/services/agentchat/handler.go` (new)
- `server/services/agentchat/page_chat.templ` (new)
- `server/services/agentchat/templates.templ` (new)
- `server/services/agentchat/service_test.go` (new)
- `server/services/agentchat/handler_test.go` (new)
- `main.go` (modify)

### Changes

**`db/migrations/schema.sql`** (modify): append the new conversation graph tables after the existing pipeline tables.

```sql
CREATE TABLE IF NOT EXISTS agent_threads (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    cwd TEXT NOT NULL,
    lineage_id TEXT NOT NULL,
    head_entry_id TEXT,
    parent_thread_id TEXT REFERENCES agent_threads(id),
    forked_from_entry_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_agent_threads_user_updated
    ON agent_threads(user_email, updated_at DESC)
    WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS agent_entries (
    lineage_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    parent_entry_id TEXT,
    entry_type TEXT NOT NULL,
    origin_order INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    origin_thread_id TEXT NOT NULL REFERENCES agent_threads(id),
    origin_run_id TEXT,
    session_timestamp DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lineage_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_entries_parent
    ON agent_entries(lineage_id, parent_entry_id);

CREATE INDEX IF NOT EXISTS idx_agent_entries_origin_run
    ON agent_entries(origin_run_id)
    WHERE origin_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES agent_threads(id),
    trigger TEXT NOT NULL CHECK (trigger IN ('send', 'resume', 'fork')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')),
    prompt_text TEXT NOT NULL,
    restore_head_entry_id TEXT,
    result_head_entry_id TEXT,
    workflow_id TEXT NOT NULL,
    temporal_run_id TEXT,
    artifact_root TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_thread_created
    ON agent_runs(thread_id, created_at DESC);
```

**`db/queries/agent_threads.sql`** (new): create the host-side thread CRUD surface.

```sql
-- name: CreateAgentThread :one
INSERT INTO agent_threads (
    id,
    user_email,
    title,
    cwd,
    lineage_id,
    head_entry_id,
    parent_thread_id,
    forked_from_entry_id
)
VALUES (
    sqlc.arg('id'),
    sqlc.arg('user_email'),
    sqlc.arg('title'),
    sqlc.arg('cwd'),
    sqlc.arg('lineage_id'),
    sqlc.narg('head_entry_id'),
    sqlc.narg('parent_thread_id'),
    sqlc.narg('forked_from_entry_id')
)
RETURNING *;

-- name: GetAgentThread :one
SELECT *
FROM agent_threads
WHERE id = sqlc.arg('id')
  AND archived_at IS NULL;

-- name: GetAgentThreadForUser :one
SELECT *
FROM agent_threads
WHERE id = sqlc.arg('id')
  AND user_email = sqlc.arg('user_email')
  AND archived_at IS NULL;

-- name: ListAgentThreads :many
SELECT *
FROM agent_threads
WHERE user_email = sqlc.arg('user_email')
  AND archived_at IS NULL
ORDER BY updated_at DESC
LIMIT sqlc.arg('limit');

-- name: UpdateAgentThreadHead :exec
UPDATE agent_threads
SET head_entry_id = sqlc.narg('head_entry_id'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');

-- name: UpdateAgentThreadTitle :exec
UPDATE agent_threads
SET title = sqlc.arg('title'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');
```

**`db/queries/agent_entries.sql`** (new): store full Pi entries and recover the active ancestry path.

```sql
-- name: CreateAgentEntry :exec
INSERT INTO agent_entries (
    lineage_id,
    entry_id,
    parent_entry_id,
    entry_type,
    origin_order,
    payload_json,
    origin_thread_id,
    origin_run_id,
    session_timestamp
)
VALUES (
    sqlc.arg('lineage_id'),
    sqlc.arg('entry_id'),
    sqlc.narg('parent_entry_id'),
    sqlc.arg('entry_type'),
    sqlc.arg('origin_order'),
    sqlc.arg('payload_json'),
    sqlc.arg('origin_thread_id'),
    sqlc.narg('origin_run_id'),
    sqlc.arg('session_timestamp')
);

-- name: GetAgentEntry :one
SELECT *
FROM agent_entries
WHERE lineage_id = sqlc.arg('lineage_id')
  AND entry_id = sqlc.arg('entry_id');

-- name: ListAgentEntryPath :many
WITH RECURSIVE ancestry AS (
    SELECT
        lineage_id,
        entry_id,
        parent_entry_id,
        entry_type,
        origin_order,
        payload_json,
        origin_thread_id,
        origin_run_id,
        session_timestamp,
        created_at,
        0 AS depth
    FROM agent_entries
    WHERE lineage_id = sqlc.arg('lineage_id')
      AND entry_id = sqlc.arg('head_entry_id')

    UNION ALL

    SELECT
        e.lineage_id,
        e.entry_id,
        e.parent_entry_id,
        e.entry_type,
        e.origin_order,
        e.payload_json,
        e.origin_thread_id,
        e.origin_run_id,
        e.session_timestamp,
        e.created_at,
        ancestry.depth + 1 AS depth
    FROM agent_entries e
    JOIN ancestry
      ON e.lineage_id = ancestry.lineage_id
     AND e.entry_id = ancestry.parent_entry_id
)
SELECT
    lineage_id,
    entry_id,
    parent_entry_id,
    entry_type,
    origin_order,
    payload_json,
    origin_thread_id,
    origin_run_id,
    session_timestamp,
    created_at
FROM ancestry
ORDER BY depth DESC, origin_order ASC;
```

**`db/queries/agent_runs.sql`** (new): record each Temporal workflow run as a durable unit.

```sql
-- name: CreateAgentRun :one
INSERT INTO agent_runs (
    id,
    thread_id,
    trigger,
    status,
    prompt_text,
    restore_head_entry_id,
    result_head_entry_id,
    workflow_id,
    temporal_run_id,
    artifact_root,
    error_message
)
VALUES (
    sqlc.arg('id'),
    sqlc.arg('thread_id'),
    sqlc.arg('trigger'),
    sqlc.arg('status'),
    sqlc.arg('prompt_text'),
    sqlc.narg('restore_head_entry_id'),
    sqlc.narg('result_head_entry_id'),
    sqlc.arg('workflow_id'),
    sqlc.narg('temporal_run_id'),
    sqlc.arg('artifact_root'),
    sqlc.narg('error_message')
)
RETURNING *;

-- name: GetAgentRun :one
SELECT *
FROM agent_runs
WHERE id = sqlc.arg('id');

-- name: ListAgentRunsByThread :many
SELECT *
FROM agent_runs
WHERE thread_id = sqlc.arg('thread_id')
ORDER BY created_at DESC;

-- name: GetLatestAgentRunByThread :one
SELECT *
FROM agent_runs
WHERE thread_id = sqlc.arg('thread_id')
ORDER BY created_at DESC
LIMIT 1;

-- name: UpdateAgentRunStarted :exec
UPDATE agent_runs
SET status = 'running',
    temporal_run_id = sqlc.narg('temporal_run_id')
WHERE id = sqlc.arg('id');

-- name: UpdateAgentRunCheckpoint :exec
UPDATE agent_runs
SET result_head_entry_id = sqlc.narg('result_head_entry_id')
WHERE id = sqlc.arg('id');

-- name: CompleteAgentRun :exec
UPDATE agent_runs
SET status = 'complete',
    result_head_entry_id = sqlc.narg('result_head_entry_id'),
    completed_at = CURRENT_TIMESTAMP,
    error_message = NULL
WHERE id = sqlc.arg('id');

-- name: FailAgentRun :exec
UPDATE agent_runs
SET status = 'failed',
    error_message = sqlc.arg('error_message'),
    completed_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');
```

**`pkg/agents/conversation/types.go`** (new): define the reusable contract that sits between the host app and the TS worker.

```go
package conversation

import (
    "encoding/json"
    "time"
)

type RunTrigger string

const (
    RunTriggerSend   RunTrigger = "send"
    RunTriggerResume RunTrigger = "resume"
    RunTriggerFork   RunTrigger = "fork"
)

const (
    EventCheckpoint  = "checkpoint"
    EventRunComplete = "run_complete"
    EventRunFailed   = "run_failed"
)

type SnapshotHeader struct {
    SessionID       string `json:"session_id"`
    ParentSessionID string `json:"parent_session_id,omitempty"`
    Cwd             string `json:"cwd"`
}

type SnapshotEntry struct {
    LineageID     string          `json:"lineage_id"`
    EntryID       string          `json:"entry_id"`
    ParentEntryID string          `json:"parent_entry_id,omitempty"`
    EntryType     string          `json:"entry_type"`
    Timestamp     time.Time       `json:"timestamp"`
    OriginOrder   int64           `json:"origin_order"`
    PayloadJSON   json.RawMessage `json:"payload_json"`
}

type Snapshot struct {
    Header      SnapshotHeader  `json:"header"`
    LineageID   string          `json:"lineage_id"`
    HeadEntryID string          `json:"head_entry_id,omitempty"`
    Entries     []SnapshotEntry `json:"entries"`
}

type RunInput struct {
    RunID            string     `json:"run_id"`
    ThreadID         string     `json:"thread_id"`
    Trigger          RunTrigger `json:"trigger"`
    Prompt           string     `json:"prompt"`
    Cwd              string     `json:"cwd"`
    ArtifactRoot     string     `json:"artifact_root"`
    ThinkingLevel    string     `json:"thinking_level"`
    CallbackEndpoint string     `json:"callback_endpoint"`
    Snapshot         Snapshot   `json:"snapshot"`
}

type Checkpoint struct {
    RunID       string          `json:"run_id"`
    ThreadID    string          `json:"thread_id"`
    HeadEntryID string          `json:"head_entry_id,omitempty"`
    TurnIndex   int             `json:"turn_index"`
    Header      SnapshotHeader  `json:"header"`
    NewEntries  []SnapshotEntry `json:"new_entries"`
}

type EventEnvelope struct {
    RunID       string          `json:"run_id"`
    ThreadID    string          `json:"thread_id"`
    EventType   string          `json:"event_type"`
    PayloadJSON json.RawMessage `json:"payload_json"`
}

type RunResult struct {
    RunID        string `json:"run_id"`
    ThreadID     string `json:"thread_id"`
    HeadEntryID  string `json:"head_entry_id,omitempty"`
    SessionPath  string `json:"session_path"`
    ArtifactRoot string `json:"artifact_root"`
    MetadataJSON string `json:"metadata_json"`
}

type RunFailure struct {
    RunID        string `json:"run_id"`
    ThreadID     string `json:"thread_id"`
    HeadEntryID  string `json:"head_entry_id,omitempty"`
    SessionPath  string `json:"session_path"`
    ArtifactRoot string `json:"artifact_root"`
    ErrorMessage string `json:"error_message"`
}
```

**`pkg/agents/workflows/conversation/workflow.go`** (new): add the standalone Temporal workflow that only dispatches the TS activity.

```go
package conversationworkflow

import (
    "fmt"
    "time"

    conversation "github.com/premiumlabs/agents/pkg/agents/conversation"
    temporalmgr "github.com/premiumlabs/agents/pkg/agents/temporal"
    "go.temporal.io/sdk/workflow"
)

func RunTurnWorkflow(ctx workflow.Context, input conversation.RunInput) (conversation.RunResult, error) {
    actCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
        TaskQueue:           temporalmgr.TSTaskQueue,
        StartToCloseTimeout: 30 * time.Minute,
        HeartbeatTimeout:    2 * time.Minute,
    })

    var result conversation.RunResult
    if err := workflow.ExecuteActivity(actCtx, "RunConversationTurn", input).Get(ctx, &result); err != nil {
        return conversation.RunResult{}, fmt.Errorf("run conversation turn: %w", err)
    }
    return result, nil
}
```

**`pkg/agents/temporal/manager.go`** (modify): make workflow startup generic enough for the new non-registry conversation workflow.

```go
// StartWorkflow starts any Temporal workflow and returns the run ID.
func (m *Manager) StartWorkflow(ctx context.Context, workflowID string, workflowFunc any, input any) (string, error) {
    opts := client.StartWorkflowOptions{ID: workflowID, TaskQueue: GoTaskQueue}
    run, err := m.client.ExecuteWorkflow(ctx, opts, workflowFunc, input)
    if err != nil {
        return "", fmt.Errorf("start workflow %s: %w", workflowID, err)
    }
    return run.GetRunID(), nil
}

func (m *Manager) StartWorkflowByName(ctx context.Context, workflowID, workflowName string, input any) (string, error) {
    opts := client.StartWorkflowOptions{ID: workflowID, TaskQueue: GoTaskQueue}
    run, err := m.client.ExecuteWorkflow(ctx, opts, workflowName, input)
    if err != nil {
        return "", fmt.Errorf("start workflow %s (%s): %w", workflowID, workflowName, err)
    }
    return run.GetRunID(), nil
}
```

**`pkg/agents/temporal/workers/ts/types.ts`** (modify): keep the existing Pi activity types and add the conversation mirrors.

```ts
export interface ConversationSnapshotHeader {
  session_id: string;
  parent_session_id?: string;
  cwd: string;
}

export interface ConversationSnapshotEntry {
  lineage_id: string;
  entry_id: string;
  parent_entry_id?: string;
  entry_type: string;
  timestamp: string;
  origin_order: number;
  payload_json: string;
}

export interface ConversationSnapshot {
  header: ConversationSnapshotHeader;
  lineage_id: string;
  head_entry_id?: string;
  entries: ConversationSnapshotEntry[];
}

export interface ConversationRunInput {
  run_id: string;
  thread_id: string;
  trigger: 'send' | 'resume' | 'fork';
  prompt: string;
  cwd: string;
  artifact_root: string;
  thinking_level: string;
  callback_endpoint: string;
  snapshot: ConversationSnapshot;
}

export interface ConversationCheckpoint {
  run_id: string;
  thread_id: string;
  head_entry_id?: string;
  turn_index: number;
  header: ConversationSnapshotHeader;
  new_entries: ConversationSnapshotEntry[];
}

export interface EventEnvelope {
  run_id: string;
  thread_id: string;
  event_type: string;
  payload_json: string;
}

export interface ConversationRunResult {
  run_id: string;
  thread_id: string;
  head_entry_id?: string;
  session_path: string;
  artifact_root: string;
  metadata_json: string;
}

export interface ConversationRunFailure {
  run_id: string;
  thread_id: string;
  head_entry_id?: string;
  session_path: string;
  artifact_root: string;
  error_message: string;
}
```

**`pkg/agents/temporal/workers/ts/conversation.ts`** (new): materialize SQLite snapshots back into Pi-compatible JSONL and derive checkpoint payloads from the live session.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SessionManager } from '@mariozechner/pi-coding-agent';
import type {
  ConversationCheckpoint,
  ConversationRunInput,
  ConversationRunResult,
  EventEnvelope,
} from './types.js';

export async function postEnvelope(endpoint: string, envelope: EventEnvelope): Promise<void> {
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
}

export async function materializeSnapshot(input: ConversationRunInput): Promise<SessionManager> {
  const sessionDir = join(tmpdir(), 'agent-chat-sessions', input.run_id);
  const sessionFile = join(sessionDir, 'session.jsonl');

  await mkdir(sessionDir, { recursive: true });

  const header = {
    type: 'session',
    version: 3,
    id: input.snapshot.header.session_id || input.run_id,
    timestamp: new Date().toISOString(),
    cwd: input.snapshot.header.cwd,
    ...(input.snapshot.header.parent_session_id
      ? { parentSession: input.snapshot.header.parent_session_id }
      : {}),
  };

  const lines = [JSON.stringify(header), ...input.snapshot.entries.map((entry) => entry.payload_json)];
  await writeFile(sessionFile, lines.join('\n') + '\n', 'utf8');

  return SessionManager.open(sessionFile, dirname(sessionFile));
}

export function buildCheckpoint(input: ConversationRunInput, sessionManager: SessionManager, turnIndex: number): ConversationCheckpoint {
  const existingIds = new Set(input.snapshot.entries.map((entry) => entry.entry_id));
  const nextOriginOrder = input.snapshot.entries.length === 0
    ? 0
    : Math.max(...input.snapshot.entries.map((entry) => entry.origin_order)) + 1;

  const newEntries = sessionManager
    .getEntries()
    .filter((entry) => !existingIds.has(entry.id))
    .map((entry, index) => ({
      lineage_id: input.snapshot.lineage_id,
      entry_id: entry.id,
      parent_entry_id: entry.parentId ?? undefined,
      entry_type: entry.type,
      timestamp: entry.timestamp,
      origin_order: nextOriginOrder + index,
      payload_json: JSON.stringify(entry),
    }));

  const header = sessionManager.getHeader();

  return {
    run_id: input.run_id,
    thread_id: input.thread_id,
    head_entry_id: sessionManager.getLeafId() ?? undefined,
    turn_index: turnIndex,
    header: {
      session_id: header?.id ?? input.snapshot.header.session_id,
      parent_session_id: header?.parentSession,
      cwd: header?.cwd ?? input.cwd,
    },
    new_entries: newEntries,
  };
}

export function buildRunResult(input: ConversationRunInput, sessionManager: SessionManager, metadata: Record<string, unknown>): ConversationRunResult {
  return {
    run_id: input.run_id,
    thread_id: input.thread_id,
    head_entry_id: sessionManager.getLeafId() ?? undefined,
    session_path: sessionManager.getSessionFile() ?? '',
    artifact_root: input.artifact_root,
    metadata_json: JSON.stringify(metadata),
  };
}
```

**`pkg/agents/temporal/workers/ts/activities.ts`** (modify): keep the existing pipeline activities and add a new `RunConversationTurn` export that posts raw Pi events, `checkpoint`, and `run_complete`/`run_failed` envelopes.

```ts
import type {
  ConversationRunFailure,
  ConversationRunInput,
  ConversationRunResult,
  EventEnvelope,
} from './types.js';
import { buildCheckpoint, buildRunResult, materializeSnapshot, postEnvelope } from './conversation.js';

export async function RunConversationTurn(input: ConversationRunInput): Promise<ConversationRunResult> {
  const sessionManager = await materializeSnapshot(input);
  const authStorage = AuthStorage.create(process.env.PI_AUTH_PATH || undefined);
  const modelRegistry = ModelRegistry.create(authStorage);
  const provider = process.env.PI_MODEL_PROVIDER || 'openai-codex';
  const modelId = process.env.PI_MODEL_ID || 'gpt-5.4';
  const model = modelRegistry.find(provider, modelId);

  const { session } = await createAgentSession({
    cwd: input.cwd,
    sessionManager,
    authStorage,
    modelRegistry,
    model: model ?? undefined,
    thinkingLevel: input.thinking_level as any,
  });
  session.setAutoCompactionEnabled(false);

  const metadata: Record<string, unknown> = {
    trigger: input.trigger,
    started_at: new Date().toISOString(),
    turns: 0,
  };

  let callbackQueue = Promise.resolve();
  const enqueue = (envelope: EventEnvelope) => {
    callbackQueue = callbackQueue.then(() => postEnvelope(input.callback_endpoint, envelope)).catch(() => undefined);
    return callbackQueue;
  };

  const heartbeatInterval = setInterval(() => {
    Context.current().heartbeat();
  }, 30_000);

  const unsubscribe = session.subscribe((event: any) => {
    enqueue({
      run_id: input.run_id,
      thread_id: input.thread_id,
      event_type: event.type,
      payload_json: JSON.stringify(event),
    });

    if (event.type === 'turn_end') {
      metadata.turns = Number(metadata.turns) + 1;
      enqueue({
        run_id: input.run_id,
        thread_id: input.thread_id,
        event_type: 'checkpoint',
        payload_json: JSON.stringify(buildCheckpoint(input, sessionManager, event.turnIndex)),
      });
    }
  });

  try {
    await session.prompt(input.prompt);

    const result = buildRunResult(input, sessionManager, {
      ...metadata,
      completed_at: new Date().toISOString(),
    });

    await enqueue({
      run_id: input.run_id,
      thread_id: input.thread_id,
      event_type: 'run_complete',
      payload_json: JSON.stringify(result),
    });
    await callbackQueue;
    return result;
  } catch (error) {
    const failure: ConversationRunFailure = {
      run_id: input.run_id,
      thread_id: input.thread_id,
      head_entry_id: sessionManager.getLeafId() ?? undefined,
      session_path: sessionManager.getSessionFile() ?? '',
      artifact_root: input.artifact_root,
      error_message: error instanceof Error ? error.message : String(error),
    };

    await enqueue({
      run_id: input.run_id,
      thread_id: input.thread_id,
      event_type: 'run_failed',
      payload_json: JSON.stringify(failure),
    });
    await callbackQueue;
    throw error;
  } finally {
    clearInterval(heartbeatInterval);
    unsubscribe();
    session.dispose();
  }
}
```

**`pkg/agents/temporal/workers/ts/worker.ts`** (modify): register the new TS activity.

```ts
import { RunPiAgent, ContinuePiAgent, RunConversationTurn } from './activities.js';

const worker = await Worker.create({
  connection,
  taskQueue: 'pipeline-ts',
  activities: {
    RunPiAgent,
    ContinuePiAgent,
    RunConversationTurn,
  },
});
```

**`server/services/agentchat/notifier.go`** (new): mirror the pipeline notifier pattern but key everything by thread ID.

```go
package agentchat

import (
    conversation "github.com/premiumlabs/agents/pkg/agents/conversation"
    "sync"
)

type Notifier struct {
    mu        sync.RWMutex
    subs      map[string][]chan struct{}
    eventSubs map[string][]chan conversation.EventEnvelope
}

func NewNotifier() *Notifier {
    return &Notifier{
        subs:      make(map[string][]chan struct{}),
        eventSubs: make(map[string][]chan conversation.EventEnvelope),
    }
}

func (n *Notifier) Subscribe(threadID string) chan struct{} { /* same shape as PipelineNotifier */ }
func (n *Notifier) Unsubscribe(threadID string, ch chan struct{}) { /* remove */ }
func (n *Notifier) Notify(threadID string) { /* fan out state change */ }
func (n *Notifier) SubscribeEvents(threadID string) chan conversation.EventEnvelope { /* buffered */ }
func (n *Notifier) UnsubscribeEvents(threadID string, ch chan conversation.EventEnvelope) { /* remove */ }
func (n *Notifier) NotifyEvent(threadID string, event conversation.EventEnvelope) { /* fan out */ }
```

**`server/services/agentchat/args.go`** (new): add page/transcript/artifact view models. Keep them host-side; do not leak them into `pkg/agents`.

```go
package agentchat

import (
    "github.com/premiumlabs/agents/pkg/db"
    "github.com/premiumlabs/agents/server/services/markdown"
)

type TranscriptMessage struct {
    DOMID        string
    EntryID      string
    Role         string
    Content      string
    HTMLContent  string
    ShowForkForm bool
}

type ArtifactTreeNode struct {
    Path     string
    Name     string
    IsDir    bool
    Selected bool
    Children []ArtifactTreeNode
}

type ArtifactRenderView struct {
    RootPath    string
    RelativePath string
    DisplayName string
    HTML        string
    Sections    []markdown.Section
    Exists      bool
}

type ArtifactPaneState struct {
    ActiveRunID  string
    ArtifactRoot string
    Tree         []ArtifactTreeNode
    Selected     ArtifactRenderView
}

type ChatPageArgs struct {
    UserEmail          string
    CurrentTheme       string
    CurrentSyntaxTheme string
    Threads            []db.AgentThread
    CurrentThread      *db.AgentThread
    ActiveRun          *db.AgentRun
    Messages           []TranscriptMessage
    ArtifactPane       ArtifactPaneState
}
```

**`server/services/agentchat/service.go`** (new): implement the host-owned SQL, snapshot building, checkpoint application, page rendering data, and workflow startup.

```go
package agentchat

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "io/fs"
    "os"
    "path/filepath"
    "sort"
    "strings"

    "github.com/google/uuid"
    conversation "github.com/premiumlabs/agents/pkg/agents/conversation"
    temporalmgr "github.com/premiumlabs/agents/pkg/agents/temporal"
    conversationworkflow "github.com/premiumlabs/agents/pkg/agents/workflows/conversation"
    "github.com/premiumlabs/agents/pkg/db"
    "github.com/premiumlabs/agents/server/services/markdown"
)

type ThemeProvider interface {
    GetCurrentTheme(c echo.Context) string
    GetCurrentThemeMode(c echo.Context) string
}

type Service struct {
    db          *sql.DB
    queries      *db.Queries
    notifier     *Notifier
    temporal     *temporalmgr.Manager
    themeService ThemeProvider
    renderer     *markdown.Renderer
    defaultCwd   string
}

func NewService(database *sql.DB, queries *db.Queries, notifier *Notifier, temporalMgr *temporalmgr.Manager, themeService ThemeProvider, defaultCwd string) (*Service, error) {
    renderer, err := markdown.NewRenderer("")
    if err != nil {
        return nil, err
    }
    return &Service{db: database, queries: queries, notifier: notifier, temporal: temporalMgr, themeService: themeService, renderer: renderer, defaultCwd: strings.TrimSpace(defaultCwd)}, nil
}

func (s *Service) StartThread(ctx context.Context, userEmail, cwd, prompt string) (*db.AgentThread, *db.AgentRun, error) {
    if s.temporal == nil {
        return nil, nil, fmt.Errorf("temporal not configured")
    }

    threadID := uuid.NewString()
    lineageID := uuid.NewString()
    cwd = s.resolveCwd(cwd)
    title := truncateTitle(prompt)

    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return nil, nil, err
    }
    defer tx.Rollback()

    q := s.queries.WithTx(tx)
    thread, err := q.CreateAgentThread(ctx, db.CreateAgentThreadParams{
        ID:        threadID,
        UserEmail: userEmail,
        Title:     title,
        Cwd:       cwd,
        LineageID: lineageID,
    })
    if err != nil {
        return nil, nil, err
    }

    run, err := s.createRunAndStartWorkflow(ctx, q, thread, conversation.RunTriggerSend, prompt, sql.NullString{})
    if err != nil {
        return nil, nil, err
    }

    if err := tx.Commit(); err != nil {
        return nil, nil, err
    }
    s.notifier.Notify(thread.ID)
    return &thread, run, nil
}

func (s *Service) createRunAndStartWorkflow(ctx context.Context, q *db.Queries, thread db.AgentThread, trigger conversation.RunTrigger, prompt string, restoreHead sql.NullString) (*db.AgentRun, error) {
    snapshot, err := s.BuildSnapshot(ctx, thread.ID, restoreHead.String)
    if err != nil {
        return nil, err
    }

    runID := uuid.NewString()
    workflowID := fmt.Sprintf("agent-chat-run-%s", runID)
    run, err := q.CreateAgentRun(ctx, db.CreateAgentRunParams{
        ID:                 runID,
        ThreadID:           thread.ID,
        Trigger:            string(trigger),
        Status:             "running",
        PromptText:         prompt,
        RestoreHeadEntryID: restoreHead,
        WorkflowID:         workflowID,
        ArtifactRoot:       thread.Cwd,
    })
    if err != nil {
        return nil, err
    }

    input := conversation.RunInput{
        RunID:            runID,
        ThreadID:         thread.ID,
        Trigger:          trigger,
        Prompt:           prompt,
        Cwd:              thread.Cwd,
        ArtifactRoot:     thread.Cwd,
        ThinkingLevel:    "high",
        CallbackEndpoint: "http://localhost:4200/internal/agent-chat/events",
        Snapshot:         snapshot,
    }

    temporalRunID, err := s.temporal.StartWorkflow(ctx, workflowID, conversationworkflow.RunTurnWorkflow, input)
    if err != nil {
        _ = q.FailAgentRun(ctx, db.FailAgentRunParams{ID: runID, ErrorMessage: err.Error()})
        return nil, err
    }

    if err := q.UpdateAgentRunStarted(ctx, db.UpdateAgentRunStartedParams{
        ID:            runID,
        TemporalRunID: sql.NullString{String: temporalRunID, Valid: true},
    }); err != nil {
        return nil, err
    }

    latest, err := q.GetAgentRun(ctx, runID)
    if err != nil {
        return nil, err
    }
    return &latest, nil
}

func (s *Service) BuildSnapshot(ctx context.Context, threadID, headEntryID string) (conversation.Snapshot, error) {
    thread, err := s.queries.GetAgentThread(ctx, threadID)
    if err != nil {
        return conversation.Snapshot{}, err
    }

    if strings.TrimSpace(headEntryID) == "" && thread.HeadEntryID.Valid {
        headEntryID = thread.HeadEntryID.String
    }

    snapshot := conversation.Snapshot{
        Header: conversation.SnapshotHeader{
            SessionID:       thread.ID,
            ParentSessionID: thread.ParentThreadID.String,
            Cwd:             thread.Cwd,
        },
        LineageID:   thread.LineageID,
        HeadEntryID: headEntryID,
        Entries:     []conversation.SnapshotEntry{},
    }

    if strings.TrimSpace(headEntryID) == "" {
        return snapshot, nil
    }

    rows, err := s.queries.ListAgentEntryPath(ctx, db.ListAgentEntryPathParams{
        LineageID:   thread.LineageID,
        HeadEntryID: headEntryID,
    })
    if err != nil {
        return conversation.Snapshot{}, err
    }

    snapshot.Entries = make([]conversation.SnapshotEntry, 0, len(rows))
    for _, row := range rows {
        snapshot.Entries = append(snapshot.Entries, conversation.SnapshotEntry{
            LineageID:     row.LineageID,
            EntryID:       row.EntryID,
            ParentEntryID: row.ParentEntryID.String,
            EntryType:     row.EntryType,
            Timestamp:     row.SessionTimestamp,
            OriginOrder:   row.OriginOrder,
            PayloadJSON:   json.RawMessage(row.PayloadJSON),
        })
    }
    return snapshot, nil
}

func (s *Service) ApplyCheckpoint(ctx context.Context, cp conversation.Checkpoint) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    q := s.queries.WithTx(tx)
    run, err := q.GetAgentRun(ctx, cp.RunID)
    if err != nil {
        return err
    }
    thread, err := q.GetAgentThread(ctx, run.ThreadID)
    if err != nil {
        return err
    }

    for _, entry := range cp.NewEntries {
        err := q.CreateAgentEntry(ctx, db.CreateAgentEntryParams{
            LineageID:     thread.LineageID,
            EntryID:       entry.EntryID,
            ParentEntryID: sql.NullString{String: entry.ParentEntryID, Valid: entry.ParentEntryID != ""},
            EntryType:     entry.EntryType,
            OriginOrder:   entry.OriginOrder,
            PayloadJSON:   string(entry.PayloadJSON),
            OriginThreadID: thread.ID,
            OriginRunID:   sql.NullString{String: run.ID, Valid: true},
            SessionTimestamp: entry.Timestamp,
        })
        if err != nil && !strings.Contains(err.Error(), "UNIQUE") {
            return err
        }
    }

    if err := q.UpdateAgentRunCheckpoint(ctx, db.UpdateAgentRunCheckpointParams{
        ID:               run.ID,
        ResultHeadEntryID: sql.NullString{String: cp.HeadEntryID, Valid: cp.HeadEntryID != ""},
    }); err != nil {
        return err
    }

    if err := q.UpdateAgentThreadHead(ctx, db.UpdateAgentThreadHeadParams{
        ID:          thread.ID,
        HeadEntryID: sql.NullString{String: cp.HeadEntryID, Valid: cp.HeadEntryID != ""},
    }); err != nil {
        return err
    }

    if err := tx.Commit(); err != nil {
        return err
    }
    s.notifier.Notify(thread.ID)
    return nil
}

func (s *Service) FinalizeRun(ctx context.Context, result conversation.RunResult) error {
    if err := s.queries.CompleteAgentRun(ctx, db.CompleteAgentRunParams{
        ID:               result.RunID,
        ResultHeadEntryID: sql.NullString{String: result.HeadEntryID, Valid: result.HeadEntryID != ""},
    }); err != nil {
        return err
    }

    run, err := s.queries.GetAgentRun(ctx, result.RunID)
    if err != nil {
        return err
    }
    s.notifier.Notify(run.ThreadID)
    return nil
}

func (s *Service) FailRun(ctx context.Context, runID string, errorMessage string) error {
    if err := s.queries.FailAgentRun(ctx, db.FailAgentRunParams{ID: runID, ErrorMessage: errorMessage}); err != nil {
        return err
    }
    run, err := s.queries.GetAgentRun(ctx, runID)
    if err != nil {
        return err
    }
    s.notifier.Notify(run.ThreadID)
    return nil
}
```

Add page-building helpers in the same file. Keep them concrete instead of creating a second abstraction layer.

```go
func (s *Service) BuildPageArgs(ctx context.Context, userEmail, threadID, runID string) (*ChatPageArgs, error) {
    threads, err := s.queries.ListAgentThreads(ctx, db.ListAgentThreadsParams{UserEmail: userEmail, Limit: 50})
    if err != nil {
        return nil, err
    }

    args := &ChatPageArgs{Threads: threads, Messages: []TranscriptMessage{}, ArtifactPane: ArtifactPaneState{}}
    if strings.TrimSpace(threadID) == "" {
        return args, nil
    }

    thread, err := s.queries.GetAgentThreadForUser(ctx, db.GetAgentThreadForUserParams{ID: threadID, UserEmail: userEmail})
    if err != nil {
        return nil, err
    }
    args.CurrentThread = &thread

    args.Messages, err = s.buildTranscript(ctx, thread)
    if err != nil {
        return nil, err
    }

    if strings.TrimSpace(runID) != "" {
        run, err := s.queries.GetAgentRun(ctx, runID)
        if err == nil {
            args.ActiveRun = &run
        }
    }
    if args.ActiveRun == nil {
        if run, err := s.queries.GetLatestAgentRunByThread(ctx, thread.ID); err == nil {
            args.ActiveRun = &run
        }
    }
    return args, nil
}

func (s *Service) buildTranscript(ctx context.Context, thread db.AgentThread) ([]TranscriptMessage, error) {
    if !thread.HeadEntryID.Valid {
        return []TranscriptMessage{}, nil
    }

    rows, err := s.queries.ListAgentEntryPath(ctx, db.ListAgentEntryPathParams{LineageID: thread.LineageID, HeadEntryID: thread.HeadEntryID.String})
    if err != nil {
        return nil, err
    }

    messages := make([]TranscriptMessage, 0, len(rows))
    for _, row := range rows {
        msg, ok, err := s.decodeTranscriptMessage(row.PayloadJSON)
        if err != nil {
            return nil, err
        }
        if ok {
            messages = append(messages, msg)
        }
    }
    return messages, nil
}

func (s *Service) decodeTranscriptMessage(payload string) (TranscriptMessage, bool, error) {
    var envelope struct {
        Type    string `json:"type"`
        ID      string `json:"id"`
        Message struct {
            Role    string `json:"role"`
            Content any    `json:"content"`
        } `json:"message"`
        Content any  `json:"content"`
        Display bool `json:"display"`
    }
    if err := json.Unmarshal([]byte(payload), &envelope); err != nil {
        return TranscriptMessage{}, false, err
    }

    switch envelope.Type {
    case "message":
        text := extractContentText(envelope.Message.Content)
        msg := TranscriptMessage{
            DOMID:        "entry-" + envelope.ID,
            EntryID:      envelope.ID,
            Role:         envelope.Message.Role,
            Content:      text,
            HTMLContent:  s.renderer.MarkdownBytesToHTML([]byte(text)),
            ShowForkForm: envelope.Message.Role == "user" || envelope.Message.Role == "assistant",
        }
        return msg, envelope.Message.Role == "user" || envelope.Message.Role == "assistant", nil
    case "custom_message":
        if !envelope.Display {
            return TranscriptMessage{}, false, nil
        }
        text := extractContentText(envelope.Content)
        return TranscriptMessage{
            DOMID:        "entry-" + envelope.ID,
            EntryID:      envelope.ID,
            Role:         "assistant",
            Content:      text,
            HTMLContent:  s.renderer.MarkdownBytesToHTML([]byte(text)),
            ShowForkForm: true,
        }, true, nil
    default:
        return TranscriptMessage{}, false, nil
    }
}
```

For slice 1, keep `BuildArtifactPane` as a placeholder that returns an empty pane; slice 4 will replace it with the file-tree implementation.

**`server/services/agentchat/handler.go`** (new): implement page render, thread stream, send flow, and the internal event ingress.

```go
package agentchat

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strings"

    "github.com/labstack/echo/v4"
    conversation "github.com/premiumlabs/agents/pkg/agents/conversation"
    datastar "github.com/starfederation/datastar-go/datastar"
)

type Handler struct {
    service      *Service
    themeService *theme.Service
}

func NewHandler(service *Service, themeService *theme.Service) *Handler {
    return &Handler{service: service, themeService: themeService}
}

func (h *Handler) RegisterRoutes(g *echo.Group) {
    g.GET("", h.HandleChatPage)
    g.GET("/stream", h.StreamThread)
    g.POST("/send", h.SendPrompt)
}

func (h *Handler) HandleChatPage(c echo.Context) error {
    userEmail, ok := c.Get("user_email").(string)
    if !ok || userEmail == "" {
        return c.Redirect(http.StatusFound, "/login")
    }

    args, err := h.service.BuildPageArgs(c.Request().Context(), userEmail, c.QueryParam("thread"), c.QueryParam("run"))
    if err != nil {
        return echo.NewHTTPError(http.StatusNotFound, err.Error())
    }

    currentTheme := "dark"
    currentSyntaxTheme := ""
    if h.themeService != nil {
        currentTheme = h.themeService.GetCurrentThemeMode(c)
        currentSyntaxTheme = h.themeService.GetCurrentTheme(c)
    }

    args.UserEmail = userEmail
    args.CurrentTheme = currentTheme
    args.CurrentSyntaxTheme = currentSyntaxTheme
    return ChatPage(*args).Render(c.Request().Context(), c.Response().Writer)
}

func (h *Handler) StreamThread(c echo.Context) error {
    threadID := strings.TrimSpace(c.QueryParam("thread"))
    if threadID == "" {
        return nil
    }

    sse := datastar.NewSSE(c.Response().Writer, c.Request())
    ctx := c.Request().Context()

    stateCh := h.service.notifier.Subscribe(threadID)
    eventCh := h.service.notifier.SubscribeEvents(threadID)
    defer h.service.notifier.Unsubscribe(threadID, stateCh)
    defer h.service.notifier.UnsubscribeEvents(threadID, eventCh)

    for {
        select {
        case <-ctx.Done():
            return nil
        case <-stateCh:
            if err := h.patchTranscriptAndSidebar(c, sse); err != nil {
                return err
            }
        case env := <-eventCh:
            if err := h.patchLiveRunEvent(c, sse, env); err != nil {
                return err
            }
        }
    }
}

func (h *Handler) SendPrompt(c echo.Context) error {
    userEmail, ok := c.Get("user_email").(string)
    if !ok || userEmail == "" {
        return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
    }

    prompt := strings.TrimSpace(c.FormValue("prompt"))
    if prompt == "" {
        return echo.NewHTTPError(http.StatusBadRequest, "prompt is required")
    }

    thread, run, err := h.service.StartThread(c.Request().Context(), userEmail, c.FormValue("cwd"), prompt)
    if err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, err.Error())
    }

    sse := datastar.NewSSE(c.Response().Writer, c.Request())
    return sse.Redirect(fmt.Sprintf("/agent-chat?thread=%s&run=%s", thread.ID, run.ID))
}

func (h *Handler) HandleInternalRunEvent(c echo.Context) error {
    var env conversation.EventEnvelope
    if err := c.Bind(&env); err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, "invalid event envelope")
    }

    switch env.EventType {
    case conversation.EventCheckpoint:
        var cp conversation.Checkpoint
        if err := json.Unmarshal(env.PayloadJSON, &cp); err != nil {
            return echo.NewHTTPError(http.StatusBadRequest, "invalid checkpoint payload")
        }
        if err := h.service.ApplyCheckpoint(c.Request().Context(), cp); err != nil {
            return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
        }
    case conversation.EventRunComplete:
        var result conversation.RunResult
        if err := json.Unmarshal(env.PayloadJSON, &result); err != nil {
            return echo.NewHTTPError(http.StatusBadRequest, "invalid run result payload")
        }
        if err := h.service.FinalizeRun(c.Request().Context(), result); err != nil {
            return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
        }
    case conversation.EventRunFailed:
        var failure conversation.RunFailure
        if err := json.Unmarshal(env.PayloadJSON, &failure); err != nil {
            return echo.NewHTTPError(http.StatusBadRequest, "invalid run failure payload")
        }
        if err := h.service.FailRun(c.Request().Context(), failure.RunID, failure.ErrorMessage); err != nil {
            return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
        }
    }

    h.service.notifier.NotifyEvent(env.ThreadID, env)
    return c.NoContent(http.StatusAccepted)
}
```

Add the live streaming patch helper in the same file. Keep it narrow and only target the transcript container.

```go
func (h *Handler) patchLiveRunEvent(c echo.Context, sse *datastar.ServerSentEventGenerator, env conversation.EventEnvelope) error {
    if env.EventType != "message_start" && env.EventType != "message_update" && env.EventType != "message_end" {
        return nil
    }

    var payload struct {
        Type    string `json:"type"`
        Message struct {
            Role    string `json:"role"`
            Content any    `json:"content"`
        } `json:"message"`
    }
    if err := json.Unmarshal(env.PayloadJSON, &payload); err != nil {
        return nil
    }

    userDOMID := "run-" + env.RunID + "-user"
    assistantDOMID := "run-" + env.RunID + "-assistant"
    text := extractContentText(payload.Message.Content)

    switch {
    case env.EventType == "message_end" && payload.Message.Role == "user":
        return sse.PatchElementTempl(
            ChatMessage(ChatMessageArgs{ID: userDOMID, Role: "user", Content: text}),
            datastar.WithModeAppend(),
            datastar.WithSelectorID("agent-chat-messages"),
        )
    case env.EventType == "message_start" && payload.Message.Role == "assistant":
        return sse.PatchElementTempl(
            ChatMessageStreaming(ChatMessageStreamingArgs{ID: assistantDOMID}),
            datastar.WithModeAppend(),
            datastar.WithSelectorID("agent-chat-messages"),
        )
    case env.EventType == "message_update" && payload.Message.Role == "assistant":
        html := h.service.renderer.MarkdownBytesToHTML([]byte(text))
        return sse.PatchElementTempl(
            ChatMessageDeltaHTML(ChatMessageDeltaHTMLArgs{ID: assistantDOMID, HTMLContent: html}),
            datastar.WithModeInner(),
            datastar.WithSelectorID("msg-content-"+assistantDOMID),
        )
    case env.EventType == "message_end" && payload.Message.Role == "assistant":
        html := h.service.renderer.MarkdownBytesToHTML([]byte(text))
        return sse.PatchElementTempl(ChatMessageComplete(ChatMessageCompleteArgs{ID: assistantDOMID, Content: text, HTMLContent: html}))
    default:
        return nil
    }
}
```

**`server/services/agentchat/page_chat.templ`** and **`server/services/agentchat/templates.templ`** (new): copy the working transcript pieces from `server/services/chat`, but make the page thread-centric and leave a placeholder artifact panel for now.

```templ
package agentchat

import (
    "fmt"
    "github.com/premiumlabs/agents/server/layouts"
)

templ ChatPage(args ChatPageArgs) {
    @layouts.Root(layouts.RootArgs{
        Title:              "Agent Chat",
        ShowHeader:         true,
        UserEmail:          args.UserEmail,
        CurrentTheme:       args.CurrentTheme,
        CurrentSyntaxTheme: args.CurrentSyntaxTheme,
    }) {
        if args.CurrentThread != nil {
            <div data-init={ fmt.Sprintf("@get('/agent-chat/stream?thread=%s&run=%s')", args.CurrentThread.ID, getRunID(args.ActiveRun)) }></div>
        }
        <div class="grid h-full grid-cols-[16rem_minmax(0,1fr)_20rem] gap-4 p-4">
            <aside class="rounded-lg border border-border bg-card">
                @ThreadSidebar(ThreadSidebarArgs{Threads: args.Threads, CurrentThreadID: getThreadID(args.CurrentThread)})
            </aside>
            <main class="flex min-w-0 flex-col rounded-lg border border-border bg-card">
                <div id="agent-chat-messages" class="flex-1 space-y-4 overflow-y-auto p-4">
                    if args.CurrentThread == nil {
                        <p class="text-sm text-muted-foreground">Start a new agent chat.</p>
                    } else {
                        for _, msg := range args.Messages {
                            @ChatMessage(ChatMessageArgs{ID: msg.DOMID, Role: msg.Role, Content: msg.Content, HTMLContent: msg.HTMLContent})
                        }
                    }
                </div>
                <form class="border-t p-4" data-on-submit="@post('/agent-chat/send', {contentType: 'form'})">
                    <input type="hidden" name="cwd" value=""/>
                    <textarea name="prompt" class="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ask Pi to do work in this repo"></textarea>
                    <button type="submit" class="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Send</button>
                </form>
            </main>
            <aside id="agent-chat-artifact-pane" class="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Artifact pane lands in slice 4.
            </aside>
        </div>
    }
}
```

Keep the transcript component templates identical to the current chat versions so the live patch logic works with the same DOM conventions.

**`server/services/agentchat/service_test.go`** (new): cover the durable DB logic without standing up Temporal.

```go
func TestApplyCheckpointPersistsEntriesAndAdvancesHead(t *testing.T) {
    service := newTestAgentChatService(t)
    thread := mustCreateAgentThread(t, service, "thread-1", "user@example.com", "/tmp/project", "lineage-1")
    run := mustCreateAgentRun(t, service, thread.ID, "run-1")

    cp := conversation.Checkpoint{
        RunID:       run.ID,
        ThreadID:    thread.ID,
        HeadEntryID: "assistant-1",
        TurnIndex:   1,
        Header:      conversation.SnapshotHeader{SessionID: thread.ID, Cwd: thread.Cwd},
        NewEntries: []conversation.SnapshotEntry{
            {LineageID: thread.LineageID, EntryID: "model-1", EntryType: "model_change", Timestamp: time.Now(), OriginOrder: 0, PayloadJSON: json.RawMessage(`{"type":"model_change","id":"model-1","parentId":null,"timestamp":"2026-04-19T12:00:00Z","provider":"openai-codex","modelId":"gpt-5.4"}`)},
            {LineageID: thread.LineageID, EntryID: "assistant-1", ParentEntryID: "model-1", EntryType: "message", Timestamp: time.Now(), OriginOrder: 1, PayloadJSON: json.RawMessage(`{"type":"message","id":"assistant-1","parentId":"model-1","timestamp":"2026-04-19T12:00:01Z","message":{"role":"assistant","content":"done"}}`)},
        },
    }

    if err := service.ApplyCheckpoint(context.Background(), cp); err != nil {
        t.Fatalf("ApplyCheckpoint() error = %v", err)
    }

    updated, err := service.queries.GetAgentThread(context.Background(), thread.ID)
    if err != nil {
        t.Fatalf("GetAgentThread() error = %v", err)
    }
    if !updated.HeadEntryID.Valid || updated.HeadEntryID.String != "assistant-1" {
        t.Fatalf("HeadEntryID = %v, want assistant-1", updated.HeadEntryID)
    }
}

func TestBuildTranscriptSkipsNonVisibleEntries(t *testing.T) {
    service := newTestAgentChatService(t)
    thread := mustCreateAgentThread(t, service, "thread-1", "user@example.com", "/tmp/project", "lineage-1")
    mustCreateAgentEntry(t, service, thread.LineageID, "entry-1", "", "custom", `{"type":"custom","id":"entry-1","parentId":null,"timestamp":"2026-04-19T12:00:00Z","customType":"x"}`)
    mustCreateAgentEntry(t, service, thread.LineageID, "entry-2", "entry-1", "message", `{"type":"message","id":"entry-2","parentId":"entry-1","timestamp":"2026-04-19T12:00:01Z","message":{"role":"assistant","content":"hello"}}`)
    _ = service.queries.UpdateAgentThreadHead(context.Background(), db.UpdateAgentThreadHeadParams{ID: thread.ID, HeadEntryID: sql.NullString{String: "entry-2", Valid: true}})

    messages, err := service.buildTranscript(context.Background(), thread)
    if err != nil {
        t.Fatalf("buildTranscript() error = %v", err)
    }
    if len(messages) != 1 || messages[0].EntryID != "entry-2" {
        t.Fatalf("messages = %#v, want only the visible assistant message", messages)
    }
}
```

**`server/services/agentchat/handler_test.go`** (new): keep the first handler tests narrow and selector-based.

```go
func TestHandleInternalRunEventAppliesCheckpoint(t *testing.T) {
    service := newTestAgentChatService(t)
    handler := NewHandler(service, nil)
    thread := mustCreateAgentThread(t, service, "thread-1", "user@example.com", "/tmp/project", "lineage-1")
    run := mustCreateAgentRun(t, service, thread.ID, "run-1")

    env := conversation.EventEnvelope{
        RunID:     run.ID,
        ThreadID:  thread.ID,
        EventType: conversation.EventCheckpoint,
        PayloadJSON: json.RawMessage(`{
          "run_id":"run-1",
          "thread_id":"thread-1",
          "head_entry_id":"assistant-1",
          "turn_index":1,
          "header":{"session_id":"thread-1","cwd":"/tmp/project"},
          "new_entries":[{"lineage_id":"lineage-1","entry_id":"assistant-1","entry_type":"message","timestamp":"2026-04-19T12:00:01Z","origin_order":0,"payload_json":{"type":"message","id":"assistant-1","parentId":null,"timestamp":"2026-04-19T12:00:01Z","message":{"role":"assistant","content":"done"}}}]
        }`),
    }

    body, _ := json.Marshal(env)
    req := httptest.NewRequest(http.MethodPost, "/internal/agent-chat/events", bytes.NewReader(body))
    req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
    rec := httptest.NewRecorder()
    c := echo.New().NewContext(req, rec)

    if err := handler.HandleInternalRunEvent(c); err != nil {
        t.Fatalf("HandleInternalRunEvent() error = %v", err)
    }
    if rec.Code != http.StatusAccepted {
        t.Fatalf("status = %d, want %d", rec.Code, http.StatusAccepted)
    }
}

func TestPatchLiveRunEventTargetsTranscriptOnly(t *testing.T) {
    service := newTestAgentChatService(t)
    handler := NewHandler(service, nil)
    req := httptest.NewRequest(http.MethodGet, "/agent-chat/stream?thread=thread-1&run=run-1", nil)
    rec := httptest.NewRecorder()
    sse := datastar.NewSSE(rec, req)

    env := conversation.EventEnvelope{
        RunID:      "run-1",
        ThreadID:   "thread-1",
        EventType:  "message_start",
        PayloadJSON: json.RawMessage(`{"type":"message_start","message":{"role":"assistant","content":""}}`),
    }

    if err := handler.patchLiveRunEvent(echo.New().NewContext(req, rec), sse, env); err != nil {
        t.Fatalf("patchLiveRunEvent() error = %v", err)
    }

    body := rec.Body.String()
    if !strings.Contains(body, "agent-chat-messages") {
        t.Fatalf("response did not target transcript container: %s", body)
    }
    if strings.Contains(body, "agent-chat-artifact-pane") {
        t.Fatalf("response unexpectedly touched artifact pane: %s", body)
    }
}
```

**`main.go`** (modify): wire in the new service and workflow registration.

```go
import (
    conversationworkflow "github.com/premiumlabs/agents/pkg/agents/workflows/conversation"
    "github.com/premiumlabs/agents/server/services/agentchat"
)

// after Temporal manager creation
agentChatNotifier := agentchat.NewNotifier()
agentChatService, err := agentchat.NewService(dbService.DB(), dbService.Queries, agentChatNotifier, temporalManager, themeService, cfg.RepoPath)
if err != nil {
    log.Fatal("Failed to create agent chat service:", err)
}
agentChatHandler := agentchat.NewHandler(agentChatService, themeService)

if temporalManager != nil {
    goWorker.RegisterWorkflow(conversationworkflow.RunTurnWorkflow)
}

agentChatGroup := e.Group("/agent-chat")
agentChatGroup.Use(authMiddleware)
agentChatHandler.RegisterRoutes(agentChatGroup)

e.POST("/internal/agent-chat/events", agentChatHandler.HandleInternalRunEvent)
```

### Tests

**`server/services/agentchat/service_test.go`**:
- `TestApplyCheckpointPersistsEntriesAndAdvancesHead`
- `TestBuildTranscriptSkipsNonVisibleEntries`

**`server/services/agentchat/handler_test.go`**:
- `TestHandleInternalRunEventAppliesCheckpoint`
- `TestPatchLiveRunEventTargetsTranscriptOnly`

### Verify
```bash
just build

go test ./server/services/agentchat ./pkg/agents/workflows/conversation

PLAYWRIGHT_MCP_BROWSER=chromium PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/chromium just playwright-auth 'http://localhost:4200/agent-chat'
```
Then, in the authenticated browser session: submit a first prompt, wait for the streamed assistant row to settle, reload the page, and confirm the same user + assistant turns are still visible.

---

## Slice 2: Resume latest head in a brand-new workflow

### Files
- `server/services/agentchat/service.go` (modify)
- `server/services/agentchat/handler.go` (modify)
- `server/services/agentchat/page_chat.templ` (modify)
- `server/services/agentchat/templates.templ` (modify)
- `server/services/agentchat/service_test.go` (modify)
- `server/services/agentchat/handler_test.go` (modify)

### Changes

**`server/services/agentchat/service.go`** (modify): add `ResumeThread` and switch the main composer over to “build snapshot -> create run -> start new workflow” instead of reopening a filesystem session path.

```go
func (s *Service) ResumeThread(ctx context.Context, threadID, prompt string) (*db.AgentRun, error) {
    if s.temporal == nil {
        return nil, fmt.Errorf("temporal not configured")
    }
    if strings.TrimSpace(prompt) == "" {
        return nil, fmt.Errorf("prompt is required")
    }

    thread, err := s.queries.GetAgentThread(ctx, threadID)
    if err != nil {
        return nil, err
    }

    restoreHead := sql.NullString{}
    if thread.HeadEntryID.Valid {
        restoreHead = sql.NullString{String: thread.HeadEntryID.String, Valid: true}
    }

    return s.createRunAndStartWorkflow(ctx, s.queries, thread, conversation.RunTriggerResume, prompt, restoreHead)
}
```

Also harden `BuildSnapshot` so it always walks `lineage_id + head_entry_id`, not `created_at`, and keep the snapshot header rooted in the thread’s current `cwd`.

**`server/services/agentchat/handler.go`** (modify): add the dedicated resume endpoint and keep the live stream logic unchanged.

```go
func (h *Handler) RegisterRoutes(g *echo.Group) {
    g.GET("", h.HandleChatPage)
    g.GET("/stream", h.StreamThread)
    g.POST("/send", h.SendPrompt)
    g.POST("/resume", h.ResumeThread)
}

func (h *Handler) ResumeThread(c echo.Context) error {
    threadID := strings.TrimSpace(c.FormValue("thread_id"))
    prompt := strings.TrimSpace(c.FormValue("prompt"))
    if threadID == "" || prompt == "" {
        return echo.NewHTTPError(http.StatusBadRequest, "thread_id and prompt are required")
    }

    run, err := h.service.ResumeThread(c.Request().Context(), threadID, prompt)
    if err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, err.Error())
    }

    sse := datastar.NewSSE(c.Response().Writer, c.Request())
    return sse.Redirect(fmt.Sprintf("/agent-chat?thread=%s&run=%s", threadID, run.ID))
}
```

**`server/services/agentchat/page_chat.templ`** (modify): use `/agent-chat/resume` when a current thread exists, and keep `/agent-chat/send` only for the no-thread case.

```templ
{{
    formAction := "/agent-chat/send"
    if args.CurrentThread != nil {
        formAction = "/agent-chat/resume"
    }
}}
<form class="border-t p-4" data-on-submit={ "@post('" + formAction + "', {contentType: 'form'})" }>
    <input type="hidden" name="thread_id" value={ getThreadID(args.CurrentThread) }/>
    <input type="hidden" name="cwd" value=""/>
    <textarea name="prompt" class="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Continue from the latest durable head"></textarea>
    <button type="submit" class="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Send</button>
</form>
```

**`server/services/agentchat/templates.templ`** (modify): add a light “run state” header above the transcript so the page makes it obvious that a new run was created for the follow-up.

```templ
templ RunHeader(activeRun *db.AgentRun) {
    <div id="agent-chat-run-header" class="border-b px-4 py-3 text-xs text-muted-foreground">
        if activeRun == nil {
            <span>No run selected.</span>
        } else {
            <span>Run </span><code>{ activeRun.ID }</code><span> · status { activeRun.Status }</span>
        }
    </div>
}
```

Render that inside the main pane above `agent-chat-messages`, and patch it inside `patchTranscriptAndSidebar` whenever the state notifier fires.

### Tests

**`server/services/agentchat/service_test.go`**:

```go
func TestBuildSnapshotReturnsRootToHeadOnly(t *testing.T) {
    service := newTestAgentChatService(t)
    thread := mustCreateAgentThread(t, service, "thread-1", "user@example.com", "/tmp/project", "lineage-1")
    mustCreateAgentEntry(t, service, thread.LineageID, "root", "", "message", `{"type":"message","id":"root","parentId":null,"timestamp":"2026-04-19T12:00:00Z","message":{"role":"user","content":"one"}}`)
    mustCreateAgentEntry(t, service, thread.LineageID, "branch-a", "root", "message", `{"type":"message","id":"branch-a","parentId":"root","timestamp":"2026-04-19T12:00:01Z","message":{"role":"assistant","content":"a"}}`)
    mustCreateAgentEntry(t, service, thread.LineageID, "branch-b", "root", "message", `{"type":"message","id":"branch-b","parentId":"root","timestamp":"2026-04-19T12:00:02Z","message":{"role":"assistant","content":"b"}}`)
    _ = service.queries.UpdateAgentThreadHead(context.Background(), db.UpdateAgentThreadHeadParams{ID: thread.ID, HeadEntryID: sql.NullString{String: "branch-b", Valid: true}})

    snapshot, err := service.BuildSnapshot(context.Background(), thread.ID, "")
    if err != nil {
        t.Fatalf("BuildSnapshot() error = %v", err)
    }

    got := make([]string, 0, len(snapshot.Entries))
    for _, entry := range snapshot.Entries {
        got = append(got, entry.EntryID)
    }
    want := []string{"root", "branch-b"}
    if diff := cmp.Diff(want, got); diff != "" {
        t.Fatalf("snapshot path mismatch (-want +got):\n%s", diff)
    }
}
```

**`server/services/agentchat/handler_test.go`**:

```go
func TestResumeThreadValidation(t *testing.T) {
    service := newTestAgentChatService(t)
    handler := NewHandler(service, nil)

    form := url.Values{}
    form.Set("thread_id", "thread-1")
    req := httptest.NewRequest(http.MethodPost, "/agent-chat/resume", strings.NewReader(form.Encode()))
    req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
    rec := httptest.NewRecorder()
    c := echo.New().NewContext(req, rec)

    if err := handler.ResumeThread(c); err == nil {
        t.Fatal("ResumeThread() error = nil, want validation error")
    }
}
```

### Verify
```bash
just build

go test ./server/services/agentchat

PLAYWRIGHT_MCP_BROWSER=chromium PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/chromium just playwright-auth 'http://localhost:4200/agent-chat'
```
Then: open an existing thread, send a follow-up prompt, wait for the second assistant response, reload, and confirm both turns are present even though the handler redirected to a fresh `run=` URL.

---

## Slice 3: Fork from an earlier message with shared ancestry

### Files
- `server/services/agentchat/service.go` (modify)
- `server/services/agentchat/handler.go` (modify)
- `server/services/agentchat/templates.templ` (modify)
- `server/services/agentchat/service_test.go` (modify)
- `server/services/agentchat/handler_test.go` (modify)

### Changes

**`server/services/agentchat/service.go`** (modify): add fork semantics that preserve shared history by reference and only move the new thread head to the Pi-correct restore position.

```go
func resolveForkRestoreHead(entryType string, entryID string, parentEntryID string) (string, error) {
    switch entryType {
    case "message", "custom_message":
        if parentEntryID == "" {
            return "", nil
        }
        return parentEntryID, nil
    case "branch_summary", "compaction", "model_change", "thinking_level_change":
        return entryID, nil
    default:
        return entryID, nil
    }
}

func (s *Service) ForkThread(ctx context.Context, sourceThreadID, sourceEntryID, prompt string) (*db.AgentThread, *db.AgentRun, error) {
    if s.temporal == nil {
        return nil, nil, fmt.Errorf("temporal not configured")
    }
    if strings.TrimSpace(prompt) == "" {
        return nil, nil, fmt.Errorf("prompt is required")
    }

    sourceThread, err := s.queries.GetAgentThread(ctx, sourceThreadID)
    if err != nil {
        return nil, nil, err
    }
    sourceEntry, err := s.queries.GetAgentEntry(ctx, db.GetAgentEntryParams{LineageID: sourceThread.LineageID, EntryID: sourceEntryID})
    if err != nil {
        return nil, nil, err
    }

    var payload struct {
        Type     string `json:"type"`
        ID       string `json:"id"`
        ParentID string `json:"parentId"`
    }
    if err := json.Unmarshal([]byte(sourceEntry.PayloadJSON), &payload); err != nil {
        return nil, nil, err
    }

    restoreHeadID, err := resolveForkRestoreHead(payload.Type, payload.ID, payload.ParentID)
    if err != nil {
        return nil, nil, err
    }

    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return nil, nil, err
    }
    defer tx.Rollback()

    q := s.queries.WithTx(tx)
    thread, err := q.CreateAgentThread(ctx, db.CreateAgentThreadParams{
        ID:                uuid.NewString(),
        UserEmail:         sourceThread.UserEmail,
        Title:             truncateTitle(prompt),
        Cwd:               sourceThread.Cwd,
        LineageID:         sourceThread.LineageID,
        HeadEntryID:       sql.NullString{String: restoreHeadID, Valid: restoreHeadID != ""},
        ParentThreadID:    sql.NullString{String: sourceThread.ID, Valid: true},
        ForkedFromEntryID: sql.NullString{String: sourceEntryID, Valid: true},
    })
    if err != nil {
        return nil, nil, err
    }

    run, err := s.createRunAndStartWorkflow(ctx, q, thread, conversation.RunTriggerFork, prompt, sql.NullString{String: restoreHeadID, Valid: restoreHeadID != ""})
    if err != nil {
        return nil, nil, err
    }

    if err := tx.Commit(); err != nil {
        return nil, nil, err
    }
    s.notifier.Notify(sourceThread.ID)
    s.notifier.Notify(thread.ID)
    return &thread, run, nil
}
```

**`server/services/agentchat/handler.go`** (modify): add the fork route.

```go
func (h *Handler) RegisterRoutes(g *echo.Group) {
    g.GET("", h.HandleChatPage)
    g.GET("/stream", h.StreamThread)
    g.POST("/send", h.SendPrompt)
    g.POST("/resume", h.ResumeThread)
    g.POST("/fork", h.ForkThread)
}

func (h *Handler) ForkThread(c echo.Context) error {
    sourceThreadID := strings.TrimSpace(c.FormValue("source_thread_id"))
    sourceEntryID := strings.TrimSpace(c.FormValue("source_entry_id"))
    prompt := strings.TrimSpace(c.FormValue("prompt"))
    if sourceThreadID == "" || sourceEntryID == "" || prompt == "" {
        return echo.NewHTTPError(http.StatusBadRequest, "source_thread_id, source_entry_id, and prompt are required")
    }

    thread, run, err := h.service.ForkThread(c.Request().Context(), sourceThreadID, sourceEntryID, prompt)
    if err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, err.Error())
    }

    sse := datastar.NewSSE(c.Response().Writer, c.Request())
    return sse.Redirect(fmt.Sprintf("/agent-chat?thread=%s&run=%s", thread.ID, run.ID))
}
```

**`server/services/agentchat/templates.templ`** (modify): add a minimal fork form beneath each visible transcript message instead of inventing a client-side branch state machine.

```templ
templ TranscriptForkForm(threadID string, msg TranscriptMessage) {
    if msg.ShowForkForm {
        <details class="mt-2">
            <summary class="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">Fork from this message</summary>
            <form class="mt-2 space-y-2" data-on-submit="@post('/agent-chat/fork', {contentType: 'form'})">
                <input type="hidden" name="source_thread_id" value={ threadID }/>
                <input type="hidden" name="source_entry_id" value={ msg.EntryID }/>
                <textarea name="prompt" class="min-h-[84px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs" placeholder="Write the alternative continuation"></textarea>
                <button type="submit" class="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">Create Fork</button>
            </form>
        </details>
    }
}
```

Render `@TranscriptForkForm(args.CurrentThread.ID, msg)` directly below each completed message bubble.

### Tests

**`server/services/agentchat/service_test.go`**:

```go
func TestResolveForkRestoreHeadUsesParentForMessageEntries(t *testing.T) {
    got, err := resolveForkRestoreHead("message", "entry-2", "entry-1")
    if err != nil {
        t.Fatalf("resolveForkRestoreHead() error = %v", err)
    }
    if got != "entry-1" {
        t.Fatalf("restore head = %q, want parent entry", got)
    }
}

func TestForkThreadSharesLineageAndStoresForkOrigin(t *testing.T) {
    service := newTestAgentChatServiceWithTemporalStub(t)
    sourceThread := mustCreateAgentThread(t, service, "thread-1", "user@example.com", "/tmp/project", "lineage-1")
    mustCreateAgentEntry(t, service, sourceThread.LineageID, "user-1", "", "message", `{"type":"message","id":"user-1","parentId":null,"timestamp":"2026-04-19T12:00:00Z","message":{"role":"user","content":"hello"}}`)

    thread, _, err := service.ForkThread(context.Background(), sourceThread.ID, "user-1", "new direction")
    if err != nil {
        t.Fatalf("ForkThread() error = %v", err)
    }
    if thread.LineageID != sourceThread.LineageID {
        t.Fatalf("LineageID = %q, want shared lineage %q", thread.LineageID, sourceThread.LineageID)
    }
    if !thread.ForkedFromEntryID.Valid || thread.ForkedFromEntryID.String != "user-1" {
        t.Fatalf("ForkedFromEntryID = %v, want user-1", thread.ForkedFromEntryID)
    }
}
```

**`server/services/agentchat/handler_test.go`**:

```go
func TestForkThreadValidation(t *testing.T) {
    service := newTestAgentChatService(t)
    handler := NewHandler(service, nil)

    form := url.Values{}
    form.Set("source_thread_id", "thread-1")
    form.Set("source_entry_id", "entry-1")
    req := httptest.NewRequest(http.MethodPost, "/agent-chat/fork", strings.NewReader(form.Encode()))
    req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
    rec := httptest.NewRecorder()
    c := echo.New().NewContext(req, rec)

    if err := handler.ForkThread(c); err == nil {
        t.Fatal("ForkThread() error = nil, want validation error")
    }
}
```

### Verify
```bash
just build

go test ./server/services/agentchat

PLAYWRIGHT_MCP_BROWSER=chromium PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/chromium just playwright-auth 'http://localhost:4200/agent-chat'
```
Then: fork from an earlier message, confirm a new thread appears in the left sidebar, and verify the original thread still shows the old continuation while the new thread diverges from the fork point.

---

## Slice 4: Right-hand artifact pane with run-scoped file tree

### Files
- `server/services/agentchat/args.go` (modify)
- `server/services/agentchat/service.go` (modify)
- `server/services/agentchat/handler.go` (modify)
- `server/services/agentchat/page_chat.templ` (modify)
- `server/services/agentchat/templates.templ` (modify)
- `server/services/agentchat/service_test.go` (modify)
- `server/services/agentchat/handler_test.go` (modify)

### Changes

**`server/services/agentchat/service.go`** (modify): replace the placeholder artifact pane with a real run-scoped file tree rooted at `agent_runs.artifact_root`.

```go
func (s *Service) BuildArtifactPane(ctx context.Context, threadID, runID, selectedPath string) (ArtifactPaneState, error) {
    var run db.AgentRun
    var err error
    if strings.TrimSpace(runID) != "" {
        run, err = s.queries.GetAgentRun(ctx, runID)
    } else {
        run, err = s.queries.GetLatestAgentRunByThread(ctx, threadID)
    }
    if err != nil {
        return ArtifactPaneState{}, nil
    }

    root := strings.TrimSpace(run.ArtifactRoot)
    if root == "" {
        return ArtifactPaneState{ActiveRunID: run.ID}, nil
    }

    files, err := listRenderableArtifacts(root)
    if err != nil {
        return ArtifactPaneState{}, err
    }

    if selectedPath == "" && len(files) > 0 {
        selectedPath = files[0]
    }

    selected, err := s.renderArtifact(root, selectedPath)
    if err != nil {
        return ArtifactPaneState{}, err
    }

    return ArtifactPaneState{
        ActiveRunID:  run.ID,
        ArtifactRoot: root,
        Tree:         buildArtifactTree(files, selectedPath),
        Selected:     selected,
    }, nil
}

func listRenderableArtifacts(root string) ([]string, error) {
    files := []string{}
    err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
        if err != nil {
            return err
        }
        if d.IsDir() {
            name := d.Name()
            if name == ".git" || name == "node_modules" || strings.HasPrefix(name, ".pi") {
                return filepath.SkipDir
            }
            return nil
        }
        rel, err := filepath.Rel(root, path)
        if err != nil {
            return err
        }
        switch strings.ToLower(filepath.Ext(rel)) {
        case ".md", ".txt", ".json", ".yaml", ".yml":
            files = append(files, rel)
        }
        return nil
    })
    sort.Strings(files)
    return files, err
}

func (s *Service) renderArtifact(root, relPath string) (ArtifactRenderView, error) {
    if strings.TrimSpace(relPath) == "" {
        return ArtifactRenderView{RootPath: root, Exists: false}, nil
    }
    clean := filepath.Clean(relPath)
    if clean == "." || strings.HasPrefix(clean, "..") {
        return ArtifactRenderView{}, fmt.Errorf("artifact path traversal is not allowed")
    }

    abs := filepath.Join(root, clean)
    content, err := os.ReadFile(abs)
    if err != nil {
        if errors.Is(err, os.ErrNotExist) {
            return ArtifactRenderView{RootPath: root, RelativePath: clean, DisplayName: filepath.Base(clean), Exists: false}, nil
        }
        return ArtifactRenderView{}, err
    }

    html := s.renderer.MarkdownBytesToHTML(content)
    return ArtifactRenderView{
        RootPath:     root,
        RelativePath: clean,
        DisplayName:  filepath.Base(clean),
        HTML:         html,
        Sections:     s.renderer.RenderToSections(content),
        Exists:       true,
    }, nil
}
```

Also update `BuildPageArgs` so it populates `ArtifactPane` from the selected run on initial page render.

**`server/services/agentchat/handler.go`** (modify): add the artifact selection endpoint and keep it pane-scoped.

```go
func (h *Handler) RegisterRoutes(g *echo.Group) {
    g.GET("", h.HandleChatPage)
    g.GET("/stream", h.StreamThread)
    g.POST("/send", h.SendPrompt)
    g.POST("/resume", h.ResumeThread)
    g.POST("/fork", h.ForkThread)
    g.POST("/artifacts/select", h.SelectArtifact)
}

func (h *Handler) SelectArtifact(c echo.Context) error {
    threadID := strings.TrimSpace(c.FormValue("thread_id"))
    runID := strings.TrimSpace(c.FormValue("run_id"))
    relPath := strings.TrimSpace(c.FormValue("artifact"))

    pane, err := h.service.BuildArtifactPane(c.Request().Context(), threadID, runID, relPath)
    if err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, err.Error())
    }

    sse := datastar.NewSSE(c.Response().Writer, c.Request())
    return sse.PatchElementTempl(
        ArtifactPane(pane, threadID),
        datastar.WithSelectorID("agent-chat-artifact-pane"),
        datastar.WithModeInner(),
    )
}
```

**`server/services/agentchat/page_chat.templ`** and **`templates.templ`** (modify): replace the placeholder right column with the copied file-tree pattern from `server/services/pipelines/templates.templ`.

```templ
templ ArtifactPane(state ArtifactPaneState, threadID string) {
    <div id="agent-chat-artifact-pane" class="rounded-lg border border-border bg-card p-4">
        <p class="text-sm font-medium text-foreground">Artifacts</p>
        if state.ArtifactRoot != "" {
            <p class="mt-1 break-all text-xs text-muted-foreground">{ state.ArtifactRoot }</p>
        }
        if len(state.Tree) == 0 {
            <p class="mt-3 text-xs text-muted-foreground">No renderable artifacts yet.</p>
        } else {
            <div class="mt-3 space-y-2">
                for _, node := range state.Tree {
                    @ArtifactTreeNodeRow(node, threadID, state.ActiveRunID)
                }
            </div>
        }
        <div class="mt-4 rounded-md border border-border/60 p-3">
            if state.Selected.Exists {
                <p class="text-xs font-medium text-foreground">{ state.Selected.DisplayName }</p>
                <p class="mb-3 break-all text-[11px] text-muted-foreground">{ state.Selected.RelativePath }</p>
                <div class="prose prose-invert max-w-none">
                    @templ.Raw(state.Selected.HTML)
                </div>
            } else {
                <p class="text-xs text-muted-foreground">Select an artifact file to render it here.</p>
            }
        </div>
    </div>
}

templ ArtifactTreeNodeRow(node ArtifactTreeNode, threadID string, runID string) {
    if node.IsDir {
        <div class="rounded-md border border-border/60 p-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ node.Name }</p>
            if len(node.Children) > 0 {
                <div class="mt-2 space-y-1">
                    for _, child := range node.Children {
                        @ArtifactTreeNodeRow(child, threadID, runID)
                    }
                </div>
            }
        </div>
    } else {
        <form data-on-submit="@post('/agent-chat/artifacts/select', {contentType: 'form'})">
            <input type="hidden" name="thread_id" value={ threadID }/>
            <input type="hidden" name="run_id" value={ runID }/>
            <input type="hidden" name="artifact" value={ node.Path }/>
            <button type="submit" class={ "w-full rounded-md px-2 py-1 text-left text-xs transition-colors", templ.KV("bg-primary/10 text-primary", node.Selected), templ.KV("text-muted-foreground hover:bg-muted", !node.Selected) }>{ node.Name }</button>
        </form>
    }
}
```

### Tests

**`server/services/agentchat/service_test.go`**:

```go
func TestBuildArtifactPaneRejectsTraversal(t *testing.T) {
    service := newTestAgentChatService(t)
    _, err := service.renderArtifact("/tmp/project", "../secrets.md")
    if err == nil {
        t.Fatal("renderArtifact() error = nil, want traversal rejection")
    }
}

func TestBuildArtifactPaneListsMarkdownFiles(t *testing.T) {
    service := newTestAgentChatService(t)
    root := t.TempDir()
    mustWriteFile(t, filepath.Join(root, "plan.md"), "# Plan")
    mustWriteFile(t, filepath.Join(root, "notes.txt"), "hello")
    mustWriteFile(t, filepath.Join(root, "ignore.png"), "png")

    files, err := listRenderableArtifacts(root)
    if err != nil {
        t.Fatalf("listRenderableArtifacts() error = %v", err)
    }
    want := []string{"notes.txt", "plan.md"}
    if diff := cmp.Diff(want, files); diff != "" {
        t.Fatalf("artifact file list mismatch (-want +got):\n%s", diff)
    }
}
```

**`server/services/agentchat/handler_test.go`**:

```go
func TestSelectArtifactPatchesArtifactPaneOnly(t *testing.T) {
    service := newTestAgentChatService(t)
    handler := NewHandler(service, nil)

    root := t.TempDir()
    mustCreateAgentThread(t, service, "thread-1", "user@example.com", root, "lineage-1")
    mustCreateAgentRunWithRoot(t, service, "run-1", "thread-1", root)
    mustWriteFile(t, filepath.Join(root, "plan.md"), "# Plan\n\nBody")

    form := url.Values{}
    form.Set("thread_id", "thread-1")
    form.Set("run_id", "run-1")
    form.Set("artifact", "plan.md")

    req := httptest.NewRequest(http.MethodPost, "/agent-chat/artifacts/select", strings.NewReader(form.Encode()))
    req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
    rec := httptest.NewRecorder()
    c := echo.New().NewContext(req, rec)

    if err := handler.SelectArtifact(c); err != nil {
        t.Fatalf("SelectArtifact() error = %v", err)
    }

    body := rec.Body.String()
    if !strings.Contains(body, "agent-chat-artifact-pane") {
        t.Fatalf("response did not patch artifact pane: %s", body)
    }
    if strings.Contains(body, "agent-chat-messages") {
        t.Fatalf("response unexpectedly patched transcript: %s", body)
    }
}
```

### Verify
```bash
just build

go test ./server/services/agentchat

PLAYWRIGHT_MCP_BROWSER=chromium PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/chromium just playwright-auth 'http://localhost:4200/agent-chat'
```
Then: open a thread whose active run wrote markdown files, click two artifact files in the right pane, and confirm only the artifact pane changes while the center transcript remains stable.
