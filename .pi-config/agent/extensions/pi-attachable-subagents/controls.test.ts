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
