import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __test__ } from "./index.ts";

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

test("watcher owners are isolated", () => {
  const oldOwner = __test__.createWatcherOwner();
  const newOwner = __test__.createWatcherOwner();
  oldOwner.abort();
  assert.equal(oldOwner.signal.aborted, true);
  assert.equal(newOwner.signal.aborted, false);
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
