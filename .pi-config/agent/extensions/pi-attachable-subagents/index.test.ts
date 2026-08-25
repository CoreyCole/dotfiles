import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import subagentsExtension, { __test__ } from "./index.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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
  assert.deepEqual(
    [
      ...__test__
        .replayChildCatalog({ id: "manager" }, "manager", [
          entry("one"),
          entry("one"),
          entry("foreign", "other"),
        ])
        .keys(),
    ],
    ["one"],
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
  assert.equal(starting.size, 0);
  assert.equal(catalog.get("child")?.name, "Planner");
  assert.equal(
    appended.includes("pi-attachable-subagents/resumable-snapshot"),
    false,
  );
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
      environment: ["PI_DENY_TOOLS='subagent'"],
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
    child: child("one"),
    start: () => start("one"),
  });
  const second = await __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
    child: child("one"),
    start: () => start("duplicate"),
  });
  assert.equal(second.kind, "starting");
  assert.equal(surfaces, 1);
  assert.equal(dispatches, 0);

  const other = __test__.startIdleChild({
    activeRuns: active,
    startingRuns: starting,
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
    child: child("retry"),
    async start() {
      attempts += 1;
      return { id: "retry", surface: "%retry" } as Running;
    },
  });
  assert.equal(retry.kind, "active");
  assert.equal(attempts, 2);
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
