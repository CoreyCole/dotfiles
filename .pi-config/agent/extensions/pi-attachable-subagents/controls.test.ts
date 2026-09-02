import assert from "node:assert/strict";
import test from "node:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import subagentDoneExtension, {
  PERSISTENT_STATUS_CUSTOM_TYPE,
  persistTerminalOutcome,
  queueDiscussMessage,
  settleDiscussMode,
} from "./subagent-done.ts";
import { inspectSession } from "./session.ts";
import { __pollForExitTest__ } from "./cmux.ts";

test("failed sidecar persistence does not mark terminal intent", () => {
  let marked = false;
  assert.throws(() =>
    persistTerminalOutcome(
      "/tmp/child",
      { type: "done" },
      () => {
        marked = true;
      },
      () => {
        throw new Error("disk full");
      },
    ),
  );
  assert.equal(marked, false);
});

test("one-turn discussion suppresses one settlement", () => {
  assert.deepEqual(settleDiscussMode("next-turn"), {
    mode: "normal",
    suppress: true,
  });
  assert.deepEqual(settleDiscussMode("normal"), {
    mode: "normal",
    suppress: false,
  });
  assert.deepEqual(settleDiscussMode("locked"), {
    mode: "locked",
    suppress: true,
  });
});

test("subagent_wait keeps the child alive across settlement", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const tools = new Map<string, any>();
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
    },
    getAllTools() {
      return [];
    },
    getCommands() {
      return [];
    },
    registerCommand() {},
    registerShortcut() {},
    registerTool(tool: any) {
      tools.set(tool.name, tool);
    },
  } as unknown as ExtensionAPI;
  subagentDoneExtension(pi);

  const result = await tools
    .get("subagent_wait")
    .execute("call", {}, undefined, undefined, {});
  let shutdowns = 0;
  await handlers.get("agent_settled")?.(
    { type: "agent_settled" },
    {
      shutdown() {
        shutdowns += 1;
      },
    },
  );

  assert.equal(shutdowns, 0);
  assert.match(result.content[0].text, /Wait mode enabled/);
});

test("default settlement writes one terminal sidecar and exits", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "pi-subagent-settlement-"));
  const sessionFile = join(tempDir, "child.jsonl");
  const previousSession = process.env.PI_SUBAGENT_SESSION;
  const previousAutoExit = process.env.PI_SUBAGENT_AUTO_EXIT;
  process.env.PI_SUBAGENT_SESSION = sessionFile;
  process.env.PI_SUBAGENT_AUTO_EXIT = "true";

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
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
  } as unknown as ExtensionAPI;
  let shutdowns = 0;

  try {
    subagentDoneExtension(pi);
    await handlers.get("agent_settled")?.(
      { type: "agent_settled" },
      {
        shutdown() {
          shutdowns += 1;
        },
      },
    );
    assert.deepEqual(JSON.parse(readFileSync(`${sessionFile}.exit`, "utf8")), {
      type: "settlement",
    });
    assert.equal(shutdowns, 1);
  } finally {
    if (previousSession == null) delete process.env.PI_SUBAGENT_SESSION;
    else process.env.PI_SUBAGENT_SESSION = previousSession;
    if (previousAutoExit == null) delete process.env.PI_SUBAGENT_AUTO_EXIT;
    else process.env.PI_SUBAGENT_AUTO_EXIT = previousAutoExit;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("persistent settlements append ordered statuses without exiting", async () => {
  const previousAutoExit = process.env.PI_SUBAGENT_AUTO_EXIT;
  const previousId = process.env.PI_SUBAGENT_ID;
  process.env.PI_SUBAGENT_AUTO_EXIT = "false";
  process.env.PI_SUBAGENT_ID = "manager";

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const entries: Array<{ type: string; data: unknown }> = [];
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
    },
    appendEntry(type: string, data: unknown) {
      entries.push({ type, data });
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
  } as unknown as ExtensionAPI;
  let shutdowns = 0;

  try {
    subagentDoneExtension(pi);
    await handlers.get("agent_end")?.({
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "First report" }],
        },
      ],
    });
    await handlers.get("agent_settled")?.(
      {},
      {
        shutdown() {
          shutdowns += 1;
        },
      },
    );
    await handlers.get("agent_end")?.({
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "Second report" }],
        },
      ],
    });
    await handlers.get("agent_settled")?.(
      {},
      {
        shutdown() {
          shutdowns += 1;
        },
      },
    );

    assert.deepEqual(entries, [
      {
        type: PERSISTENT_STATUS_CUSTOM_TYPE,
        data: {
          version: 1,
          childSessionId: "manager",
          kind: "status",
          report: "First report",
        },
      },
      {
        type: PERSISTENT_STATUS_CUSTOM_TYPE,
        data: {
          version: 1,
          childSessionId: "manager",
          kind: "status",
          report: "Second report",
        },
      },
    ]);
    assert.equal(shutdowns, 0);
  } finally {
    if (previousAutoExit == null) delete process.env.PI_SUBAGENT_AUTO_EXIT;
    else process.env.PI_SUBAGENT_AUTO_EXIT = previousAutoExit;
    if (previousId == null) delete process.env.PI_SUBAGENT_ID;
    else process.env.PI_SUBAGENT_ID = previousId;
  }
});

test("persistent provider errors append an error status without exiting", async () => {
  const previousAutoExit = process.env.PI_SUBAGENT_AUTO_EXIT;
  const previousId = process.env.PI_SUBAGENT_ID;
  process.env.PI_SUBAGENT_AUTO_EXIT = "false";
  process.env.PI_SUBAGENT_ID = "manager";

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const entries: Array<{ type: string; data: unknown }> = [];
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
    },
    appendEntry(type: string, data: unknown) {
      entries.push({ type, data });
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
  } as unknown as ExtensionAPI;
  let shutdowns = 0;

  try {
    subagentDoneExtension(pi);
    await handlers.get("agent_end")?.({
      messages: [
        {
          role: "assistant",
          stopReason: "error",
          errorMessage: "rate limited",
        },
      ],
    });
    await handlers.get("agent_settled")?.(
      {},
      {
        shutdown() {
          shutdowns += 1;
        },
      },
    );
    assert.deepEqual(entries, [
      {
        type: PERSISTENT_STATUS_CUSTOM_TYPE,
        data: {
          version: 1,
          childSessionId: "manager",
          kind: "error",
          report: "rate limited",
        },
      },
    ]);
    assert.equal(shutdowns, 0);
  } finally {
    if (previousAutoExit == null) delete process.env.PI_SUBAGENT_AUTO_EXIT;
    else process.env.PI_SUBAGENT_AUTO_EXIT = previousAutoExit;
    if (previousId == null) delete process.env.PI_SUBAGENT_ID;
    else process.env.PI_SUBAGENT_ID = previousId;
  }
});

test("terminal tools remain terminal for persistent children", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "pi-subagent-terminal-"));
  const sessionFile = join(tempDir, "child.jsonl");
  const previousSession = process.env.PI_SUBAGENT_SESSION;
  const previousAutoExit = process.env.PI_SUBAGENT_AUTO_EXIT;
  const previousId = process.env.PI_SUBAGENT_ID;
  process.env.PI_SUBAGENT_SESSION = sessionFile;
  process.env.PI_SUBAGENT_AUTO_EXIT = "false";
  process.env.PI_SUBAGENT_ID = "manager";

  try {
    for (const [name, params, expected] of [
      ["caller_ping", { message: "Need approval" }, "ping"],
      ["subagent_done", {}, "done"],
    ] as const) {
      const handlers = new Map<string, (...args: unknown[]) => unknown>();
      const tools = new Map<string, any>();
      const entries: unknown[] = [];
      const pi = {
        on(event: string, handler: (...args: unknown[]) => unknown) {
          handlers.set(event, handler);
        },
        appendEntry(_type: string, data: unknown) {
          entries.push(data);
        },
        getAllTools() {
          return [];
        },
        getCommands() {
          return [];
        },
        registerCommand() {},
        registerShortcut() {},
        registerTool(tool: any) {
          tools.set(tool.name, tool);
        },
      } as unknown as ExtensionAPI;
      let shutdowns = 0;
      subagentDoneExtension(pi);
      await tools.get(name).execute("call", params, undefined, undefined, {
        shutdown() {
          shutdowns += 1;
        },
      });
      await handlers.get("agent_settled")?.(
        {},
        {
          shutdown() {
            shutdowns += 1;
          },
        },
      );
      assert.equal(
        JSON.parse(readFileSync(`${sessionFile}.exit`, "utf8")).type,
        expected,
      );
      assert.equal(entries.length, 0);
      assert.equal(shutdowns, 1);
    }
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

test("discussion queues a steer before arming one-turn suppression", () => {
  const calls: string[] = [];
  queueDiscussMessage(
    "review this",
    (message, options) => calls.push(`${options.deliverAs}:${message}`),
    () => calls.push("armed"),
  );
  assert.deepEqual(calls, ["steer:review this", "armed"]);
});

test("discussion queue failures do not arm suppression", () => {
  let armed = false;
  assert.throws(() =>
    queueDiscussMessage(
      "review this",
      () => {
        throw new Error("queue failed");
      },
      () => {
        armed = true;
      },
    ),
  );
  assert.equal(armed, false);
});

test("settlement sidecars retain their outcome and unknown sidecars fail", () => {
  assert.equal(
    __pollForExitTest__.interpretExitSidecar({ type: "settlement" }).reason,
    "settlement",
  );
  assert.equal(
    __pollForExitTest__.interpretExitSidecar({ type: "unexpected" }).reason,
    "error",
  );
});

test("requested skills are expanded into the first child turn", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "pi-subagent-skill-"));
  const skillFile = join(tempDir, "SKILL.md");
  writeFileSync(
    skillFile,
    [
      "---",
      "name: q-outline",
      "description: Write an outline.",
      "---",
      "",
      "# Outline rules",
      "",
      "Keep the outline small.",
      "",
    ].join("\n"),
    "utf8",
  );

  const previousSkills = process.env.PI_SUBAGENT_SKILLS;
  process.env.PI_SUBAGENT_SKILLS = "q-outline";

  const handlers = new Map<
    string,
    (...args: unknown[]) => unknown | Promise<unknown>
  >();
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
    },
    getAllTools() {
      return [];
    },
    getCommands() {
      return [
        {
          name: "skill:q-outline",
          source: "skill",
          sourceInfo: {
            path: skillFile,
            source: "local",
            scope: "project",
            origin: "top-level",
          },
        },
      ];
    },
    registerCommand() {},
    registerShortcut() {},
    registerTool() {},
  } as unknown as ExtensionAPI;

  try {
    subagentDoneExtension(pi);
    const first = await handlers.get("input")?.(
      { text: "Create the approved outline.", source: "interactive" },
      { shutdown() {} },
    );
    assert.deepEqual(first, {
      action: "transform",
      text:
        `<skill name="q-outline" location="${skillFile}">\n` +
        `References are relative to ${tempDir}.\n\n` +
        "# Outline rules\n\nKeep the outline small.\n</skill>\n\n" +
        "Create the approved outline.",
    });

    const second = await handlers.get("input")?.(
      { text: "Follow-up", source: "interactive" },
      { shutdown() {} },
    );
    assert.equal(second, undefined);
  } finally {
    if (previousSkills == null) delete process.env.PI_SUBAGENT_SKILLS;
    else process.env.PI_SUBAGENT_SKILLS = previousSkills;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("a fresh resumed child does not transform its steer without the skills environment", async () => {
  const previousSkills = process.env.PI_SUBAGENT_SKILLS;
  delete process.env.PI_SUBAGENT_SKILLS;
  const handlers = new Map<
    string,
    (...args: unknown[]) => unknown | Promise<unknown>
  >();
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
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
  } as unknown as ExtensionAPI;

  try {
    subagentDoneExtension(pi);
    const result = await handlers.get("input")?.(
      { text: "Continue from here.", source: "interactive" },
      { shutdown() {} },
    );
    assert.equal(result, undefined);
  } finally {
    if (previousSkills == null) delete process.env.PI_SUBAGENT_SKILLS;
    else process.env.PI_SUBAGENT_SKILLS = previousSkills;
  }
});

test("terminal agent errors notify the manager without auto-exit", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "pi-subagent-error-"));
  const sessionFile = join(tempDir, "child.jsonl");
  const exitFile = `${sessionFile}.exit`;
  writeFileSync(sessionFile, "", "utf8");

  const previousSession = process.env.PI_SUBAGENT_SESSION;
  process.env.PI_SUBAGENT_SESSION = sessionFile;

  const handlers = new Map<
    string,
    (...args: unknown[]) => unknown | Promise<unknown>
  >();
  const pi = {
    on(name: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(name, handler);
    },
    getAllTools() {
      return [];
    },
    registerCommand() {},
    registerShortcut() {},
    registerTool() {},
  } as unknown as ExtensionAPI;

  let shutdowns = 0;
  const context = {
    shutdown() {
      shutdowns += 1;
    },
  };

  try {
    subagentDoneExtension(pi);
    await handlers.get("agent_end")?.(
      {
        type: "agent_end",
        messages: [
          {
            role: "assistant",
            stopReason: "error",
            errorMessage: "fetch failed",
            content: [],
          },
        ],
      },
      context,
    );
    await handlers.get("agent_settled")?.({ type: "agent_settled" }, context);

    assert.equal(existsSync(exitFile), true);
    assert.deepEqual(JSON.parse(readFileSync(exitFile, "utf8")), {
      type: "error",
      errorMessage: "fetch failed",
      stopReason: "error",
    });
    assert.equal(shutdowns, 1);
  } finally {
    if (previousSession == null) delete process.env.PI_SUBAGENT_SESSION;
    else process.env.PI_SUBAGENT_SESSION = previousSession;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("compacted peek retains kept messages and uses only post-compaction usage", () => {
  const file = join(
    mkdtempSync(join(tmpdir(), "pi-peek-compact-")),
    "session.jsonl",
  );
  const lines = [
    { type: "session", id: "root" },
    {
      type: "model_change",
      id: "model",
      parentId: "root",
      provider: "openai",
      modelId: "gpt",
    },
    {
      type: "message",
      id: "kept",
      parentId: "model",
      message: { role: "user", content: [{ type: "text", text: "retained" }] },
    },
    {
      type: "message",
      id: "before",
      parentId: "kept",
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt",
        content: [{ type: "text", text: "before" }],
        usage: { totalTokens: 900 },
      },
    },
    {
      type: "compaction",
      id: "compact",
      parentId: "before",
      summary: "summary",
      firstKeptEntryId: "kept",
      tokensBefore: 900,
    },
    {
      type: "message",
      id: "after",
      parentId: "compact",
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt",
        content: [{ type: "text", text: "after" }],
        usage: { totalTokens: 42 },
      },
    },
  ];
  writeFileSync(
    file,
    lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
  );
  const peek = inspectSession(file);
  assert.deepEqual(peek.messages, [
    { role: "user", text: "retained" },
    { role: "assistant", text: "before" },
    { role: "assistant", text: "after" },
  ]);
  assert.equal(peek.totalTokens, 42);
});

test("session peek follows the active branch and ignores a partial final line", () => {
  const file = join(mkdtempSync(join(tmpdir(), "pi-peek-")), "session.jsonl");
  const lines = [
    { type: "session", id: "root" },
    {
      type: "model_change",
      id: "model",
      parentId: "root",
      provider: "openai",
      modelId: "gpt",
    },
    {
      type: "message",
      id: "old",
      parentId: "model",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "inactive" }],
        usage: { totalTokens: 10 },
      },
    },
    {
      type: "message",
      id: "user",
      parentId: "model",
      message: { role: "user", content: [{ type: "text", text: "active" }] },
    },
    {
      type: "message",
      id: "answer",
      parentId: "user",
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt",
        content: [{ type: "text", text: "answer" }],
        usage: { totalTokens: 42 },
      },
    },
  ];
  writeFileSync(
    file,
    lines.map((line) => JSON.stringify(line)).join("\n") + "\n{partial",
  );
  assert.deepEqual(inspectSession(file), {
    provider: "openai",
    model: "gpt",
    totalTokens: 42,
    messages: [
      { role: "user", text: "active" },
      { role: "assistant", text: "answer" },
    ],
  });
});
