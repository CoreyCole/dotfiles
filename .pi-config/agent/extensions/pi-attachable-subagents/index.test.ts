import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __test__ } from "./index.ts";
import { inspectSession, seedSubagentSessionFile } from "./session.ts";
import { createStatusState } from "./status.ts";

type AttachCandidate = Parameters<
  typeof __test__.resolveAttachTarget
>[0][number];

function candidate(id: string, name: string): AttachCandidate {
  return {
    id,
    name,
    task: "test",
    surface: `%${id}`,
    startTime: 0,
    firstStartTime: 0,
    accumulatedActiveMs: 0,
    sessionFile: "/tmp/test.jsonl",
    statusState: createStatusState({ source: "pi", startTimeMs: 0 }),
  };
}

const agents = [
  candidate("abcd1234", "Scout"),
  candidate("abcd5678", "Worker"),
  candidate("ef901234", "Scout"),
];

test("native child header is materialized with its stable UUID before dispatch", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-native-child-"));
  const parent = join(dir, "manager.jsonl");
  const child = join(dir, "child.jsonl");
  const childSessionId = "7cae45bd-7dc3-4ee8-87d4-e57996249e93";
  writeFileSync(
    parent,
    JSON.stringify({ type: "session", id: "manager" }) + "\n",
  );
  try {
    assert.equal(
      seedSubagentSessionFile({
        mode: "lineage-only",
        parentSessionFile: parent,
        childSessionFile: child,
        childCwd: "/work",
        childSessionId,
      }),
      childSessionId,
    );
    assert.equal(
      JSON.parse(readFileSync(child, "utf8").split("\n")[0]).id,
      childSessionId,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("active-branch child registrations replay idempotently and reject foreign owners", () => {
  const registration = (
    childSessionId: string,
    managerSessionId = "manager",
  ) => ({
    type: "custom",
    customType: __test__.CHILD_SESSION_CUSTOM_TYPE,
    data: {
      version: 1,
      managerSessionId,
      childSessionId,
      name: "Worker",
      agent: "worker",
      cwd: "/work",
    },
  });
  const active = [
    registration("one"),
    registration("two"),
    registration("one"),
    registration("foreign", "other"),
  ];
  assert.deepEqual(
    [
      ...__test__
        .replayChildCatalog({ id: "manager" }, "manager", active)
        .keys(),
    ],
    ["one", "two"],
  );
  assert.equal(
    __test__.replayChildCatalog({ id: "fork" }, "manager", active).size,
    0,
  );
});

test("historical tool results recover valid native children and ignore missing duplicates", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-tool-result-child-"));
  const child = join(dir, "child.jsonl");
  const id = "d970b457-d651-49f8-b2c3-59292290a459";
  writeFileSync(
    child,
    JSON.stringify({ type: "session", id, cwd: "/work" }) + "\n",
  );
  try {
    const recovered = __test__.migrateHistoricalToolResults(
      { id: "manager" },
      "manager",
      [
        {
          type: "message",
          details: { name: "Done worker", agent: "worker", sessionFile: child },
        },
        { type: "message", details: { name: "duplicate", sessionFile: child } },
        {
          type: "message",
          details: {
            name: "false launch",
            sessionFile: join(dir, "missing.jsonl"),
          },
        },
      ],
      new Map(),
    );
    assert.deepEqual(recovered, [
      {
        managerSessionId: "manager",
        childSessionId: id,
        name: "Done worker",
        agent: "worker",
        cwd: "/work",
      },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("legacy snapshots migrate native child headers once without process state", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-legacy-child-"));
  const file = join(dir, "child.jsonl");
  const parent = join(dir, "manager.jsonl");
  writeFileSync(
    parent,
    JSON.stringify({ type: "session", id: "manager" }) + "\n",
  );
  try {
    seedSubagentSessionFile({
      mode: "lineage-only",
      parentSessionFile: parent,
      childSessionFile: file,
      childCwd: "/work",
      childSessionId: "native-child",
    });
    const legacy = __test__.serializeResumableSnapshot("manager", [
      makeResumable("synthetic", file),
    ]);
    const recovered = __test__.migrateLegacySnapshots(
      { id: "manager" },
      "manager",
      [snapshotEntry(legacy)],
      new Map(),
    );
    assert.deepEqual(recovered, [
      {
        managerSessionId: "manager",
        childSessionId: "native-child",
        name: "Worker synthetic",
        agent: "worker",
        cwd: "/work",
      },
    ]);
    assert.deepEqual(
      __test__.migrateLegacySnapshots(
        { id: "manager" },
        "manager",
        [snapshotEntry(legacy)],
        new Map([["native-child", recovered[0]]]),
      ),
      [],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("one resolved Pi profile preserves flags and environment across runs", () => {
  const profile = {
    sessionFile: "/session",
    activityFile: "/activity",
    cwdPrefix: "cd '/work' && ",
    environment: ["PI_CODING_AGENT_DIR='/config'", "PI_SUBAGENT_ID='abc'"],
    arguments: ["pi", "--session", "'/session'", "--model", "'model:high'"],
    selectedSkills: ["q-outline"],
  };
  const initial = __test__.buildPiLaunchCommand(profile, {
    surface: "%1",
    promptArguments: ["first"],
    originalLaunch: true,
  });
  const resumed = __test__.buildPiLaunchCommand(profile, {
    surface: "%2",
    promptArguments: ["next"],
    originalLaunch: false,
  });
  for (const stable of [...profile.environment, ...profile.arguments]) {
    assert.equal(initial.includes(stable), true);
    assert.equal(resumed.includes(stable), true);
  }
  assert.match(initial, /PI_SUBAGENT_SKILLS=/);
  assert.doesNotMatch(resumed, /PI_SUBAGENT_SKILLS=/);
});

test("model arguments preserve explicit and suffixed models", () => {
  assert.equal(
    __test__.resolveModelArgument("openai/gpt:max", "agent", "high"),
    "openai/gpt:max",
  );
  assert.equal(
    __test__.resolveModelArgument("openai/gpt", "agent", "high"),
    "openai/gpt",
  );
  assert.equal(
    __test__.resolveModelArgument(undefined, "agent:low", "high"),
    "agent:low",
  );
  assert.equal(
    __test__.resolveModelArgument(undefined, "agent", "high"),
    "agent:high",
  );
  assert.equal(
    __test__.resolveModelArgument(undefined, undefined, "high"),
    undefined,
  );
});

test("system prompt arguments keep agent and caller prompts separate and ordered", () => {
  assert.deepEqual(
    __test__.buildSystemPromptArguments({
      agentBodyPath: "/agent",
      agentMode: "append",
      callerPromptPath: "/caller",
    }),
    [
      "--append-system-prompt",
      "'/agent'",
      "--append-system-prompt",
      "'/caller'",
    ],
  );
  assert.deepEqual(
    __test__.buildSystemPromptArguments({
      agentBodyPath: "/agent",
      agentMode: "replace",
      callerPromptPath: "/caller",
    }),
    ["--system-prompt", "'/agent'", "--append-system-prompt", "'/caller'"],
  );
  assert.deepEqual(
    __test__.buildSystemPromptArguments({ callerPromptPath: "/caller" }),
    ["--append-system-prompt", "'/caller'"],
  );
});

test("initial fork task includes lifecycle guidance without identity text", () => {
  const task = __test__.buildInitialTask("Do the work.");
  assert.equal(task.match(/caller_ping/g)?.length, 1);
  assert.equal(task.match(/subagent_done/g)?.length, 1);
  assert.match(task, /Do the work\./);
  assert.doesNotMatch(task, /agent body|caller prompt|inherited transcript/);
});

test("active runtime accumulates across runs and stale finalizers do not accrue", () => {
  const running = candidate("timer", "Timer");
  running.startTime = 1_000;
  running.firstStartTime = 1_000;
  running.processState = "active";
  running.runId = 1;
  assert.equal(__test__.getActiveRuntimeMs(running, 4_000), 3_000);
  assert.equal(__test__.finalizeActiveRun(running, 1, 4_000), true);
  running.processState = "resumable";
  assert.equal(__test__.getActiveRuntimeMs(running, 10_000), 3_000);
  running.startTime = 20_000;
  running.processState = "active";
  running.runId = 2;
  assert.equal(__test__.getActiveRuntimeMs(running, 22_000), 5_000);
  assert.equal(__test__.finalizeActiveRun(running, 1, 22_000), false);
  assert.equal(running.accumulatedActiveMs, 3_000);
});

test("widget rows keep status first and fit wide and narrow widths", () => {
  const running = candidate("widget", "A very long worker name");
  const previousTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  running.firstStartTime = Date.UTC(2026, 7, 22, 0, 54);
  running.processState = "resumable";
  for (const width of [80, 24]) {
    for (const line of __test__.renderSubagentWidgetLines(
      [running],
      width,
      10_000,
    )) {
      assert.ok(line.replace(/\x1b\[[0-9;]*m/g, "").length <= width);
    }
  }
  assert.equal(__test__.formatLocalStartTime(running.firstStartTime), "17:54");
  assert.match(
    __test__.renderSubagentWidgetLines([running], 80, 10_000)[1],
    /stopped · resumable · 17:54/,
  );
  if (previousTz == null) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

test("human target selection uses the picker without empty resolution", async () => {
  const picked = await __test__.selectHumanTarget(
    agents.slice(0, 2),
    undefined,
    async (_title, options) => options[1],
  );
  assert.equal(
    picked && "running" in picked ? picked.running.id : "",
    "abcd5678",
  );
  const canceled = await __test__.selectHumanTarget(
    agents.slice(0, 2),
    undefined,
    async () => undefined,
  );
  assert.equal(canceled, undefined);
});

test("resolveAttachTarget prefers an exact ID", () => {
  const result = __test__.resolveAttachTarget(agents, "abcd1234");
  assert.equal("running" in result && result.running.id, "abcd1234");
});

test("resolveAttachTarget accepts a unique ID prefix", () => {
  const result = __test__.resolveAttachTarget(agents, "ef90");
  assert.equal("running" in result && result.running.id, "ef901234");
});

test("resolveAttachTarget accepts an exact unique name", () => {
  const result = __test__.resolveAttachTarget(agents, "Worker");
  assert.equal("running" in result && result.running.id, "abcd5678");
});

test("resolveAttachTarget reports no match", () => {
  const result = __test__.resolveAttachTarget(agents, "missing");
  assert.deepEqual(result, { error: 'No running subagent matches "missing".' });
});

test("resolveAttachTarget rejects ambiguous prefixes and names", () => {
  const prefix = __test__.resolveAttachTarget(agents, "abcd");
  const name = __test__.resolveAttachTarget(agents, "Scout");
  assert.match("error" in prefix ? prefix.error : "", /Ambiguous subagent/);
  assert.match("error" in name ? name.error : "", /Ambiguous subagent/);
});

test("watcher ownership is isolated across cached extension factory invocations", () => {
  const oldInstance = __test__.createWatcherOwner();
  const newInstance = __test__.createWatcherOwner();

  oldInstance.abort();

  assert.equal(oldInstance.signal.aborted, true);
  assert.equal(oldInstance.shutdown, true);
  assert.equal(newInstance.signal.aborted, false);
  assert.equal(newInstance.shutdown, false);
});

test("shutdown cancellation suppresses false child failures", () => {
  const running = candidate("shutdown1234", "Shutting down");
  running.shutdownCancelled = true;
  assert.equal(__test__.shouldDeliverWatcherNotification(running), false);
});

test("infrastructure watcher failures remove unstarted transient runs", () => {
  const running = candidate("missing1234", "Never started");
  __test__.runningSubagents.set(running.id, running);

  __test__.cleanupFailedWatcherRun(running);

  assert.equal(__test__.runningSubagents.has(running.id), false);
});

test("explicit stops suppress watcher success and rejection notifications", () => {
  const running = candidate("stop1234", "Stopped");
  assert.equal(__test__.shouldDeliverWatcherNotification(running), true);

  running.explicitlyStopped = true;
  assert.equal(__test__.shouldDeliverWatcherNotification(running), false);
});

test("subagent task calls expand from a preview to the full prompt", () => {
  const task = "First line that identifies the task\nSecond line with details";
  assert.deepEqual(__test__.formatSubagentTaskCall(task, false), {
    body: "First line that identifies the task",
    lineCount: 2,
    expandable: true,
  });
  assert.deepEqual(__test__.formatSubagentTaskCall(task, true), {
    body: task,
    lineCount: 2,
    expandable: false,
  });
});

test("files and the task are loaded in the first CLI turn", () => {
  const build = __test__.buildPiPromptArgs as unknown as (params: {
    files: string[];
    taskArg: string;
  }) => string[];

  assert.deepEqual(
    build({
      files: ["context.md", "@fixture.json"],
      taskArg: "@task.md",
    }),
    ["@context.md", "@fixture.json", "@task.md"],
  );
});

function makeResumable(
  id: string,
  sessionFile: string,
  activityFile = `${sessionFile}.activity`,
): AttachCandidate {
  const running = candidate(id, `Worker ${id}`);
  running.task = `Task ${id}`;
  running.agent = "worker";
  running.firstStartTime = 1_000;
  running.accumulatedActiveMs = 12_345;
  running.processState = "resumable";
  running.sessionFile = sessionFile;
  running.activityFile = activityFile;
  running.launchProfile = {
    sessionFile,
    activityFile,
    cwdPrefix: "cd '/work' && ",
    environment: ["PI_SUBAGENT_ID='stable'"],
    arguments: ["pi", "--session", `'${sessionFile}'`],
    selectedSkills: ["q-implement"],
  };
  return running;
}

function snapshotEntry(data: unknown) {
  return {
    type: "custom",
    customType: __test__.RESUMABLE_SNAPSHOT_CUSTOM_TYPE,
    data,
  };
}

test("snapshot serialization contains only complete resumable Pi records", () => {
  const resumable = makeResumable("saved", "/session/saved.jsonl");
  resumable.surface = "%runtime";
  resumable.startTime = 99_999;
  resumable.runId = 7;
  resumable.explicitlyStopped = false;
  resumable.abortController = new AbortController();
  const active = makeResumable("active", "/session/active.jsonl");
  active.processState = "active";
  const claude = makeResumable("claude", "/session/claude.jsonl");
  claude.cli = "claude";
  const invalid = makeResumable("invalid", "/session/invalid.jsonl");
  invalid.launchProfile = { ...invalid.launchProfile!, cwdPrefix: "" };

  const snapshot = __test__.serializeResumableSnapshot("manager", [
    resumable,
    active,
    claude,
    invalid,
  ]);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.ownerSessionId, "manager");
  assert.equal(snapshot.records.length, 1);
  assert.deepEqual(snapshot.records[0], {
    id: "saved",
    name: "Worker saved",
    task: "Task saved",
    agent: "worker",
    firstStartTime: 1_000,
    accumulatedActiveMs: 12_345,
    launchProfile: {
      sessionFile: "/session/saved.jsonl",
      activityFile: "/session/saved.jsonl.activity",
      cwdPrefix: "cd '/work' && ",
      environment: ["PI_SUBAGENT_ID='stable'"],
      arguments: ["pi", "--session", "'/session/saved.jsonl'"],
      selectedSkills: ["q-implement"],
    },
  });
  const serialized = JSON.stringify(snapshot.records[0]);
  for (const runtimeField of [
    "surface",
    "startTime",
    "processState",
    "runId",
    "explicitlyStopped",
    "abortController",
    "activity",
    "activityRead",
    "launchScriptFile",
    "sentinelFile",
    "statusState",
  ]) {
    assert.equal(serialized.includes(`\"${runtimeField}\"`), false);
  }
});

test("snapshot restore round-trips stable identity, profile, and frozen runtime", () => {
  const running = makeResumable("stable", "/session/stable.jsonl");
  const snapshot = __test__.serializeResumableSnapshot("manager", [running]);
  const records = __test__.restoreSnapshotRecords(
    { id: "manager" },
    "manager",
    [snapshotEntry(snapshot)],
    (path) => path === "/session/stable.jsonl",
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].id, "stable");
  assert.equal(records[0].name, "Worker stable");
  assert.equal(records[0].launchProfile.sessionFile, running.sessionFile);
  assert.equal(records[0].launchProfile.activityFile, running.activityFile);
  assert.equal(Object.isFrozen(records[0].launchProfile), true);
  assert.equal(Object.isFrozen(records[0].launchProfile.environment), true);
  assert.equal(Object.isFrozen(records[0].launchProfile.arguments), true);
  assert.equal(Object.isFrozen(records[0].launchProfile.selectedSkills), true);

  const restored = new Map<string, AttachCandidate>();
  __test__.restoreRunningSubagents(records, restored);
  const child = restored.get("stable");
  assert.ok(child);
  assert.equal(child.processState, "resumable");
  assert.equal(child.sessionFile, "/session/stable.jsonl");
  assert.equal(child.activityFile, "/session/stable.jsonl.activity");
  assert.equal(__test__.getActiveRuntimeMs(child, 9_999_999), 12_345);
});

test("active branch selection uses the newest valid replacement snapshot", () => {
  const older = __test__.serializeResumableSnapshot("manager", [
    makeResumable("older", "/older.jsonl"),
  ]);
  const active = __test__.serializeResumableSnapshot("manager", [
    makeResumable("active", "/active.jsonl"),
  ]);
  const inactiveLater = __test__.serializeResumableSnapshot("manager", [
    makeResumable("inactive", "/inactive.jsonl"),
  ]);
  const activeBranch = [
    snapshotEntry(older),
    snapshotEntry(active),
    snapshotEntry({ version: 2, ownerSessionId: "manager", records: [] }),
  ];
  const allJsonlEntries = [...activeBranch, snapshotEntry(inactiveLater)];

  assert.deepEqual(
    __test__
      .selectActiveBranchSnapshot(activeBranch, "manager", () => true)
      .map((record) => record.id),
    ["active"],
  );
  assert.deepEqual(
    __test__
      .selectActiveBranchSnapshot(allJsonlEntries, "manager", () => true)
      .map((record) => record.id),
    ["inactive"],
  );

  const empty = { version: 1, ownerSessionId: "manager", records: [] };
  assert.deepEqual(
    __test__.selectActiveBranchSnapshot(
      [...activeBranch, snapshotEntry(empty)],
      "manager",
      () => true,
    ),
    [],
  );
});

test("owner mismatch stops restore and does not fall back", () => {
  const owned = __test__.serializeResumableSnapshot("manager", [
    makeResumable("owned", "/owned.jsonl"),
  ]);
  const foreign = __test__.serializeResumableSnapshot("fork", [
    makeResumable("foreign", "/foreign.jsonl"),
  ]);
  const branch = [snapshotEntry(owned), snapshotEntry(foreign)];
  assert.deepEqual(
    __test__.restoreSnapshotRecords(
      { id: "manager" },
      "manager",
      branch,
      () => true,
    ),
    [],
  );
  assert.deepEqual(
    __test__.restoreSnapshotRecords(
      { id: "different-header" },
      "manager",
      [snapshotEntry(owned)],
      () => true,
    ),
    [],
  );
});

test("record validation skips malformed, duplicate, and missing-session records", () => {
  const valid = __test__.serializeResumableSnapshot("manager", [
    makeResumable("valid", "/valid.jsonl"),
  ]).records[0];
  const malformed = { ...valid, name: "" };
  const duplicate = { ...valid, name: "duplicate" };
  const missing = {
    ...valid,
    id: "missing",
    launchProfile: { ...valid.launchProfile, sessionFile: "/missing.jsonl" },
  };
  const envelope = {
    version: 1,
    ownerSessionId: "manager",
    records: [malformed, valid, duplicate, missing],
  };
  const records = __test__.selectActiveBranchSnapshot(
    [
      snapshotEntry({ version: 1, ownerSessionId: "manager" }),
      snapshotEntry(envelope),
    ],
    "manager",
    (path) => path === "/valid.jsonl",
  );
  assert.deepEqual(
    records.map((record) => record.id),
    ["valid"],
  );
  assert.equal(__test__.validateSnapshotEnvelope(null), undefined);
  assert.equal(
    __test__.validateSnapshotEnvelope({
      version: 99,
      ownerSessionId: "manager",
      records: [],
    }),
    undefined,
  );
});

test("resumable wake persistence runs before update and one wake", () => {
  const order: string[] = [];
  __test__.completeWakeTransition({
    persist: () => order.push("persist"),
    update: () => order.push("update"),
    wake: (warning) => {
      assert.equal(warning, undefined);
      order.push("wake");
    },
  });
  assert.deepEqual(order, ["persist", "update", "wake"]);

  const running = makeResumable("retained", "/retained.jsonl");
  const tracked = new Map([[running.id, running]]);
  let wakeCount = 0;
  __test__.completeWakeTransition({
    persist: () => {
      throw new Error("disk full");
    },
    update() {},
    wake: (warning) => {
      wakeCount++;
      assert.match(warning ?? "", /disk full/);
    },
  });
  assert.equal(wakeCount, 1);
  assert.equal(tracked.get(running.id), running);
  assert.match(
    __test__.appendPersistenceWarning("result", "warning"),
    /result\n\nwarning/,
  );
});

test("resume transition removes the snapshot before watcher start", () => {
  const order: string[] = [];
  const success = __test__.commitResumedTransition({
    persistRemoval: () => order.push("persist-removal"),
    close: () => order.push("close"),
    commit: () => order.push("commit-active"),
    startWatcher: () => order.push("watch"),
    update: () => order.push("update"),
  });
  assert.deepEqual(success, { ok: true });
  assert.deepEqual(order, [
    "persist-removal",
    "commit-active",
    "watch",
    "update",
  ]);

  let committed = false;
  let watched = false;
  let closed = false;
  const failure = __test__.commitResumedTransition({
    persistRemoval() {
      throw new Error("append failed");
    },
    close: () => {
      closed = true;
    },
    commit: () => {
      committed = true;
    },
    startWatcher: () => {
      watched = true;
    },
    update() {},
  });
  assert.equal("error" in failure, true);
  assert.equal(closed, true);
  assert.equal(committed, false);
  assert.equal(watched, false);
});

test("snapshot-aware stop retains a resumable record after append failure", () => {
  const running = makeResumable("stop", "/stop.jsonl");
  const tracked = new Map([[running.id, running]]);
  const failure = __test__.stopTrackedSubagent(running, {
    persistRemoval() {
      throw new Error("read only");
    },
    close() {},
    remove: (id) => tracked.delete(id),
    update() {},
  });
  assert.equal("error" in failure, true);
  assert.equal(tracked.has(running.id), true);
  assert.equal(running.explicitlyStopped, undefined);

  let persisted = false;
  const success = __test__.stopTrackedSubagent(running, {
    persistRemoval: () => {
      persisted = true;
    },
    close() {},
    remove: (id) => tracked.delete(id),
    update() {},
  });
  assert.deepEqual(success, { ok: true });
  assert.equal(persisted, true);
  assert.equal(tracked.has(running.id), false);

  const active = makeResumable("active-stop", "/active-stop.jsonl");
  active.processState = "active";
  let activePersisted = false;
  assert.deepEqual(
    __test__.stopTrackedSubagent(active, {
      persistRemoval: () => {
        activePersisted = true;
      },
      close() {},
      remove() {},
      update() {},
    }),
    { ok: true },
  );
  assert.equal(activePersisted, false);
});

test("restored records preserve peek, stop, and steer inputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-resumable-test-"));
  const sessionFile = join(dir, "child.jsonl");
  const activityFile = join(dir, "activity.json");
  writeFileSync(
    sessionFile,
    [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "child-session",
        timestamp: "2026-08-22T00:00:00.000Z",
        cwd: "/work",
      }),
      JSON.stringify({
        type: "message",
        id: "message1",
        parentId: null,
        timestamp: "2026-08-22T00:00:01.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "durable context" }],
          timestamp: 1,
        },
      }),
    ].join("\n") + "\n",
  );

  try {
    const original = makeResumable("control", sessionFile, activityFile);
    const snapshot = __test__.serializeResumableSnapshot("manager", [original]);
    const records = __test__.restoreSnapshotRecords(
      { id: "manager" },
      "manager",
      [snapshotEntry(snapshot)],
    );
    const restored = new Map<string, AttachCandidate>();
    __test__.restoreRunningSubagents(records, restored);
    const resolved = __test__.resolveRunningTarget(
      [...restored.values()],
      "control",
    );
    assert.equal("running" in resolved, true);
    if (!("running" in resolved)) return;
    const child = resolved.running;
    assert.equal(
      inspectSession(child.sessionFile).messages[0].text,
      "durable context",
    );
    const command = __test__.buildPiLaunchCommand(child.launchProfile!, {
      surface: "%resumed",
      promptArguments: ["continue"],
      originalLaunch: false,
    });
    assert.equal(command.includes(sessionFile), true);
    assert.equal(command.includes(activityFile), false);
    assert.equal(child.launchProfile?.activityFile, activityFile);

    let removed = false;
    assert.deepEqual(
      __test__.stopTrackedSubagent(child, {
        persistRemoval() {},
        close() {},
        remove: () => {
          removed = true;
        },
        update() {},
      }),
      { ok: true },
    );
    assert.equal(removed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
