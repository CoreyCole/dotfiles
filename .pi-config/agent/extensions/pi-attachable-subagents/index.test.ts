import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import subagentsExtension, { __test__ } from "./index.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createStatusState, observeStatus } from "./status.ts";
import { shouldAppendToolBorder } from "../tool-border.ts";

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

test("named role launch arguments include model, role prompt, and control tools", () => {
  assert.equal(
    __test__.resolveModelArgument(undefined, "openai/gpt", "high"),
    "openai/gpt:high",
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
    "read,bash,caller_ping,subagent_wait,subagent_done",
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
        "'read,caller_ping,subagent_wait,subagent_done'",
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
  assert.match(
    command,
    /--tools 'read,caller_ping,subagent_wait,subagent_done'/,
  );
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
        model: "openai/gpt",
        thinking: "high",
        tools: "read,bash",
        denyTools: "write",
        spawning: false,
        systemPromptMode: "replace",
        body: "role instructions",
      },
      promptDir: dir,
    });
    assert.match(profile.arguments.join(" "), /--model 'openai\/gpt:high'/);
    assert.match(profile.arguments.join(" "), /--system-prompt/);
    assert.match(
      profile.arguments.join(" "),
      /read,bash,caller_ping,subagent_wait,subagent_done/,
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
  assert.match(lines.find((line) => line.includes("Old"))!, /🔴.*Aug 23 11:28/);
  assert.match(lines.find((line) => line.includes("New"))!, /Aug 25 09:56/);
  assert.match(lines.find((line) => line.includes("Middle"))!, /Aug 24 11:28/);

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
  assert.match(lines.find((line) => line.includes("Idle"))!, /🔴 Dec 30 12:53/);
  assert.doesNotMatch(lines.find((line) => line.includes("Idle"))!, /·/);
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
  assert.match(lines.find((line) => line.includes("Provider"))!, /🟡 10:18/);
  assert.match(lines.find((line) => line.includes("Streaming"))!, /🟢 10:18/);
  assert.doesNotMatch(
    lines.find((line) => line.includes("Provider"))!,
    /provider/,
  );
  assert.doesNotMatch(
    lines.find((line) => line.includes("Streaming"))!,
    /streaming/,
  );
  assert.doesNotMatch(lines.find((line) => line.includes("Provider"))!, /·/);
  assert.doesNotMatch(lines.find((line) => line.includes("Streaming"))!, /·/);
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
  const collapsed = steerTool
    .renderCall({ target: "child-123", message }, theme, { expanded: false })
    .render(120)
    .join("\n");
  assert.match(collapsed, /child-123/);
  assert.match(collapsed, /First line/);
  assert.match(collapsed, /2 lines/);
  assert.match(collapsed, /Ctrl\+O to expand/);

  const expanded = steerTool
    .renderCall({ target: "child-123", message }, theme, { expanded: true })
    .render(120)
    .join("\n");
  assert.match(expanded, /Second line with the full steer prompt/);
  assert.doesNotMatch(expanded, /Ctrl\+O to expand/);

  const success = steerTool
    .renderResult(
      { details: { target: "child-123", name: "Worker", status: "steered" } },
      {},
      theme,
    )
    .render(120)
    .join("\n");
  const failure = steerTool
    .renderResult(
      { details: { target: "child-123", status: "error", error: "failed" } },
      {},
      theme,
    )
    .render(120)
    .join("\n");
  assert.match(success, /Worker — steered/);
  assert.match(failure, /child-123 — steer failed/);
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
