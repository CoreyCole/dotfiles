import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import subagentsExtension, { __test__ } from "./index.ts";
import { interpretStartupPaneError } from "./cmux.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createStatusState, observeStatus, classifyStatus } from "./status.ts";
import subagentDoneExtension, {
  activityPhaseForSessionStart,
  childSessionIdentityLabel,
  settlementNotifiesParent,
} from "./subagent-done.ts";
import {
  createSubagentActivityRecorder,
  readSubagentActivityFile,
} from "./activity.ts";
import { shouldAppendToolBorder } from "../tool-border.ts";
import { TOOL_DISPLAY } from "../tool-display-style.ts";
import { requestStatsTest } from "../request-stats.ts";

afterEach(() => {
  __test__.delegatorLiveness.reset();
});

test("child registrations replay as a durable catalog", () => {
  const entry = (id: string, owner = "manager") => ({
    type: "custom",
    customType: __test__.CHILD_SESSION_CUSTOM_TYPE,
    data: {
      version: 1,
      managerSessionId: owner,
      childSessionId: id,
      name: "Planner",
      agent: "planner",
      cwd: "/work",
    },
  });
  const catalog = __test__.replayChildCatalog({ id: "manager" }, "manager", [
    entry("one"),
    entry("one"),
    entry("foreign", "other"),
  ]);
  assert.deepEqual([...catalog.keys()], ["one"]);
  assert.equal(catalog.get("one")?.autoExit, true);
});

test("auto-exit defaults to true and persists an explicit false value", () => {
  assert.equal(__test__.resolveAutoExit({}), true);
  assert.equal(__test__.resolveAutoExit({ autoExit: false }), false);
  assert.equal(
    __test__.validateChildSession({
      version: 1,
      managerSessionId: "manager",
      childSessionId: "child",
      name: "Manager",
      cwd: "/work",
      autoExit: false,
    })?.autoExit,
    false,
  );
});

test("historical migration accepts only actual manager JSONL result shapes", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-child-"));
  const managerId = "01a0212e-0be4-7eee-8ae8-a489cee0e293";
  const childId = "01a0212e-0be4-7eee-8ae8-a489cee0e294";
  const child = join(dir, "2026-08-20T21-57-50-960Z_cbdaee4c-synthetic.jsonl");
  const manager = join(dir, "manager.jsonl");
  writeFileSync(
    child,
    JSON.stringify({ type: "session", version: 3, id: childId, cwd: "/work" }) +
      "\n",
  );
  writeFileSync(
    manager,
    JSON.stringify({
      type: "session",
      version: 3,
      id: managerId,
      cwd: "/work",
    }) + "\n",
  );
  const details = {
    id: "cbdaee4c",
    name: "Worker",
    agent: "worker",
    sessionFile: child,
  };
  try {
    const recovered = __test__.migrateHistoricalToolResults(
      { id: managerId },
      managerId,
      [
        { type: "custom_message", customType: "subagent_result", details },
        { type: "custom_message", customType: "unrelated", details },
        {
          type: "message",
          message: {
            role: "toolResult",
            toolName: "read",
            details: { ...details, status: "started" },
          },
        },
        {
          type: "message",
          message: {
            role: "toolResult",
            toolName: "subagent",
            details: { ...details, status: "failed" },
          },
        },
        {
          type: "message",
          message: {
            role: "toolResult",
            toolName: "subagent",
            details: { ...details, status: "started" },
          },
        },
        {
          type: "custom_message",
          customType: "subagent_ping",
          details: { ...details, sessionFile: manager, name: "manager" },
        },
      ],
      new Map(),
    );
    assert.deepEqual(recovered, [
      {
        managerSessionId: managerId,
        childSessionId: childId,
        name: "Worker",
        agent: "worker",
        cwd: "/work",
        autoExit: true,
      },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("legacy synthetic filenames resolve by native session header UUID", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-child-cwd-"));
  const id = "01a0212e-0be4-7eee-8ae8-a489cee0e294";
  const sessionDir = join(
    cwd,
    ".pi",
    "agent",
    "sessions",
    `--${cwd.slice(1).replace(/[\\/:]/g, "-")}--`,
  );
  const sessionFile = join(
    sessionDir,
    "2026-08-20T21-57-50-960Z_cbdaee4c-synthetic.jsonl",
  );
  try {
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", version: 3, id, cwd }) + "\n",
      { encoding: "utf8", flag: "w" },
    );
    assert.equal(
      __test__.findChildSessionFile({
        managerSessionId: "manager",
        childSessionId: id,
        name: "Worker",
        cwd,
      }),
      sessionFile,
    );
    assert.equal(
      "child" in
        __test__.resolveCatalogTarget(
          [
            {
              managerSessionId: "manager",
              childSessionId: id,
              name: "Worker",
              cwd,
            },
          ],
          id.slice(0, 8),
        ),
      true,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("new child launch without an active model fails before session or surface work", async () => {
  await assert.rejects(
    __test__.launchSubagent(
      { name: "Offline", task: "Do not launch" },
      {
        cwd: "/unused",
        model: undefined,
        sessionManager: {
          getSessionFile() {
            throw new Error("must not touch session");
          },
          getSessionId() {
            throw new Error("must not register");
          },
          getSessionDir() {
            throw new Error("must not create artifacts");
          },
        },
      },
    ),
    /No active parent model/,
  );
});

test("new child launch arguments use the live immediate-parent model, not saved defaults", () => {
  const parent = { model: { provider: "live-provider", id: "active-model" } };
  const launchArgs = (model?: string, role?: string, thinking?: string) =>
    __test__.buildModelLaunchArguments(
      __test__.resolveModelArgument(model, role, thinking, parent.model),
      thinking,
    );
  assert.notEqual(
    __test__.configuredDefaultModelRef(),
    "live-provider/active-model",
  );
  assert.deepEqual(launchArgs(), ["--model", "'live-provider/active-model'"]);
  parent.model = { provider: "switched-provider", id: "switched-model" };
  assert.deepEqual(launchArgs(), [
    "--model",
    "'switched-provider/switched-model'",
  ]);
  assert.deepEqual(launchArgs(undefined, undefined, "high"), [
    "--model",
    "'switched-provider/switched-model:high'",
  ]);
  const childModel = { provider: "child-provider", id: "child-active-model" };
  assert.deepEqual(
    __test__.buildModelLaunchArguments(
      __test__.resolveModelArgument(
        undefined,
        undefined,
        undefined,
        childModel,
      ),
      undefined,
    ),
    ["--model", "'child-provider/child-active-model'"],
  );
  assert.deepEqual(launchArgs(undefined, "xai/grok-4.6", "high"), [
    "--model",
    "'xai/grok-4.6:high'",
  ]);
  assert.deepEqual(launchArgs("xai/grok-4.6:low", "invalid-role", "high"), [
    "--model",
    "'xai/grok-4.6:low'",
  ]);
  assert.throws(() => launchArgs("grok"), /Invalid subagent model/);
});

test("named role launch arguments include model, role prompt, and control tools", () => {
  const piDefault = __test__.configuredDefaultModelRef();
  assert.equal(
    __test__.resolveModelArgument(undefined, "xai/grok-4.6", "high"),
    "xai/grok-4.6:high",
  );
  assert.throws(
    () => __test__.resolveModelArgument(undefined),
    /No active parent model/,
  );
  assert.equal(__test__.resolveModelArgument("fast"), piDefault);
  assert.equal(__test__.resolveModelArgument("xai/fast"), piDefault);
  assert.equal(__test__.resolveModelArgument("fast:high"), `${piDefault}:high`);
  assert.equal(__test__.resolveModelArgument("grok-4.6"), "xai/grok-4.6");
  assert.equal(
    __test__.resolveModelArgument(undefined, "fast", "minimal"),
    `${piDefault}:minimal`,
  );
  assert.deepEqual(__test__.buildModelLaunchArguments(undefined, "minimal"), [
    "--thinking",
    "'minimal'",
  ]);
  assert.deepEqual(
    __test__.buildModelLaunchArguments(`${piDefault}:high`, "minimal"),
    ["--model", `'${piDefault}:high'`],
  );
  assert.throws(
    () => __test__.resolveModelArgument("grok"),
    /Invalid subagent model "grok"/,
  );
  assert.throws(
    () => __test__.resolveModelArgument("zai\/glm-5.2-fast"),
    /Invalid subagent model "zai\/glm-5.2-fast"/,
  );
  assert.deepEqual(
    __test__.buildSystemPromptArguments({
      agentBodyPath: "/role",
      agentMode: "replace",
    }),
    ["--system-prompt", "'/role'"],
  );
  assert.equal(
    __test__.buildSubagentToolAllowlist("read,bash"),
    "read,bash,caller_ping,subagent_done",
  );
});

test("steer target resolution includes idle catalog entries", () => {
  const result = __test__.resolveCatalogTarget(
    [
      {
        managerSessionId: "m",
        childSessionId: "idle-id",
        name: "Idle planner",
        cwd: "/work",
      },
    ],
    "idle",
  );
  assert.equal("child" in result && result.child.childSessionId, "idle-id");
});

test("cached extension factories isolate watcher ownership across session replacement", async () => {
  const shutdownHandlers: Array<() => void> = [];
  const pi = {
    on(name: string, handler: () => void) {
      if (name === "session_shutdown") shutdownHandlers.push(handler);
    },
    registerTool() {},
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
  } as unknown as ExtensionAPI;
  const oldLifecycle = __test__.createExtensionLifecycle();
  const newLifecycle = __test__.createExtensionLifecycle();

  // Pi may invoke the same cached extension factory for a replacement session.
  subagentsExtension(pi, oldLifecycle);
  subagentsExtension(pi, newLifecycle);
  await shutdownHandlers[0]();

  assert.equal(oldLifecycle.watcherOwner.signal.aborted, true);
  assert.equal(newLifecycle.watcherOwner.signal.aborted, false);
});

test("child session label uses the parent-assigned name, not the agent type", () => {
  assert.equal(
    childSessionIdentityLabel("Display review", "q-manager"),
    "Display review",
  );
  assert.equal(childSessionIdentityLabel("  ", "q-manager"), "q-manager");
  assert.equal(childSessionIdentityLabel("", ""), "");
});

test("reload of an autoExit false child stays idle when its pane is gone", () => {
  assert.equal(activityPhaseForSessionStart("reload", false), "waiting");
  assert.equal(activityPhaseForSessionStart("reload", true), "starting");
  assert.equal(
    __test__.detachedDurableStatus({
      autoExit: false,
      paneAlive: false,
      kind: "stalled",
    }),
    "idle",
  );
  assert.equal(
    __test__.detachedDurableStatus({
      autoExit: false,
      paneAlive: true,
      kind: "stalled",
      phase: "waiting",
    }),
    "idle",
  );
  assert.equal(
    __test__.detachedDurableStatus({
      autoExit: false,
      paneAlive: true,
      kind: "stalled",
      phase: "active",
    }),
    "stalled",
  );
  assert.equal(
    __test__.detachedDurableStatus({
      autoExit: true,
      paneAlive: false,
      kind: "stalled",
    }),
    "stalled",
  );
  assert.equal(
    __test__.stalledTransitionAction({
      autoExit: false,
      paneAlive: false,
      kind: "stalled",
      phase: "active",
      transition: "stalled",
    }),
    "release",
  );
  assert.equal(
    __test__.stalledTransitionAction({
      autoExit: false,
      paneAlive: true,
      kind: "stalled",
      phase: "starting",
      transition: "stalled",
    }),
    "hold-idle",
  );
  assert.equal(
    __test__.stalledTransitionAction({
      autoExit: false,
      paneAlive: true,
      kind: "stalled",
      phase: "active",
      transition: "stalled",
    }),
    "announce",
  );

  const dir = mkdtempSync(join(tmpdir(), "pi-reload-idle-"));
  try {
    const activityFile = join(dir, "activity.json");
    const recorder = createSubagentActivityRecorder({
      runningChildId: "child",
      activityFile,
      now: () => 1_000,
    });
    recorder.sessionReloadIdle();
    const read = readSubagentActivityFile(activityFile, "child");
    assert.equal(read.ok, true);
    if (!read.ok) return;
    const state = observeStatus(
      createStatusState({ source: "pi", startTimeMs: 0 }),
      {
        snapshot: "present",
        updatedAt: read.activity.updatedAt,
        sequence: read.activity.sequence,
        phase: read.activity.phase,
        active: false,
        waitingSince: read.activity.waitingSince,
        latestEvent: read.activity.latestEvent,
      },
      120_000,
    );
    assert.equal(classifyStatus(state, 120_000).kind, "waiting");
    assert.notEqual(classifyStatus(state, 120_000).kind, "stalled");

    const stalled = createStatusState({ source: "pi", startTimeMs: 0 });
    stalled.snapshotState = "missing";
    stalled.snapshotProblemSinceMs = 0;
    stalled.firstObservationAtMs = 0;
    const lines = __test__.renderSubagentWidgetLines(
      [
        {
          managerSessionId: "manager",
          childSessionId: "child",
          name: "Manager",
          cwd: "/work",
          autoExit: false,
        },
      ],
      new Map([
        [
          "child",
          {
            id: "child",
            surface: "%gone",
            startTime: 0,
            statusState: stalled,
          } as never,
        ],
      ]),
      80,
      120_000,
      true,
      () => false,
    );
    assert.equal(
      lines.some((line) => line.includes("stalled")),
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session reload replays registrations with no active runs and no snapshot writes", () => {
  const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
  const appended: string[] = [];
  const pi = {
    on(name: string, handler: (event: unknown, ctx: unknown) => void) {
      handlers.set(name, handler);
    },
    appendEntry(type: string) {
      appended.push(type);
    },
    registerTool() {},
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
  } as unknown as ExtensionAPI;
  const lifecycle = __test__.createExtensionLifecycle();
  const active = __test__.runningSubagents;
  const starting = __test__.startingSubagents;
  const catalog = __test__.childrenBySessionId;
  active.set("stale", { id: "stale" } as Parameters<typeof active.set>[1]);
  starting.set("starting", Symbol("starting"));
  subagentsExtension(pi, lifecycle);
  handlers.get("session_start")?.(
    { reason: "reload" },
    {
      hasUI: false,
      sessionManager: {
        getHeader: () => ({ id: "manager" }),
        getSessionId: () => "manager",
        getBranch: () => [
          {
            type: "custom",
            customType: __test__.CHILD_SESSION_CUSTOM_TYPE,
            data: {
              version: 1,
              managerSessionId: "manager",
              childSessionId: "child",
              name: "Planner",
              cwd: "/work",
            },
          },
        ],
      },
    },
  );
  assert.equal(active.size, 0);
  assert.equal(starting.size, 1);
  assert.equal(catalog.get("child")?.name, "Planner");
  assert.equal(
    appended.includes("pi-attachable-subagents/resumable-snapshot"),
    false,
  );
  starting.clear();
  catalog.clear();
});

test("launch lifecycle registers before dispatch and closes only created surfaces", async () => {
  const events: string[] = [];
  const run = (failure?: "seed" | "append" | "create" | "dispatch") =>
    __test__.runLaunchLifecycle({
      seed: () => {
        events.push("seed");
        if (failure === "seed") throw new Error("seed");
      },
      appendRegistration: () => {
        events.push("append");
        if (failure === "append") throw new Error("append");
      },
      createSurface: () => {
        events.push("surface");
        if (failure === "create") throw new Error("create");
        return "%child";
      },
      dispatch: (surface) => {
        events.push(`dispatch:${surface}`);
        if (failure === "dispatch") throw new Error("dispatch");
      },
      closeSurface: (surface) => events.push(`close:${surface}`),
    });

  assert.equal(await run(), "%child");
  assert.deepEqual(events, ["seed", "append", "surface", "dispatch:%child"]);
  for (const failure of ["seed", "append", "create", "dispatch"] as const) {
    events.length = 0;
    await assert.rejects(run(failure), new RegExp(failure));
    assert.deepEqual(
      events,
      failure === "seed"
        ? ["seed"]
        : failure === "append"
          ? ["seed", "append"]
          : failure === "create"
            ? ["seed", "append", "surface"]
            : ["seed", "append", "surface", "dispatch:%child", "close:%child"],
    );
  }
});

test("L1 successful dispatch registers one unresolved delivery before tool return", async () => {
  const coordinator = __test__.createDelegatorLivenessCoordinator();
  const lifecycle = __test__.createExtensionLifecycle();
  type Running = Parameters<typeof __test__.registerLaunchedDelivery>[0];
  const events: string[] = [];
  await __test__.runLaunchLifecycle({
    seed: () => events.push("seed"),
    appendRegistration: () => events.push("append"),
    createSurface: () => {
      events.push("surface");
      return "%child";
    },
    dispatch: () => {
      events.push("dispatch");
    },
    closeSurface: () => events.push("close"),
  });
  const running = { id: "child", surface: "%child" } as Running;
  __test__.registerLaunchedDelivery(running, lifecycle, coordinator);
  events.push("registered");
  assert.deepEqual(events, [
    "seed",
    "append",
    "surface",
    "dispatch",
    "registered",
  ]);
  assert.equal(coordinator.hasUnresolved(), true);
  assert.equal(coordinator.phaseOf(running.deliveryId!), "running");
  assert.equal(lifecycle.ownedDeliveryIds.has(running.deliveryId!), true);
});

test("L8 launch failure creates no hold", async () => {
  const coordinator = __test__.createDelegatorLivenessCoordinator();
  const lifecycle = __test__.createExtensionLifecycle();
  await assert.rejects(
    __test__.runLaunchLifecycle({
      seed: () => {},
      appendRegistration: () => {},
      createSurface: () => "%child",
      dispatch: () => {
        throw new Error("dispatch");
      },
      closeSurface: () => {},
    }),
    /dispatch/,
  );
  assert.equal(coordinator.hasUnresolved(), false);
  assert.equal(lifecycle.ownedDeliveryIds.size, 0);
});

test("watcher cleanup removes active state for every terminal outcome and retains catalog", () => {
  const catalog = new Map([
    [
      "child",
      {
        managerSessionId: "manager",
        childSessionId: "child",
        name: "Worker",
        cwd: "/work",
      },
    ],
  ]);
  for (const outcome of ["settlement", "ping", "done", "error"] as const) {
    type Running = Parameters<typeof __test__.removeActiveRun>[1];
    const active = new Map<string, Running>();
    const running = { id: "child", surface: `%${outcome}` } as Running;
    active.set("child", running);
    const closed: string[] = [];
    let wakes = 0;
    __test__.removeActiveRun(active, running, (surface) =>
      closed.push(surface),
    );
    __test__.completeWakeTransition({
      update() {},
      wake() {
        wakes += 1;
      },
    });
    assert.equal(active.size, 0, outcome);
    assert.deepEqual(closed, [`%${outcome}`], outcome);
    assert.equal(wakes, 1, outcome);
    assert.equal(catalog.has("child"), true, outcome);
  }
});

test("L4 out-of-order completions queue once in completion order", () => {
  const coordinator = __test__.createDelegatorLivenessCoordinator();
  coordinator.registerRunning("a");
  coordinator.registerRunning("b");
  coordinator.registerRunning("c");
  const wakes: string[] = [];
  coordinator.markPendingDelivery("b");
  assert.equal(
    __test__.completeWakeTransition(
      {
        deliveryId: "b",
        update() {},
        wake() {
          wakes.push("b");
        },
      },
      coordinator,
    ),
    true,
  );
  coordinator.markPendingDelivery("a");
  assert.equal(
    __test__.completeWakeTransition(
      {
        deliveryId: "a",
        update() {},
        wake() {
          wakes.push("a");
        },
      },
      coordinator,
    ),
    true,
  );
  assert.deepEqual(wakes, ["b", "a"]);
  assert.equal(
    __test__.completeWakeTransition(
      {
        deliveryId: "b",
        update() {},
        wake() {
          wakes.push("b-dup");
        },
      },
      coordinator,
    ),
    false,
  );
  assert.deepEqual(wakes, ["b", "a"]);
  assert.equal(coordinator.phaseOf("b"), "delivered-pending-consumption");
  assert.equal(coordinator.phaseOf("a"), "delivered-pending-consumption");
  assert.equal(coordinator.phaseOf("c"), "running");
});

test("L7 each result ping and error wakes the parent once", () => {
  const coordinator = __test__.createDelegatorLivenessCoordinator();
  const wakes: string[] = [];
  for (const id of ["result", "ping", "error"]) {
    coordinator.registerRunning(id);
    coordinator.markPendingDelivery(id);
    assert.equal(
      __test__.completeWakeTransition(
        {
          deliveryId: id,
          update() {},
          wake() {
            wakes.push(id);
          },
        },
        coordinator,
      ),
      true,
    );
    assert.equal(
      __test__.completeWakeTransition(
        {
          deliveryId: id,
          update() {},
          wake() {
            wakes.push(`${id}-dup`);
          },
        },
        coordinator,
      ),
      false,
    );
  }
  assert.deepEqual(wakes, ["result", "ping", "error"]);
});

test("close failures retain active ownership until a later reap succeeds", () => {
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const active = new Map<string, Running>();
  const running = { id: "child", surface: "%child" } as Running;
  active.set("child", running);
  assert.throws(
    () =>
      __test__.removeActiveRun(active, running, () => {
        throw new Error("close failed");
      }),
    /close failed/,
  );
  assert.equal(active.get("child"), running);
  __test__.removeActiveRun(active, running, () => {});
  assert.equal(active.has("child"), false);
});

test("stale watcher and old lifecycle cleanup preserve replacement active run", () => {
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const active = new Map<string, Running>();
  const oldController = new AbortController();
  const oldRun = {
    id: "child",
    surface: "%old",
    abortController: oldController,
  } as Running;
  const newRun = { id: "child", surface: "%new" } as Running;
  active.set("child", newRun);
  const closed: string[] = [];

  __test__.removeActiveRun(active, oldRun, (surface) => closed.push(surface));
  assert.equal(active.get("child"), newRun);
  assert.deepEqual(closed, ["%old"]);

  const lifecycle = __test__.createExtensionLifecycle();
  lifecycle.ownedRuns.add(oldRun);
  __test__.shutdownLifecycle(lifecycle, active, (surface) =>
    closed.push(surface),
  );
  assert.equal(oldController.signal.aborted, true);
  assert.equal(active.get("child"), newRun);
  assert.deepEqual(closed, ["%old", "%old"]);
});

test("manager teardown cancels owned runs without deleting durable registrations", () => {
  type Running =
    Parameters<typeof __test__.shutdownLifecycle>[1] extends Map<
      string,
      infer Value
    >
      ? Value
      : never;
  const lifecycle = __test__.createExtensionLifecycle();
  const active = new Map<string, Running>();
  const controller = new AbortController();
  const running = {
    id: "child",
    surface: "%shutdown",
    abortController: controller,
  } as Running;
  active.set("child", running);
  lifecycle.ownedRuns.add(running);
  const catalog = new Map([["child", { name: "Worker" }]]);
  const closed: string[] = [];

  __test__.shutdownLifecycle(lifecycle, active, (surface) =>
    closed.push(surface),
  );

  assert.equal(lifecycle.watcherOwner.signal.aborted, true);
  assert.equal(controller.signal.aborted, true);
  assert.equal(running.shutdownCancelled, true);
  assert.equal(active.size, 0);
  assert.deepEqual(closed, ["%shutdown"]);
  assert.equal(catalog.has("child"), true);
});

test("explicit stop removes only active runtime state and suppresses watcher delivery", () => {
  type Running = Parameters<typeof __test__.stopActiveRun>[1];
  const active = new Map<string, Running>();
  const controller = new AbortController();
  const running = {
    id: "child",
    surface: "%stop",
    abortController: controller,
  } as Running;
  active.set("child", running);
  const closed: string[] = [];
  __test__.stopActiveRun(active, running, (surface) => closed.push(surface));
  assert.equal(controller.signal.aborted, true);
  assert.equal(running.explicitlyStopped, true);
  assert.equal(__test__.shouldDeliverWatcherNotification(running), false);
  assert.equal(active.size, 0);
  assert.deepEqual(closed, ["%stop"]);
});

test("stopping one selected specialist retains its manager and sibling ownership", () => {
  type Running = Parameters<typeof __test__.stopActiveRun>[1];
  const active = new Map<string, Running>();
  const manager = { id: "manager", surface: "%manager" } as Running;
  const specialist = {
    id: "specialist",
    surface: "%specialist",
    abortController: new AbortController(),
  } as Running;
  active.set(manager.id, manager);
  active.set(specialist.id, specialist);
  const closed: string[] = [];
  __test__.stopActiveRun(active, specialist, (surface) => closed.push(surface));
  assert.equal(active.get("manager"), manager);
  assert.equal(active.has("specialist"), false);
  assert.equal(specialist.abortController?.signal.aborted, true);
  assert.deepEqual(closed, ["%specialist"]);
});

test("L8 explicit child stop clears only its hold", () => {
  const coordinator = __test__.createDelegatorLivenessCoordinator();
  const lifecycle = __test__.createExtensionLifecycle();
  type Running = Parameters<typeof __test__.stopActiveRun>[1];
  const kept = { id: "kept", surface: "%kept", deliveryId: "kept" } as Running;
  const stopped = {
    id: "stopped",
    surface: "%stopped",
    deliveryId: "stopped",
    abortController: new AbortController(),
  } as Running;
  __test__.registerLaunchedDelivery(kept, lifecycle, coordinator);
  __test__.registerLaunchedDelivery(stopped, lifecycle, coordinator);
  const active = new Map<string, Running>([
    [kept.id, kept],
    [stopped.id, stopped],
  ]);
  __test__.stopActiveRun(active, stopped, () => {}, coordinator);
  assert.equal(coordinator.phaseOf("stopped"), "cancelled");
  assert.equal(coordinator.phaseOf("kept"), "running");
  assert.equal(coordinator.hasUnresolved(), true);
  assert.equal(
    __test__.completeWakeTransition(
      {
        deliveryId: "stopped",
        update() {},
        wake() {
          throw new Error("late wake");
        },
      },
      coordinator,
    ),
    false,
  );
  assert.equal(active.get("kept"), kept);
});

test("L11 shutdown and replacement cancel late delivery", () => {
  const coordinator = __test__.createDelegatorLivenessCoordinator();
  const oldLifecycle = __test__.createExtensionLifecycle();
  const newLifecycle = __test__.createExtensionLifecycle();
  type Running = Parameters<typeof __test__.stopActiveRun>[1];
  const oldRun = {
    id: "old",
    surface: "%old",
    deliveryId: "old",
    abortController: new AbortController(),
  } as Running;
  const pending = {
    id: "pending",
    surface: "%pending",
    deliveryId: "pending",
  } as Running;
  const replacement = {
    id: "new",
    surface: "%new",
    deliveryId: "new",
  } as Running;
  __test__.registerLaunchedDelivery(oldRun, oldLifecycle, coordinator);
  __test__.registerLaunchedDelivery(pending, oldLifecycle, coordinator);
  coordinator.markPendingDelivery("pending");
  oldLifecycle.ownedRuns.add(oldRun);
  const active = new Map<string, Running>([["old", oldRun]]);
  __test__.registerLaunchedDelivery(replacement, newLifecycle, coordinator);
  active.set("new", replacement);
  __test__.shutdownLifecycle(
    oldLifecycle,
    active,
    () => {},
    new Map(),
    coordinator,
  );
  assert.equal(coordinator.phaseOf("old"), "cancelled");
  assert.equal(coordinator.phaseOf("pending"), "cancelled");
  assert.equal(coordinator.phaseOf("new"), "running");
  assert.equal(
    __test__.completeWakeTransition(
      {
        deliveryId: "pending",
        update() {},
        wake() {
          throw new Error("late callback");
        },
      },
      coordinator,
    ),
    false,
  );
  assert.equal(coordinator.hasUnresolved(), true);
  assert.equal(active.get("new"), replacement);
});

test("child launch environment propagates the Fast Mode preference", () => {
  assert.deepEqual(
    __test__.buildChildHandoffEnvironment({ PI_FAST_DESIRED: "1" }),
    ["PI_FAST_DESIRED='1'"],
  );
  assert.deepEqual(
    __test__.buildChildHandoffEnvironment({ PI_FAST_DESIRED: "0" }),
    ["PI_FAST_DESIRED='0'"],
  );
  assert.deepEqual(
    __test__.buildChildHandoffEnvironment({ PI_FAST_DESIRED: "invalid" }),
    [],
  );
});

test("initial launch profile carries role model, prompts, controls, files, skills, and deny policy", () => {
  const prompt = __test__.buildPiPromptArgs({
    files: ["/first.md"],
    taskArg: "@task.md",
  });
  const command = __test__.buildPiLaunchCommand(
    {
      sessionFile: "/session",
      activityFile: "/activity",
      cwdPrefix: "cd /work && ",
      environment: [
        "PI_DENY_TOOLS='subagent'",
        __test__.buildChildAutoExitEnvironment(false),
      ],
      arguments: [
        "pi",
        "--model",
        "'openai/gpt:high'",
        "--system-prompt",
        "'/role.md'",
        "--tools",
        "'read,caller_ping,subagent_done'",
      ],
      selectedSkills: ["q-outline"],
    },
    { surface: "%1", promptArguments: prompt, originalLaunch: true },
  );
  assert.match(command, /'@\/first\.md' '@task\.md'/);
  assert.match(command, /PI_SUBAGENT_SKILLS='q-outline'/);
  assert.match(command, /PI_DENY_TOOLS='subagent'/);
  assert.match(command, /PI_SUBAGENT_AUTO_EXIT='false'/);
  assert.match(command, /--system-prompt '\/role.md'/);
  assert.match(command, /--tools 'read,caller_ping,subagent_done'/);
  assert.match(command, /--model 'openai\/gpt:high'/);
});

test("launch failure reports the completed registration stage accurately", () => {
  assert.match(
    __test__.formatLaunchFailure("seed", false, new Error("disk full")).message,
    /seed failed; child was not registered and cannot be steered: disk full/,
  );
  assert.match(
    __test__.formatLaunchFailure("registration", false, "append failed")
      .message,
    /registration failed; child was not registered and cannot be steered: append failed/,
  );
  for (const stage of ["surface", "dispatch"] as const)
    assert.match(
      __test__.formatLaunchFailure(stage, true, new Error(stage)).message,
      new RegExp(
        `${stage} failed; child is registered but idle/not running: ${stage}`,
      ),
    );
});

test("idle launch profile reconstructs named role and active decision prevents duplicate process", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-idle-profile-"));
  try {
    const child = {
      managerSessionId: "manager",
      childSessionId: "01a0212e-0be4-7eee-8ae8-a489cee0e294",
      name: "Worker",
      agent: "worker",
      cwd: "/work",
      autoExit: false,
    };
    const profile = __test__.buildIdleLaunchProfile({
      child,
      sessionFile: "/sessions/child.jsonl",
      activityFile: "/activity/child.json",
      agentDir: dir,
      agentDefs: {
        model: "xai/grok-4.6",
        thinking: "high",
        tools: "read,bash",
        denyTools: "write",
        spawning: false,
        systemPromptMode: "replace",
        body: "role instructions",
      },
      promptDir: dir,
    });
    assert.doesNotMatch(profile.arguments.join(" "), /--model/);
    assert.match(profile.arguments.join(" "), /--system-prompt/);
    assert.match(
      profile.arguments.join(" "),
      /read,bash,caller_ping,subagent_done/,
    );
    assert.match(
      profile.environment.join(" "),
      new RegExp(`PI_CODING_AGENT_DIR='${dir}'`),
    );
    assert.match(
      profile.environment.join(" "),
      /PI_DENY_TOOLS='subagent,subagent_interrupt,subagents_list,write'/,
    );
    assert.match(
      profile.environment.join(" "),
      /PI_SUBAGENT_SESSION='\/sessions\/child.jsonl'/,
    );
    assert.match(
      profile.environment.join(" "),
      /PI_SUBAGENT_ACTIVITY_FILE='\/activity\/child.json'/,
    );
    assert.match(
      profile.environment.join(" "),
      /PI_SUBAGENT_AUTO_EXIT='false'/,
    );
    const active = new Map([
      [child.childSessionId, { id: child.childSessionId } as any],
    ]);
    assert.equal(
      __test__.resolveSteerDecision(active, new Map(), child).kind,
      "active",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unprofiled idle launches clear inherited role and deny variables", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-unprofiled-"));
  try {
    const profile = __test__.buildIdleLaunchProfile({
      child: {
        managerSessionId: "m",
        childSessionId: "child",
        name: "Manager",
        cwd: dir,
      },
      sessionFile: "/session",
      activityFile: "/activity",
      agentDir: dir,
      agentDefs: null,
      promptDir: dir,
    });
    assert.match(profile.environment.join(" "), /PI_SUBAGENT_AGENT=''/);
    assert.match(profile.environment.join(" "), /PI_DENY_TOOLS=''/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("idle steer with an exact provider/id adds only --model on the same session", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-idle-steer-model-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    writeFileSync(
      join(dir, "models-store.json"),
      JSON.stringify({
        xai: { models: [{ provider: "xai", id: "grok-4.6" }] },
      }),
    );
    const model = __test__.exactSteerModelRef("xai/grok-4.6");
    const childSessionId = "01a0212e-0be4-7eee-8ae8-a489cee0e294";
    const profile = __test__.buildIdleLaunchProfile({
      child: {
        managerSessionId: "manager",
        childSessionId,
        name: "Worker",
        agent: "worker",
        cwd: "/work",
        autoExit: false,
      },
      sessionFile: "/sessions/child.jsonl",
      activityFile: "/activity/child.json",
      agentDir: dir,
      agentDefs: {
        tools: "read",
        spawning: false,
        systemPromptMode: "append",
        body: "work",
      },
      promptDir: dir,
      model,
    });
    const args = profile.arguments.join(" ");
    assert.match(args, /--model 'xai\/grok-4\.6'/);
    assert.match(args, new RegExp(`--session '${childSessionId}'`));
    assert.doesNotMatch(args, /--fork/);
    assert.doesNotMatch(args, /--thinking/);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("steer model rejects bare ids, partial names, fast, and thinking suffixes", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-steer-model-reject-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    writeFileSync(
      join(dir, "models-store.json"),
      JSON.stringify({
        xai: {
          models: [
            { provider: "xai", id: "grok-4.6" },
            { provider: "xai", id: "fast" },
          ],
        },
      }),
    );
    for (const value of [
      "grok-4.6",
      "grok",
      "fast",
      "xai/fast",
      "xai/grok-4.6:high",
    ]) {
      assert.throws(
        () => __test__.exactSteerModelRef(value),
        /Invalid steer model/,
      );
    }
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an active steer with a model returns an error and does not send", () => {
  let sent = false;
  const blocked = __test__.deliverActiveSteer({
    model: "xai/grok-4.6",
    send() {
      sent = true;
    },
  });
  assert.equal(sent, false);
  assert.equal("error" in blocked, true);
  if ("error" in blocked) assert.match(blocked.error, /not sent/);

  const allowed = __test__.deliverActiveSteer({
    send() {
      sent = true;
    },
  });
  assert.equal(sent, true);
  assert.deepEqual(allowed, { ok: true });
});

test("idle resume omits bare agent model so the session keeps its provider", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-idle-no-model-"));
  try {
    const profile = __test__.buildIdleLaunchProfile({
      child: {
        managerSessionId: "manager",
        childSessionId: "planner-design",
        name: "planner-design",
        agent: "planner",
        cwd: "/work",
      },
      sessionFile: "/sessions/child.jsonl",
      activityFile: "/activity/child.json",
      agentDir: dir,
      agentDefs: {
        model: "grok-4.6",
        thinking: "medium",
        tools: "read",
        spawning: false,
        systemPromptMode: "append",
        body: "plan",
      },
      promptDir: dir,
    });
    const args = profile.arguments.join(" ");
    assert.doesNotMatch(args, /--model/);
    assert.doesNotMatch(args, /grok-4\.6/);
    assert.doesNotMatch(args, /amazon-bedrock/);
    assert.match(args, /--session 'planner-design'/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("idle steering reserves each child before asynchronous launch", async () => {
  type Running =
    Parameters<typeof __test__.startIdleChild>[0]["activeRuns"] extends Map<
      string,
      infer Value
    >
      ? Value
      : never;
  const child = (childSessionId: string) => ({
    managerSessionId: "manager",
    childSessionId,
    name: childSessionId,
    cwd: "/work",
  });
  const active = new Map<string, Running>();
  const starting = new Map<string, symbol>();
  const lifecycle = __test__.createExtensionLifecycle();
  let surfaces = 0;
  let dispatches = 0;
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const start = async (id: string) => {
    surfaces += 1;
    await delayed;
    dispatches += 1;
    return { id, surface: `%${id}` } as Running;
  };

  const first = __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    lifecycle,
    child: child("one"),
    start: () => start("one"),
  });
  const second = await __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    lifecycle,
    child: child("one"),
    start: () => start("duplicate"),
  });
  assert.equal(second.kind, "starting");
  assert.equal(surfaces, 1);
  assert.equal(dispatches, 0);

  const other = __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    lifecycle,
    child: child("two"),
    start: () => start("two"),
  });
  assert.equal(surfaces, 2);
  release();
  const [firstResult, otherResult] = await Promise.all([first, other]);
  assert.equal(firstResult.kind, "active");
  assert.equal(otherResult.kind, "active");
  assert.equal(dispatches, 2);
  assert.equal(active.size, 2);

  let attempts = 0;
  await assert.rejects(
    __test__.startIdleChild({
      activeRuns: active,
      startingRuns: starting,
      lifecycle,
      child: child("retry"),
      async start() {
        attempts += 1;
        throw new Error("dispatch failed");
      },
    }),
    /dispatch failed/,
  );
  assert.equal(starting.has("retry"), false);
  const retry = await __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    lifecycle,
    child: child("retry"),
    async start() {
      attempts += 1;
      return { id: "retry", surface: "%retry" } as Running;
    },
  });
  assert.equal(retry.kind, "active");
  assert.equal(attempts, 2);
});

test("lifecycle reservation cleanup preserves other owners and cancels its own delayed start", async () => {
  type Running =
    Parameters<typeof __test__.startIdleChild>[0]["activeRuns"] extends Map<
      string,
      infer Value
    >
      ? Value
      : never;
  const child = {
    managerSessionId: "manager",
    childSessionId: "child",
    name: "Worker",
    cwd: "/work",
  };
  const active = new Map<string, Running>();
  const starting = new Map<string, symbol>();
  const oldLifecycle = __test__.createExtensionLifecycle();
  const newLifecycle = __test__.createExtensionLifecycle();
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const newStart = __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    lifecycle: newLifecycle,
    child,
    async start() {
      await delayed;
      return { id: child.childSessionId, surface: "%new" } as Running;
    },
  });
  __test__.shutdownLifecycle(oldLifecycle, active, undefined, starting);
  release();
  const newResult = await newStart;
  assert.equal(newResult.kind, "active");
  assert.equal(active.get(child.childSessionId), newResult.running);

  let cancelRelease!: () => void;
  const cancelDelay = new Promise<void>((resolve) => {
    cancelRelease = resolve;
  });
  const closed: string[] = [];
  const cancelledStart = __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    lifecycle: newLifecycle,
    child: { ...child, childSessionId: "cancelled" },
    async start() {
      await cancelDelay;
      return { id: "cancelled", surface: "%cancelled" } as Running;
    },
    close: (surface) => closed.push(surface),
  });
  __test__.shutdownLifecycle(newLifecycle, active, undefined, starting);
  cancelRelease();
  assert.deepEqual(await cancelledStart, { kind: "cancelled" });
  assert.deepEqual(closed, ["%cancelled"]);
  assert.equal(active.has("cancelled"), false);
});

test("stale reservation cleanup cannot remove a replacement token", () => {
  const lifecycle = __test__.createExtensionLifecycle();
  const active = new Map();
  const starting = new Map<string, symbol>();
  const original = Symbol("original");
  const replacement = Symbol("replacement");
  lifecycle.ownedStartReservations.set("child", original);
  starting.set("child", replacement);
  __test__.shutdownLifecycle(lifecycle, active, undefined, starting);
  assert.equal(starting.get("child"), replacement);
});

test("widget, list, and picker sort durable children newest-first", async () => {
  const children = [
    {
      managerSessionId: "m",
      childSessionId: "old",
      name: "Old",
      cwd: "/",
      startedAt: new Date(2026, 7, 23, 11, 28).getTime(),
    },
    {
      managerSessionId: "m",
      childSessionId: "new",
      name: "New",
      cwd: "/",
      startedAt: new Date(2026, 7, 25, 9, 56).getTime(),
    },
    {
      managerSessionId: "m",
      childSessionId: "middle",
      name: "Middle",
      cwd: "/",
      startedAt: new Date(2026, 7, 24, 11, 28).getTime(),
    },
  ];
  assert.deepEqual(
    __test__.sortChildCatalog(children).map((child) => child.name),
    ["New", "Middle", "Old"],
  );
  const lines = __test__.renderSubagentWidgetLines(
    children,
    new Map(),
    100,
    new Date(2026, 7, 26, 10, 18).getTime(),
    true,
  );
  assert.match(lines[0], /3 tracked · 0 active/);
  assert.ok(
    lines.findIndex((line) => line.includes("New")) <
      lines.findIndex((line) => line.includes("Middle")),
  );
  assert.ok(
    lines.findIndex((line) => line.includes("Middle")) <
      lines.findIndex((line) => line.includes("Old")),
  );
  assert.match(
    lines.find((line) => line.includes("Old"))!,
    /🔴.*Aug 23 11:28/,
  );
  assert.match(
    lines.find((line) => line.includes("New"))!,
    /Aug 25 09:56/,
  );
  assert.match(
    lines.find((line) => line.includes("Middle"))!,
    /Aug 24 11:28/,
  );

  let pickerOptions: string[] = [];
  const selected = await __test__.selectHumanCatalogTarget(
    children,
    async (_title, options) => {
      pickerOptions = options;
      return options[0];
    },
  );
  assert.deepEqual(
    pickerOptions.map((option) => option.split(" · ")[0]),
    ["New", "Middle", "Old"],
  );
  assert.equal(selected?.name, "New");

  const activeOptions: string[] = [];
  await __test__.selectHumanTarget(
    [
      { id: "old", name: "Old", startTime: 0 },
      { id: "new", name: "New", startTime: 0 },
      { id: "middle", name: "Middle", startTime: 0 },
    ] as any,
    undefined,
    async (_title, options) => {
      activeOptions.push(...options);
      return undefined;
    },
    new Map(children.map((child) => [child.childSessionId, child])),
  );
  assert.deepEqual(
    activeOptions.map((option) => option.split(" · ")[0]),
    ["New", "Middle", "Old"],
  );
});

test("widget orders active display status, time, runtime, model, and TPS", () => {
  const now = new Date(2026, 7, 25, 10, 18).getTime();
  const child = {
    managerSessionId: "m",
    childSessionId: "child",
    name: "Manager",
    cwd: "/",
    startedAt: now,
  };
  const active = new Map([
    [
      "child",
      {
        id: "child",
        name: "Manager",
        startTime: now - 42_000,
        displayModel: "actual-model",
        displayTps: 25.5,
        statusState: createStatusState({ source: "pi", startTimeMs: now }),
      },
    ],
  ] as any) as any;
  const line = __test__.renderSubagentWidgetLines(
    [child],
    active,
    140,
    now,
    true,
  )[1];
  assert.match(line, /🟡 10:18 00:42 actual-model 25.5 tok\/s/);
});

test("widget context utilization sits to the right of tok/s and uses 200k/300k colors", () => {
  const now = new Date(2026, 7, 25, 10, 18).getTime();
  const lineFor = (tokens: number | undefined) =>
    __test__.renderSubagentWidgetLines(
      [
        {
          managerSessionId: "m",
          childSessionId: "child",
          name: "Manager",
          cwd: "/",
          startedAt: now,
        },
      ],
      new Map([
        [
          "child",
          {
            id: "child",
            name: "Manager",
            startTime: now,
            displayModel: "actual-model",
            displayTps: 25.5,
            displayContextTokens: tokens,
            statusState: createStatusState({ source: "pi", startTimeMs: now }),
          },
        ],
      ] as any) as any,
      160,
      now,
      true,
    )[1];

  assert.match(lineFor(200_000), /25\.5 tok\/s 200\.0k /);
  assert.doesNotMatch(lineFor(200_000), /1\.0M|%|■|\x1b\[33m|\x1b\[31m/);
  assert.match(lineFor(200_001), /tok\/s \x1b\[33m200\.0k\x1b\[0m/);
  assert.match(lineFor(300_001), /tok\/s \x1b\[31m300\.0k\x1b\[0m/);
  assert.equal(__test__.formatSubagentContextUtilization(undefined), "—");
});

test("widget uses local calendar dates and no status-time separator", () => {
  const now = new Date(2026, 11, 31, 10, 18).getTime();
  assert.equal(
    __test__.formatLocalCatalogStartTime(
      new Date(2026, 11, 31, 9, 56).getTime(),
      now,
    ),
    "09:56",
  );
  assert.equal(
    __test__.formatLocalCatalogStartTime(
      new Date(2026, 11, 30, 12, 53).getTime(),
      now,
    ),
    "Dec 30 12:53",
  );
  assert.equal(
    __test__.formatLocalCatalogStartTime(
      new Date(2026, 0, 1, 12, 53).getTime(),
      now,
    ),
    "Jan 1 12:53",
  );
  const lines = __test__.renderSubagentWidgetLines(
    [
      {
        managerSessionId: "m",
        childSessionId: "idle",
        name: "Idle",
        cwd: "/",
        startedAt: new Date(2026, 11, 30, 12, 53).getTime(),
      },
    ],
    new Map(),
    100,
    now,
    true,
  );
  assert.match(
    lines.find((line) => line.includes("Idle"))!,
    /🔴 Dec 30 12:53/,
  );
  assert.doesNotMatch(
    lines.find((line) => line.includes("Idle"))!,
    /·/,
  );
});

test("widget hides stopped children and collapses to a stopped count", () => {
  const now = new Date(2026, 7, 25, 10, 18).getTime();
  const children = [
    {
      managerSessionId: "m",
      childSessionId: "older",
      name: "Older stopped",
      cwd: "/",
      startedAt: now - 60_000,
    },
    {
      managerSessionId: "m",
      childSessionId: "newer",
      name: "Newer stopped",
      cwd: "/",
      startedAt: now,
    },
  ];

  const collapsed = __test__.renderSubagentWidgetLines(
    children,
    new Map(),
    100,
    now,
  );
  assert.equal(collapsed.length, 2);
  assert.match(collapsed[0], /2 stopped · Ctrl\+Alt\+S show/);
  assert.equal(
    collapsed.some((line) => line.includes("stopped")),
    true,
  );
  assert.equal(
    collapsed.some((line) => line.includes("Older stopped")),
    false,
  );
  assert.equal(
    collapsed.some((line) => line.includes("Newer stopped")),
    false,
  );

  const expanded = __test__.renderSubagentWidgetLines(
    children,
    new Map(),
    100,
    now,
    true,
  );
  assert.match(expanded[0], /2 tracked · 0 active · Ctrl\+Alt\+S hide stopped/);
  assert.ok(
    expanded.findIndex((line) => line.includes("Newer stopped")) <
      expanded.findIndex((line) => line.includes("Older stopped")),
  );
});

test("subagent widget registers a distinct stopped-children shortcut", () => {
  const shortcuts: Array<{ key: string; description?: string }> = [];
  const pi = {
    on() {},
    registerTool() {},
    registerCommand() {},
    registerShortcut(key: string, options: { description?: string }) {
      shortcuts.push({ key, description: options.description });
    },
    registerMessageRenderer() {},
  } as unknown as ExtensionAPI;

  subagentsExtension(pi);

  assert.deepEqual(shortcuts, [
    {
      key: "ctrl+alt+s",
      description: "Show or hide stopped subagents",
    },
  ]);
});

test("widget marks idle, provider, and streaming children", () => {
  const now = new Date(2026, 7, 25, 10, 18).getTime();
  const activeState = (scope: "provider" | "streaming") =>
    observeStatus(
      createStatusState({ source: "pi", startTimeMs: now }),
      {
        snapshot: "present",
        updatedAt: now,
        sequence: 1,
        phase: "active",
        active: true,
        activeScope: scope,
      },
      now,
    );
  const children = [
    {
      managerSessionId: "m",
      childSessionId: "idle",
      name: "Idle",
      cwd: "/",
      startedAt: now,
    },
    {
      managerSessionId: "m",
      childSessionId: "provider",
      name: "Provider",
      cwd: "/",
      startedAt: now,
    },
    {
      managerSessionId: "m",
      childSessionId: "streaming",
      name: "Streaming",
      cwd: "/",
      startedAt: now,
    },
  ];
  const active = new Map([
    [
      "provider",
      {
        id: "provider",
        name: "Provider",
        startTime: now,
        statusState: activeState("provider"),
      },
    ],
    [
      "streaming",
      {
        id: "streaming",
        name: "Streaming",
        startTime: now,
        statusState: activeState("streaming"),
      },
    ],
  ] as any) as any;
  const lines = __test__.renderSubagentWidgetLines(children, active, 100, now);
  assert.match(lines[0], /2 active · 1 stopped · Ctrl\+Alt\+S show/);
  assert.equal(
    lines.some((line) => line.includes("Idle")),
    false,
  );
  assert.match(
    lines.find((line) => line.includes("Provider"))!,
    /🟡 10:18/,
  );
  assert.match(
    lines.find((line) => line.includes("Streaming"))!,
    /🟢 10:18/,
  );
  assert.doesNotMatch(
    lines.find((line) => line.includes("Provider"))!,
    /provider/,
  );
  assert.doesNotMatch(
    lines.find((line) => line.includes("Streaming"))!,
    /streaming/,
  );
  assert.doesNotMatch(
    lines.find((line) => line.includes("Provider"))!,
    /·/,
  );
  assert.doesNotMatch(
    lines.find((line) => line.includes("Streaming"))!,
    /·/,
  );
});

test("resumed active child retains its durable catalog timestamp", () => {
  const originalStart = new Date(2026, 7, 23, 11, 28).getTime();
  const resumedAt = new Date(2026, 7, 27, 9, 56).getTime();
  const newestStart = new Date(2026, 7, 25, 10, 18).getTime();
  const children = [
    {
      managerSessionId: "m",
      childSessionId: "old",
      name: "Old resumed",
      cwd: "/",
      startedAt: originalStart,
    },
    {
      managerSessionId: "m",
      childSessionId: "new",
      name: "New idle",
      cwd: "/",
      startedAt: newestStart,
    },
  ];
  const active = new Map([
    [
      "old",
      {
        id: "old",
        name: "Old resumed",
        startTime: resumedAt,
        statusState: createStatusState({
          source: "pi",
          startTimeMs: resumedAt,
        }),
      },
    ],
  ] as any) as any;
  const lines = __test__.renderSubagentWidgetLines(
    children,
    active,
    100,
    resumedAt,
    true,
  );
  const newIndex = lines.findIndex((line) => line.includes("New idle"));
  const oldIndex = lines.findIndex((line) => line.includes("Old resumed"));
  assert.ok(newIndex < oldIndex);
  assert.match(lines[newIndex], /Aug 25 10:18/);
  assert.match(lines[oldIndex], /Aug 23 11:28/);
  assert.doesNotMatch(lines[oldIndex], /Aug 27 09:56/);
});

test("any subagent over 200k tokens warns on every steer and every done, not on status", () => {
  assert.equal(__test__.subagentContextHandoffWarning(200_000), undefined);
  assert.equal(__test__.subagentContextHandoffWarning(undefined), undefined);
  assert.equal(
    __test__.subagentContextHandoffWarning(200_001),
    __test__.SUBAGENT_CONTEXT_HANDOFF_WARNING,
  );
  assert.match(
    __test__.SUBAGENT_CONTEXT_HANDOFF_WARNING,
    /^Subagent context is over 200k tokens\. Consider doing a q-handoff soon and starting a new subagent with the handoff\. Or do unrelated work that does not need this agent's context in a fresh subagent\.$/,
  );

  const dir = mkdtempSync(join(tmpdir(), "pi-subagent-context-warn-"));
  const over = join(dir, "over.jsonl");
  const atLimit = join(dir, "at.jsonl");
  const assistant = (totalTokens: number) => ({
    type: "message",
    id: "msg",
    parentId: "root",
    message: {
      role: "assistant",
      stopReason: "stop",
      content: [{ type: "text", text: "done" }],
      usage: { totalTokens },
    },
  });
  const write = (file: string, totalTokens: number) => {
    writeFileSync(
      file,
      [{ type: "session", id: "root" }, assistant(totalTokens)]
        .map((line) => JSON.stringify(line))
        .join("\n") + "\n",
    );
  };
  try {
    write(over, 200_001);
    write(atLimit, 200_000);
    const warning = __test__.SUBAGENT_CONTEXT_HANDOFF_WARNING;
    assert.equal(__test__.subagentContextWarningForSession(over), warning);
    assert.equal(__test__.subagentContextWarningForSession(over), warning);
    assert.equal(__test__.subagentContextWarningForSession(atLimit), undefined);
    for (const reason of ["done", "settlement"] as const) {
      const first = __test__.appendDoneContextWarning("result", over, reason);
      const second = __test__.appendDoneContextWarning("result", over, reason);
      assert.equal(first, `result\n\n${warning}`);
      assert.equal(second, first);
    }
    assert.equal(
      __test__.appendDoneContextWarning("result", atLimit, "done"),
      "result",
    );
    assert.equal(
      __test__.appendDoneContextWarning("status", over, "status"),
      "status",
    );
    const doneMessage = __test__.doneParentModelMessage({
      presentation: "Sub-agent settled.",
      sessionFile: over,
      reason: "settlement",
    });
    assert.match(doneMessage.content, /Subagent context is over 200k tokens/);
    assert.equal(JSON.stringify(doneMessage.details).includes("200k"), false);
    const secondDone = __test__.doneParentModelMessage({
      presentation: "Sub-agent finished via subagent_done.",
      sessionFile: over,
      reason: "done",
    });
    assert.match(secondDone.content, /fresh subagent/);
    const steerText = __test__.steerParentModelText("scout", warning);
    const steerAgain = __test__.steerParentModelText("scout", warning);
    assert.match(steerText, /Steered subagent "scout"/);
    assert.match(steerText, /fresh subagent/);
    assert.equal(steerAgain, steerText);
    const modelMessage = __test__.steerContextModelMessage(warning);
    assert.equal(modelMessage?.content, warning);
    assert.equal(__test__.steerContextModelMessage(undefined), undefined);
    assert.equal(__test__.statusRefreshDelivery([], 4), undefined);
    const status = __test__.statusRefreshDelivery(
      ["scout running 1s, active."],
      4,
    );
    assert.ok(status);
    assert.equal(status.content.includes(warning), false);
    assert.equal("contextWarnings" in status, false);
    assert.equal(
      __test__.appendDoneContextWarning("ping", over, "ping"),
      "ping",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("subagent status lines omit a bash tool result tail", () => {
  const sentence =
    "The same worker is adding the fresh-subagent suggestion to the warning. I'll wait for the new text.";
  const glued = `${sentence} 🟢 true    (no output)    Took 0.5s`;
  const lines = __test__.subagentStatusLines({
    content: `Sub-agent "mgr-pi-steer-spam" status:\n\n${glued}`,
    details: { kind: "status", report: glued, lines: [glued] },
  });
  const rendered = lines.join("\n");
  assert.equal(rendered, sentence);
  assert.doesNotMatch(rendered, /\(no output\)/);
  assert.doesNotMatch(rendered, /Took/);
  assert.equal(
    __test__.stripBashResultFromStatus(
      `${sentence}\n🟢 true    (no output)    Took 0.5s`,
    ),
    sentence,
  );

  const collapsed = __test__.formatSubagentStatusDisplay(lines, {
    expanded: false,
    width: 72,
  });
  const border = __test__.paintManualSteerBorder(collapsed.border);
  const visible = [border, ...collapsed.lines, border];
  const visibleText = visible.join("\n");
  assert.ok(collapsed.lines.length > 1);
  assert.equal(collapsed.lines[0].startsWith("💬 "), true);
  assert.equal(collapsed.lines[0].includes("🟡"), false);
  assert.equal(
    collapsed.lines.join(" ").replace(/\s+/g, " "),
    `💬 ${sentence}`,
  );
  assert.equal(visibleText.includes("…"), false);
  assert.equal(visibleText.includes("•"), false);
  assert.equal(visibleText.includes("Subagent status"), false);
  assert.equal(visibleText.includes("[subagent_status]"), false);
  assert.equal(visibleText.includes("(no output)"), false);
  assert.equal(visibleText.includes("Took"), false);
  assert.equal(visibleText.toLowerCase().includes("ctrl+o"), false);
  assert.equal(border, TOOL_DISPLAY.border(collapsed.border));
  assert.equal(border.includes("\x1b[90m"), true);
  assert.equal(border.includes("\x1b[34"), false);
  assert.equal(visibleText.includes("customMessageBg"), false);
  assert.equal(__test__.MESSAGE_GLYPH.status, "💬");
  assert.equal(__test__.MESSAGE_GLYPH.done, "✅");
  assert.equal(__test__.MESSAGE_GLYPH.ping, "❓");
});

test("subagent steer renderer displays collapsed and expanded prompts", () => {
  let steerTool: any;
  const pi = {
    on() {},
    registerTool(tool: any) {
      if (tool.name === "subagent_steer") steerTool = tool;
    },
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
  } as unknown as ExtensionAPI;
  subagentsExtension(pi);
  const theme = {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  };
  const message = "First line\nSecond line with the full steer prompt.";
  const collapsedLines = steerTool
    .renderCall({ target: "child-123", message }, theme, { expanded: false })
    .render(120);
  const collapsed = collapsedLines.join("\n");
  assert.equal(collapsedLines.length, 3);
  assert.equal(collapsedLines[0], TOOL_DISPLAY.border("─".repeat(120)));
  assert.equal(collapsedLines[2], collapsedLines[0]);
  assert.match(collapsedLines[1], /^↪️ child-123 — steer First line/);
  assert.doesNotMatch(collapsed, /Second line/);
  assert.doesNotMatch(collapsed, /lines\)/);
  assert.doesNotMatch(collapsed, /Ctrl\+O to expand/);
  assert.equal(collapsedLines[0].includes("\x1b[90m"), true);
  assert.equal(collapsedLines[0].includes("\x1b[34"), false);

  const expanded = steerTool
    .renderCall({ target: "child-123", message }, theme, { expanded: true })
    .render(120)
    .join("\n");
  assert.match(expanded, /Second line with the full steer prompt/);
  assert.doesNotMatch(expanded, /Ctrl\+O to expand/);

  const shared = { state: {} };
  const call = steerTool.renderCall({ target: "child-123", message }, theme, {
    expanded: false,
    ...shared,
  });
  const result = steerTool.renderResult(
    { details: { target: "child-123", name: "Worker", status: "steered" } },
    {},
    theme,
    shared,
  );
  const combined = [...call.render(80), ...result.render(80)];
  const rule = TOOL_DISPLAY.border("─".repeat(80));
  assert.deepEqual(combined, [
    rule,
    "↪️ child-123 — steer First line",
    "↪️ Worker — steered",
    rule,
  ]);
  assert.equal(combined.filter((line) => line === rule).length, 2);
  assert.equal(combined.join("\n").includes("\x1b[34"), false);
});

test("spawn call and started result share one border pair", () => {
  const previousDeny = process.env.PI_DENY_TOOLS;
  delete process.env.PI_DENY_TOOLS;
  try {
    let spawnTool: any;
    let interruptTool: any;
    const pi = {
      on() {},
      registerTool(tool: any) {
        if (tool.name === "subagent") spawnTool = tool;
        if (tool.name === "subagent_interrupt") interruptTool = tool;
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
    } as unknown as ExtensionAPI;
    subagentsExtension(pi);
    const theme = {
      fg: (_color: string, text: string) => text,
      bold: (text: string) => text,
    };
    const shared = { state: {} };
    const task =
      "Finish the demo-ready proof. Do not submit. Do not restart the worker.";
    const call = spawnTool.renderCall(
      { name: "worker-demo-proof-2", agent: "worker", task },
      theme,
      { expanded: false, ...shared },
    );
    const started = spawnTool.renderResult(
      { details: { name: "worker-demo-proof-2", status: "started" } },
      {},
      theme,
      shared,
    );
    const width = 40;
    const combined = [...call.render(width), ...started.render(width)];
    const rule = TOOL_DISPLAY.border("─".repeat(width));
    assert.equal(combined[0], rule);
    assert.equal(combined.at(-1), rule);
    assert.equal(combined.filter((line) => line === rule).length, 2);
    assert.match(combined[1], /^▸ worker-demo-proof-2 \(worker\) — Finish/);
    assert.match(combined[1], /…/);
    assert.equal(combined[2], "▸ worker-demo-proof-2 — started");
    assert.equal(combined.join("\n").includes("customMessageBg"), false);

    const interruptState = { state: {} };
    const interruptCall = interruptTool.renderCall(
      { name: "worker-demo-proof-2" },
      theme,
      interruptState,
    );
    const interruptResult = interruptTool.renderResult(
      {
        details: {
          name: "worker-demo-proof-2",
          status: "interrupt_requested",
        },
      },
      {},
      theme,
      interruptState,
    );
    const interrupt = [
      ...interruptCall.render(width),
      ...interruptResult.render(width),
    ];
    assert.deepEqual(interrupt, [
      rule,
      "▸ worker-demo-proof-2 — interrupt turn",
      "▸ worker-demo-proof-2 — interrupt requested",
      rule,
    ]);
  } finally {
    if (previousDeny === undefined) delete process.env.PI_DENY_TOOLS;
    else process.env.PI_DENY_TOOLS = previousDeny;
  }
});

test("subagent steer skips only the generic tool divider", () => {
  assert.equal(shouldAppendToolBorder("subagent_steer"), false);
  assert.equal(shouldAppendToolBorder("subagent"), true);
  assert.equal(shouldAppendToolBorder("bash"), true);
});

test("persistent status drain delivers valid entries once in session order", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-status-drain-"));
  const sessionFile = join(dir, "child.jsonl");
  const entry = (kind: "status" | "error", report: string) => ({
    type: "custom",
    customType: "pi-attachable-subagents/persistent-status",
    data: { version: 1, childSessionId: "child", kind, report },
  });
  try {
    writeFileSync(
      sessionFile,
      [
        JSON.stringify({ type: "session", id: "child" }),
        JSON.stringify(entry("status", "first")),
        JSON.stringify({
          type: "custom",
          customType: "pi-attachable-subagents/persistent-status",
          data: {
            version: 1,
            childSessionId: "other",
            kind: "status",
            report: "ignored",
          },
        }),
        JSON.stringify({ type: "custom", customType: "other", data: {} }),
        JSON.stringify(entry("error", "second")),
      ].join("\n") + "\n",
    );
    const running = { id: "child", sessionFile, statusEntryCursor: 1 } as any;
    const delivered: string[] = [];
    __test__.drainPersistentStatuses(running, (status) =>
      delivered.push(`${status.kind}:${status.report}`),
    );
    __test__.drainPersistentStatuses(running, (status) =>
      delivered.push(`${status.kind}:${status.report}`),
    );
    writeFileSync(
      sessionFile,
      `${JSON.stringify(entry("status", "third"))}\n`,
      { flag: "a" },
    );
    __test__.drainPersistentStatuses(running, (status) =>
      delivered.push(`${status.kind}:${status.report}`),
    );
    assert.deepEqual(delivered, [
      "status:first",
      "error:second",
      "status:third",
    ]);
    assert.equal(running.statusEntryCursor, 6);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a human child-pane steer wakes the manager before settlement, but subagent_steer does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-manual-steer-"));
  const sessionFile = join(dir, "child.jsonl");
  const sessionId = "0943c11f-7349-4e58-ac2a-2d0199e742c1";
  const human =
    "so there is a bug in the numbers we display? q4 bonus earned should not display $10m?";
  const user = (text: string) => ({
    type: "message",
    message: { role: "user", content: [{ type: "text", text }] },
  });
  try {
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", id: sessionId }) + "\n",
    );
    const running = {
      id: sessionId,
      name: "bt5-q4-payout",
      sessionFile,
      statusEntryCursor: 1,
      managerSteers: ["initial task"],
    } as any;
    const wakes: string[] = [];
    const statuses: string[] = [];
    writeFileSync(
      sessionFile,
      [
        JSON.stringify(
          user('<skill name="q">\nbody\n</skill>\n\ninitial task'),
        ),
        JSON.stringify(user("manager follow-up")),
        JSON.stringify(user(human)),
        JSON.stringify({
          type: "custom",
          customType: "pi-attachable-subagents/persistent-status",
          data: {
            version: 1,
            childSessionId: sessionId,
            kind: "status",
            report: "settled later",
          },
        }),
      ].join("\n") + "\n",
      { flag: "a" },
    );
    __test__.noteManagerSteer(running, "manager follow-up");
    __test__.drainChildSessionEntries(running, {
      onStatus: (status) => statuses.push(status.report),
      onManualSteer: (text) =>
        wakes.push(
          __test__.formatManualSteerWake(running.name, running.id, text),
        ),
    });
    assert.deepEqual(wakes, [
      `Human command to child "bt5-q4-payout" (session ${sessionId}):\n\n${human}\n\nThe human sent this command to the child, not to you. Do not act on it. Await the child's response.`,
    ]);
    assert.deepEqual(statuses, ["settled later"]);
    assert.deepEqual(running.managerSteers, []);
    __test__.drainChildSessionEntries(running, {
      onManualSteer: (text) => wakes.push(text),
    });
    assert.equal(wakes.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a settled child pane steer wakes the manager and a manager steer does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-settled-steer-"));
  const sessionFile = join(dir, "child.jsonl");
  const sessionId = "0943c11f-7349-4e58-ac2a-2d0199e742c1";
  const human =
    "so there is a bug in the numbers we display? q4 bonus earned should not display $10m?";
  const child = {
    managerSessionId: "manager",
    childSessionId: sessionId,
    name: "bt5-q4-payout",
    cwd: dir,
  };
  const watches = new Map();
  const user = (text: string) =>
    JSON.stringify({
      type: "message",
      message: { role: "user", content: [{ type: "text", text }] },
    });
  try {
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", id: sessionId }) + "\n",
    );
    const armed = __test__.pollSettledManualSteers({
      children: [child],
      activeIds: new Set(),
      startingIds: new Set(),
      watches,
      resolveFile: () => sessionFile,
    });
    assert.deepEqual(armed, []);
    writeFileSync(sessionFile, user("from subagent_steer") + "\n", {
      flag: "a",
    });
    __test__.noteManagerSteer(watches.get(sessionId), "from subagent_steer");
    const suppressed = __test__.pollSettledManualSteers({
      children: [child],
      activeIds: new Set(),
      startingIds: new Set(),
      watches,
      resolveFile: () => sessionFile,
    });
    assert.deepEqual(suppressed, []);
    writeFileSync(sessionFile, user(human) + "\n", { flag: "a" });
    const wakes = __test__.pollSettledManualSteers({
      children: [child],
      activeIds: new Set(),
      startingIds: new Set(),
      watches,
      resolveFile: () => sessionFile,
    });
    assert.deepEqual(
      wakes.map((wake) =>
        __test__.formatManualSteerWake(wake.name, wake.sessionId, wake.text),
      ),
      [
        `Human command to child "bt5-q4-payout" (session ${sessionId}):\n\n${human}\n\nThe human sent this command to the child, not to you. Do not act on it. Await the child's response.`,
      ],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("human steer wakes once before the echo is suppressed; manager steer does not wake", () => {
  assert.deepEqual(__test__.steerWakePlan("human"), {
    noteBeforeSend: false,
    deliverAfterSend: true,
  });
  assert.deepEqual(__test__.steerWakePlan("manager"), {
    noteBeforeSend: true,
    deliverAfterSend: false,
  });
  const running = { managerSteers: [] as string[] };
  const wakes: string[] = [];
  __test__.finishHumanSteer(running, "pane text", (text) => wakes.push(text));
  assert.deepEqual(wakes, ["pane text"]);
  assert.deepEqual(running.managerSteers, ["pane text"]);
});

test("a file-wrapped manager launch or steer stays quiet, but a fragment does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-wrapped-steer-"));
  const sessionFile = join(dir, "child.jsonl");
  const sessionId = "a56d8dfb-906d-4a57-93fd-366f66c47db8";
  const task =
    "Review and finish the uncommitted manual-steer work in this dotfiles checkout.";
  const steer = "from subagent_steer";
  const wrap = (body: string) =>
    `<file name="/tmp/manual-steer-review-2026-10-08T11-55-02.md">\nComplete your task autonomously. If blocked, call caller_ping. When finished, call subagent_done. Automatic settlement is only a fallback.\n\n${body}\n\nYour FINAL assistant message should summarize what you accomplished.\n</file>`;
  const human =
    "the manual-steer work looks wrong; q4 bonus earned should not display $10m";
  const user = (text: string) =>
    JSON.stringify({
      type: "message",
      message: { role: "user", content: [{ type: "text", text }] },
    });
  try {
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", id: sessionId }) + "\n",
    );
    const running = {
      id: sessionId,
      name: "manual-steer-review",
      sessionFile,
      statusEntryCursor: 1,
      managerSteers: [task],
    } as any;
    writeFileSync(
      sessionFile,
      [user(wrap(task)), user(wrap(steer)), user(human)].join("\n") + "\n",
      { flag: "a" },
    );
    __test__.noteManagerSteer(running, steer);
    const wakes: string[] = [];
    __test__.drainChildSessionEntries(running, {
      onManualSteer: (text) => wakes.push(text),
    });
    assert.deepEqual(wakes, [human]);
    assert.deepEqual(running.managerSteers, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a newline-stripped subagent_steer echo does not wake the parent", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-collapsed-steer-"));
  const sessionFile = join(dir, "child.jsonl");
  const sessionId = "010ef6e6-35da-46b1-b2f9-2e22a4731452";
  const steer =
    'Lead command, quoted. Do this now.\n\n"just down -v\nThe decision is already made."';
  const persisted = steer.replace(/[\r\n]+/g, "");
  const human = "what is the issue? why are you manually starting containers?";
  const user = (text: string) =>
    JSON.stringify({
      type: "message",
      message: { role: "user", content: [{ type: "text", text }] },
    });
  try {
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", id: sessionId }) + "\n",
    );
    const running = {
      id: sessionId,
      name: "fresh-local-proof-2",
      sessionFile,
      statusEntryCursor: 1,
      managerSteers: [] as string[],
    } as any;
    writeFileSync(
      sessionFile,
      [user(persisted), user(human)].join("\n") + "\n",
      { flag: "a" },
    );
    __test__.noteManagerSteer(running, steer);
    const wakes: string[] = [];
    __test__.drainChildSessionEntries(running, {
      onManualSteer: (text) =>
        wakes.push(
          __test__.formatManualSteerWake(running.name, running.id, text),
        ),
    });
    assert.deepEqual(wakes, [
      `Human command to child "fresh-local-proof-2" (session ${sessionId}):\n\n${human}\n\nThe human sent this command to the child, not to you. Do not act on it. Await the child's response.`,
    ]);
    assert.equal(
      wakes.some((wake) => wake.includes("just down -v")),
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manual steer display shows the prompt, not the model instruction", () => {
  const prompt =
    "what is the issue? why are you manually starting containers? keep going until the local stack is up";
  const context = __test__.formatManualSteerWake(
    "mgr-fresh-local",
    "025faefb-c737-4a60-9822-849961c67141",
    prompt,
  );
  assert.match(context, /subagent_manual_steer|Human command to child/);
  assert.match(context, /The human sent this command to the child, not to you/);
  assert.match(context, /025faefb-c737-4a60-9822-849961c67141/);

  const collapsed = __test__.formatManualSteerDisplay(prompt, {
    expanded: false,
    width: 48,
    name: "mgr-fresh-local",
  });
  const visible = [collapsed.border, ...collapsed.lines, collapsed.border].join(
    "\n",
  );
  assert.match(collapsed.border, /^─+$/);
  assert.match(collapsed.lines[0], /^↪️ mgr-fresh-local /);
  assert.equal(collapsed.lines.length, 1);
  assert.equal(visible.toLowerCase().includes("ctrl+o"), false);
  assert.equal(visible.toLowerCase().includes("to expand"), false);
  assert.equal(visible.includes("The human sent"), false);
  assert.equal(visible.includes("Human command to child"), false);
  assert.equal(visible.includes("025faefb"), false);
  assert.equal(visible.includes("subagent_manual_steer"), false);
  assert.ok(collapsed.lines[0].length < `↪️ ${prompt}`.length);
  assert.equal(collapsed.lines[0].includes("•"), false);
  assert.equal(collapsed.lines[0].includes("🟡"), false);

  const expanded = __test__.formatManualSteerDisplay(prompt, {
    expanded: true,
    width: 80,
    name: "mgr-fresh-local",
  });
  assert.equal(expanded.lines.join("\n").includes(prompt), true);
  assert.equal(
    __test__.paintManualSteerBorder(collapsed.border),
    TOOL_DISPLAY.border(collapsed.border),
  );
  assert.equal(
    __test__.paintManualSteerBorder(collapsed.border).includes("\x1b[34"),
    false,
  );
});

test("a file-tagged subagent_steer echo does not wake the parent", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-tool-steer-file-"));
  const sessionFile = join(dir, "child.jsonl");
  const sessionId = "538025be-423f-4eaa-a243-53145a59fb21";
  const steer =
    "Correction. The lead says the candidate pre-filter must keep only active entities.";
  const tagged = `<file name="/tmp/bt6-q2-manager-b-steer.md">\n${steer}\n</file>\n`;
  const human = "keep only active entities";
  const user = (text: string) =>
    JSON.stringify({
      type: "message",
      message: { role: "user", content: [{ type: "text", text }] },
    });
  try {
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", id: sessionId }) + "\n",
    );
    const running = {
      id: sessionId,
      name: "bt6-q2-manager-b",
      sessionFile,
      statusEntryCursor: 1,
      managerSteers: [] as string[],
    } as any;
    writeFileSync(sessionFile, [user(tagged), user(human)].join("\n") + "\n", {
      flag: "a",
    });
    __test__.noteManagerSteer(running, steer);
    const wakes: string[] = [];
    __test__.drainChildSessionEntries(running, {
      onManualSteer: (text) =>
        wakes.push(
          __test__.formatManualSteerWake(running.name, running.id, text),
        ),
    });
    assert.equal(wakes.length, 1);
    assert.match(wakes[0], /^Human command to child "bt6-q2-manager-b"/);
    assert.match(wakes[0], new RegExp(human));
    assert.equal(wakes[0].includes(steer), false);
    assert.deepEqual(running.managerSteers, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an idle autoExit:false settled drain does not wake when a manager steer had no watch", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-idle-steer-miss-"));
  const sessionFile = join(dir, "child.jsonl");
  const sessionId = "c71caef1-e040-4fcf-b840-561944acd187";
  const plain = "Lead accepted the triage. Do not override any row.";
  const idle = "Keep this manager steer quiet on the idle child.";
  const idlePrompt = [
    "Complete your task autonomously. If blocked, call caller_ping. When finished, call subagent_done. Automatic settlement is only a fallback.",
    idle,
    "Your FINAL assistant message should summarize what you accomplished.",
  ].join("\n\n");
  const wrappedIdle = `<file name="/tmp/idle-relaunch.md">\n${idlePrompt}\n</file>\n`;
  const human = "the human typed this in the child pane";
  const child = {
    managerSessionId: "manager",
    childSessionId: sessionId,
    name: "pro-9678-pr-comments",
    cwd: dir,
    autoExit: false,
  };
  const watches = new Map();
  const user = (text: string) =>
    JSON.stringify({
      type: "message",
      message: { role: "user", content: [{ type: "text", text }] },
    });
  const poll = () =>
    __test__.pollSettledManualSteers({
      children: [child],
      activeIds: new Set(),
      startingIds: new Set(),
      watches,
      resolveFile: () => sessionFile,
    });
  try {
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: "session", id: sessionId }) + "\n",
    );
    __test__.noteSettledManagerSteer(sessionId, plain);
    __test__.noteSettledManagerSteer(sessionId, idle);
    assert.deepEqual(poll(), []);
    writeFileSync(
      sessionFile,
      [user(plain), user(wrappedIdle)].join("\n") + "\n",
      { flag: "a" },
    );
    __test__.armSettledSteerWatch({
      id: sessionId,
      name: child.name,
      sessionFile,
      statusEntryCursor: 1,
      managerSteers: [],
    });
    assert.deepEqual(poll(), []);
    writeFileSync(sessionFile, user(human) + "\n", { flag: "a" });
    const wakes = poll();
    assert.deepEqual(
      wakes.map((wake) =>
        __test__.formatManualSteerWake(wake.name, wake.sessionId, wake.text),
      ),
      [
        `Human command to child "pro-9678-pr-comments" (session ${sessionId}):\n\n${human}\n\nThe human sent this command to the child, not to you. Do not act on it. Await the child's response.`,
      ],
    );
    assert.deepEqual(poll(), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sidecar cache clears for a changed model, then selects its bucket and change-back", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-sidecar-display-"));
  const sessionFile = join(dir, "child.jsonl");
  const stateDir = join(dir, "state");
  const writeSession = (model: string) =>
    writeFileSync(
      sessionFile,
      [
        JSON.stringify({ type: "session", id: "child" }),
        JSON.stringify({
          type: "model_change",
          id: "model",
          parentId: "child",
          provider: "openai",
          modelId: model,
        }),
      ].join("\n") + "\n",
    );
  try {
    writeSession("first");
    const sidecar = requestStatsTest.requestStatsSidecarPath("child", stateDir);
    mkdirSync(join(stateDir, "sessions"), { recursive: true });
    writeFileSync(
      sidecar,
      JSON.stringify({
        version: 2,
        sessionId: "child",
        buckets: [
          {
            provider: "openai",
            model: "first",
            outputTokens: 20,
            generationMs: 1000,
            waitMs: 500,
            requestCount: 1,
          },
          {
            provider: "openai",
            model: "second",
            outputTokens: 30,
            generationMs: 2000,
            waitMs: 800,
            requestCount: 1,
          },
        ],
      }),
    );
    const running = { id: "child", sessionFile } as any;
    __test__.refreshDisplaySnapshot(running, 1000, stateDir);
    assert.equal(running.displayTps, 20);
    writeFileSync(
      sidecar,
      JSON.stringify({
        version: 2,
        sessionId: "child",
        buckets: [
          {
            provider: "openai",
            model: "first",
            outputTokens: 40,
            generationMs: 1000,
            waitMs: 500,
            requestCount: 1,
          },
          {
            provider: "openai",
            model: "second",
            outputTokens: 30,
            generationMs: 2000,
            waitMs: 800,
            requestCount: 1,
          },
        ],
      }),
    );
    __test__.refreshDisplaySnapshot(running, 1500, stateDir);
    assert.equal(running.displayTps, 20);
    __test__.refreshDisplaySnapshot(running, 2000, stateDir);
    assert.equal(running.displayTps, 40);
    writeSession("missing");
    __test__.refreshDisplaySnapshot(running, 1001, stateDir);
    assert.equal(running.displayModel, "missing");
    assert.equal(running.displayTps, undefined);
    writeSession("second");
    __test__.refreshDisplaySnapshot(running, 1002, stateDir);
    assert.equal(running.displayTps, 15);
    writeSession("first");
    __test__.refreshDisplaySnapshot(running, 1003, stateDir);
    assert.equal(running.displayTps, 40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtime launch profile is transient and does not write snapshots", () => {
  const command = __test__.buildPiLaunchCommand(
    {
      sessionFile: "/session",
      activityFile: "/activity",
      cwdPrefix: "cd /work && ",
      environment: [],
      arguments: ["pi"],
      selectedSkills: [],
    },
    { surface: "%1", promptArguments: ["continue"], originalLaunch: false },
  );
  assert.match(command, /pi/);
  assert.equal(JSON.stringify(__test__).includes("resumable-snapshot"), false);
});

test("launch command records the hidden tmux owner for child detach", () => {
  const command = __test__.buildPiLaunchCommand(
    {
      sessionFile: "/session",
      activityFile: "/activity",
      cwdPrefix: "cd /work && ",
      environment: [],
      arguments: ["pi"],
      selectedSkills: [],
    },
    {
      surface: "%1",
      promptArguments: ["continue"],
      originalLaunch: false,
      tmuxHiddenSession: "pi-hidden-parent",
    },
  );
  assert.match(command, /PI_SUBAGENT_TMUX_HIDDEN_SESSION='pi-hidden-parent'/);
  assert.match(command, /PI_SUBAGENT_SURFACE='%1'/);
});

test("T10 nested delegators use distinct hidden tmux owners", () => {
  const parent = __test__.tmuxHiddenSessionName("ceo-id");
  const child = __test__.tmuxHiddenSessionName("manager-id");
  assert.equal(parent, "pi-hidden-ceo-id");
  assert.equal(child, "pi-hidden-manager-id");
  assert.notEqual(parent, child);
});

test("failed dispatch keeps the hidden tmux owner", async () => {
  const lifecycle = __test__.createExtensionLifecycle();
  const owner = { sessionName: "pi-hidden-parent", keeperPaneId: "%0" };
  lifecycle.tmuxHiddenOwner = owner;
  await assert.rejects(
    __test__.runLaunchLifecycle({
      seed: () => {},
      appendRegistration: () => {},
      createSurface: () => {
        lifecycle.tmuxHiddenOwner = owner;
        return "%child";
      },
      dispatch: () => {
        throw new Error("dispatch");
      },
      closeSurface: () => {},
    }),
    /dispatch/,
  );
  assert.equal(lifecycle.tmuxHiddenOwner, owner);
  assert.equal(lifecycle.ownedRuns.size, 0);
});

test("T8 last owned-run close destroys the hidden tmux owner", () => {
  const lifecycle = __test__.createExtensionLifecycle();
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const running = { id: "child", surface: "%1" } as Running;
  lifecycle.ownedRuns.add(running);
  lifecycle.tmuxHiddenOwner = {
    sessionName: "pi-hidden-parent",
    keeperPaneId: "%0",
  };
  const destroyed: string[] = [];
  lifecycle.ownedRuns.delete(running);
  __test__.releaseTmuxHiddenOwnerIfIdle(lifecycle, (owner) =>
    destroyed.push(owner.sessionName),
  );
  assert.deepEqual(destroyed, ["pi-hidden-parent"]);
  assert.equal(lifecycle.tmuxHiddenOwner, undefined);
});

test("T8 a remaining owned pane keeps the hidden tmux owner", () => {
  const lifecycle = __test__.createExtensionLifecycle();
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const kept = { id: "kept", surface: "%1" } as Running;
  const closed = { id: "closed", surface: "%2" } as Running;
  lifecycle.ownedRuns.add(kept);
  lifecycle.ownedRuns.add(closed);
  lifecycle.tmuxHiddenOwner = {
    sessionName: "pi-hidden-parent",
    keeperPaneId: "%0",
  };
  const destroyed: string[] = [];
  lifecycle.ownedRuns.delete(closed);
  __test__.releaseTmuxHiddenOwnerIfIdle(lifecycle, (owner) =>
    destroyed.push(owner.sessionName),
  );
  assert.deepEqual(destroyed, []);
  assert.equal(lifecycle.tmuxHiddenOwner?.sessionName, "pi-hidden-parent");
});

test("T9 shutdown destroys the hidden owner after closing owned panes", () => {
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const lifecycle = __test__.createExtensionLifecycle();
  const running = {
    id: "child",
    surface: "%shutdown",
    abortController: new AbortController(),
  } as Running;
  const active = new Map<string, Running>([["child", running]]);
  lifecycle.ownedRuns.add(running);
  lifecycle.tmuxHiddenOwner = {
    sessionName: "pi-hidden-parent",
    keeperPaneId: "%0",
  };
  const closed: string[] = [];
  const destroyed: string[] = [];
  __test__.shutdownLifecycle(
    lifecycle,
    active,
    (surface) => closed.push(surface),
    new Map(),
    __test__.delegatorLiveness,
    (owner) => destroyed.push(owner.sessionName),
  );
  assert.deepEqual(closed, ["%shutdown"]);
  assert.deepEqual(destroyed, ["pi-hidden-parent"]);
  assert.equal(lifecycle.tmuxHiddenOwner, undefined);
  assert.equal(lifecycle.ownedRuns.size, 0);
});

test("T9 close failure retains the hidden tmux owner", () => {
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const lifecycle = __test__.createExtensionLifecycle();
  const running = { id: "child", surface: "%leak" } as Running;
  const active = new Map<string, Running>([["child", running]]);
  lifecycle.ownedRuns.add(running);
  lifecycle.tmuxHiddenOwner = {
    sessionName: "pi-hidden-parent",
    keeperPaneId: "%0",
  };
  const destroyed: string[] = [];
  assert.throws(
    () =>
      __test__.shutdownLifecycle(
        lifecycle,
        active,
        () => {
          throw new Error("close failed");
        },
        new Map(),
        __test__.delegatorLiveness,
        (owner) => destroyed.push(owner.sessionName),
      ),
    /Failed to close subagent surfaces/,
  );
  assert.deepEqual(destroyed, []);
  assert.equal(lifecycle.tmuxHiddenOwner?.sessionName, "pi-hidden-parent");
  assert.equal(lifecycle.ownedRuns.has(running), true);
});

test("T9 replacement shutdown destroys only the old hidden owner", () => {
  type Running = Parameters<typeof __test__.removeActiveRun>[1];
  const oldLifecycle = __test__.createExtensionLifecycle();
  const newLifecycle = __test__.createExtensionLifecycle();
  const oldRun = { id: "old", surface: "%old" } as Running;
  const newRun = { id: "new", surface: "%new" } as Running;
  oldLifecycle.ownedRuns.add(oldRun);
  newLifecycle.ownedRuns.add(newRun);
  oldLifecycle.tmuxHiddenOwner = {
    sessionName: "pi-hidden-old",
    keeperPaneId: "%0",
  };
  newLifecycle.tmuxHiddenOwner = {
    sessionName: "pi-hidden-new",
    keeperPaneId: "%1",
  };
  const active = new Map<string, Running>([
    ["old", oldRun],
    ["new", newRun],
  ]);
  const destroyed: string[] = [];
  __test__.shutdownLifecycle(
    oldLifecycle,
    active,
    () => {},
    new Map(),
    __test__.delegatorLiveness,
    (owner) => destroyed.push(owner.sessionName),
  );
  assert.deepEqual(destroyed, ["pi-hidden-old"]);
  assert.equal(oldLifecycle.tmuxHiddenOwner, undefined);
  assert.equal(newLifecycle.tmuxHiddenOwner?.sessionName, "pi-hidden-new");
  assert.equal(active.get("new"), newRun);
});

function captureCommands() {
  const commands = new Map<
    string,
    { handler: (args: string, ctx: unknown) => Promise<void> }
  >();
  const pi = {
    on() {},
    registerTool() {},
    registerCommand(
      name: string,
      command: { handler: (args: string, ctx: unknown) => Promise<void> },
    ) {
      commands.set(name, command);
    },
    registerShortcut() {},
    registerMessageRenderer() {},
  } as unknown as ExtensionAPI;
  subagentsExtension(pi);
  return commands;
}

test("T7 attach outside tmux is a no-op with an error", async () => {
  const previousMux = process.env.PI_SUBAGENT_MUX;
  const previousTmux = process.env.TMUX;
  const previousPane = process.env.TMUX_PANE;
  const previousHerdrEnv = process.env.HERDR_ENV;
  const previousHerdrPane = process.env.HERDR_PANE_ID;
  delete process.env.PI_SUBAGENT_MUX;
  delete process.env.TMUX;
  delete process.env.TMUX_PANE;
  delete process.env.HERDR_ENV;
  delete process.env.HERDR_PANE_ID;
  const notifications: Array<{ message: string; level?: string }> = [];
  try {
    const commands = captureCommands();
    await commands.get("attach")!.handler("child", {
      ui: {
        notify(message: string, level?: string) {
          notifications.push({ message, level });
        },
      },
    });
    assert.deepEqual(notifications, [
      { message: "/attach requires tmux or herdr.", level: "error" },
    ]);
  } finally {
    if (previousMux == null) delete process.env.PI_SUBAGENT_MUX;
    else process.env.PI_SUBAGENT_MUX = previousMux;
    if (previousTmux == null) delete process.env.TMUX;
    else process.env.TMUX = previousTmux;
    if (previousPane == null) delete process.env.TMUX_PANE;
    else process.env.TMUX_PANE = previousPane;
    if (previousHerdrEnv == null) delete process.env.HERDR_ENV;
    else process.env.HERDR_ENV = previousHerdrEnv;
    if (previousHerdrPane == null) delete process.env.HERDR_PANE_ID;
    else process.env.HERDR_PANE_ID = previousHerdrPane;
  }
});

test("T7 idle-child attach is rejected without moving a pane", async () => {
  const previousMux = process.env.PI_SUBAGENT_MUX;
  const previousTmux = process.env.TMUX;
  const previousPane = process.env.TMUX_PANE;
  const previousCmux = process.env.CMUX_SOCKET_PATH;
  process.env.PI_SUBAGENT_MUX = "tmux";
  process.env.TMUX = process.env.TMUX || "test";
  process.env.TMUX_PANE = "%1";
  delete process.env.CMUX_SOCKET_PATH;
  __test__.childrenBySessionId.clear();
  __test__.runningSubagents.clear();
  __test__.childrenBySessionId.set("child", {
    managerSessionId: "manager",
    childSessionId: "child",
    name: "Idle planner",
    cwd: "/work",
  });
  const notifications: Array<{ message: string; level?: string }> = [];
  try {
    const commands = captureCommands();
    await commands.get("attach")!.handler("child", {
      ui: {
        notify(message: string, level?: string) {
          notifications.push({ message, level });
        },
      },
    });
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /idle/);
    assert.equal(notifications[0]!.level, "info");
  } finally {
    __test__.childrenBySessionId.clear();
    __test__.runningSubagents.clear();
    if (previousMux == null) delete process.env.PI_SUBAGENT_MUX;
    else process.env.PI_SUBAGENT_MUX = previousMux;
    if (previousTmux == null) delete process.env.TMUX;
    else process.env.TMUX = previousTmux;
    if (previousPane == null) delete process.env.TMUX_PANE;
    else process.env.TMUX_PANE = previousPane;
    if (previousCmux == null) delete process.env.CMUX_SOCKET_PATH;
    else process.env.CMUX_SOCKET_PATH = previousCmux;
  }
});

test("settlement wake tells the manager to steer the same session", () => {
  const settled = __test__.resolveResultPresentation(
    {
      exitCode: 0,
      elapsed: 90,
      summary: "Next I will write CODE_NOTES.md.",
      sessionFile: "/tmp/child.jsonl",
      reason: "settlement",
    },
    "intake-AI-265",
  );
  assert.match(settled, /settled \(1m 30s\)/);
  assert.match(settled, /ordinary end of turn, not task completion/);
  assert.match(settled, /Do not spawn a replacement/);
  assert.match(settled, /Call subagent_steer/);
  assert.doesNotMatch(settled, /completed/);

  const finished = __test__.resolveResultPresentation(
    {
      exitCode: 0,
      elapsed: 12,
      summary: "Intake ready.",
      reason: "done",
    },
    "intake-AI-265",
  );
  assert.match(finished, /finished \(12s\) via subagent_done/);
  assert.doesNotMatch(finished, /Do not spawn a replacement/);

  const failed = __test__.resolveResultPresentation(
    {
      exitCode: 0,
      elapsed: 4,
      summary: "",
      errorMessage: "usage limit",
      sessionFile: "/tmp/child.jsonl",
    },
    "intake-AI-265",
  );
  assert.match(failed, /Steer the durable child session/);
  assert.doesNotMatch(failed, /You can retry by spawning a new/);
});

test("startup auth pane error is a failed result, not a successful steer", () => {
  const pane = [
    "Error: No API key found for amazon-bedrock.",
    "",
    "Use /login to log into a provider via OAuth or API key.",
  ].join("\n");
  const error = interpretStartupPaneError(pane);
  assert.equal(error, "No API key found for amazon-bedrock");
  const presentation = __test__.resolveResultPresentation(
    {
      exitCode: 1,
      elapsed: 2,
      summary: `Subagent error: ${error}`,
      errorMessage: error,
      reason: "error",
      sessionFile: "/tmp/child.jsonl",
    },
    "planner-design",
  );
  assert.match(presentation, /failed/);
  assert.match(presentation, /No API key found for amazon-bedrock/);
  assert.doesNotMatch(presentation, /settled/);
  assert.doesNotMatch(presentation, /Steered/);
  assert.equal(interpretStartupPaneError("ordinary child output"), undefined);
});

test("aborted settlement does not notify the parent; ordinary settlement still does", async () => {
  assert.equal(settlementNotifiesParent({ aborted: true }), false);
  assert.equal(settlementNotifiesParent({ aborted: false }), true);
  assert.equal(
    settlementNotifiesParent({ aborted: false }, [
      { role: "assistant", stopReason: "aborted" },
    ]),
    false,
  );
  assert.equal(
    settlementNotifiesParent({}, [
      { role: "assistant", stopReason: "aborted" },
    ]),
    false,
  );

  const tempDir = mkdtempSync(join(tmpdir(), "pi-abort-settle-"));
  const sessionFile = join(tempDir, "child.jsonl");
  const previousSession = process.env.PI_SUBAGENT_SESSION;
  const previousAutoExit = process.env.PI_SUBAGENT_AUTO_EXIT;
  const previousId = process.env.PI_SUBAGENT_ID;
  process.env.PI_SUBAGENT_SESSION = sessionFile;
  process.env.PI_SUBAGENT_AUTO_EXIT = "true";
  process.env.PI_SUBAGENT_ID = "child-abort";
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
    },
    appendEntry() {},
    getAllTools() {
      return [];
    },
    getCommands() {
      return [];
    },
    registerCommand() {},
    registerShortcut() {},
    registerTool() {},
    sendUserMessage() {},
  } as unknown as ExtensionAPI;
  let shutdowns = 0;
  const ctx = {
    shutdown() {
      shutdowns += 1;
    },
    hasUI: false,
    ui: { setStatus() {}, setWidget() {}, notify() {} },
  };
  try {
    subagentDoneExtension(pi);
    await handlers.get("agent_end")?.({
      type: "agent_end",
      messages: [{ role: "assistant", stopReason: "aborted", content: [] }],
    });
    await handlers.get("agent_settled")?.(
      { type: "agent_settled", aborted: true },
      ctx,
    );
    assert.equal(shutdowns, 0);
    assert.equal(existsSync(`${sessionFile}.exit`), false);

    await handlers.get("agent_end")?.({
      type: "agent_end",
      messages: [{ role: "assistant", stopReason: "aborted", content: [] }],
    });
    await handlers.get("agent_settled")?.({ type: "agent_settled" }, ctx);
    assert.equal(shutdowns, 0);
    assert.equal(existsSync(`${sessionFile}.exit`), false);

    await handlers.get("agent_end")?.({
      type: "agent_end",
      messages: [
        {
          role: "assistant",
          stopReason: "stop",
          content: [{ type: "text", text: "finished" }],
        },
      ],
    });
    await handlers.get("agent_settled")?.(
      { type: "agent_settled", aborted: false },
      ctx,
    );
    assert.equal(shutdowns, 1);
    assert.equal(existsSync(`${sessionFile}.exit`), true);

    const idleSession = join(tempDir, "idle.jsonl");
    process.env.PI_SUBAGENT_SESSION = idleSession;
    process.env.PI_SUBAGENT_AUTO_EXIT = "false";
    const idleHandlers = new Map<string, (...args: unknown[]) => unknown>();
    const entries: string[] = [];
    const idlePi = {
      on(name: string, handler: (...args: unknown[]) => unknown) {
        idleHandlers.set(name, handler);
      },
      appendEntry(customType: string) {
        entries.push(customType);
      },
      getAllTools() {
        return [];
      },
      getCommands() {
        return [];
      },
      registerCommand() {},
      registerShortcut() {},
      registerTool() {},
      sendUserMessage() {},
    } as unknown as ExtensionAPI;
    let idleShutdowns = 0;
    subagentDoneExtension(idlePi);
    await idleHandlers.get("agent_end")?.({
      type: "agent_end",
      messages: [{ role: "assistant", stopReason: "aborted", content: [] }],
    });
    await idleHandlers.get("agent_settled")?.(
      { type: "agent_settled" },
      {
        shutdown() {
          idleShutdowns += 1;
        },
        hasUI: false,
        ui: { setStatus() {}, setWidget() {}, notify() {} },
      },
    );
    assert.equal(idleShutdowns, 0);
    assert.equal(existsSync(`${idleSession}.exit`), false);
    assert.deepEqual(entries, []);
  } finally {
    if (previousSession == null) delete process.env.PI_SUBAGENT_SESSION;
    else process.env.PI_SUBAGENT_SESSION = previousSession;
    if (previousAutoExit == null) delete process.env.PI_SUBAGENT_AUTO_EXIT;
    else process.env.PI_SUBAGENT_AUTO_EXIT = previousAutoExit;
    if (previousId == null) delete process.env.PI_SUBAGENT_ID;
    else process.env.PI_SUBAGENT_ID = previousId;
    rmSync(tempDir, { recursive: true, force: true });
  }
});
