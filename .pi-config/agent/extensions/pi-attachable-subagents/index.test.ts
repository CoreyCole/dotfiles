import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("historical migration accepts only manager subagent result shapes", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-child-"));
  const child = join(dir, "child.jsonl");
  const manager = join(dir, "manager.jsonl");
  writeFileSync(
    child,
    JSON.stringify({ type: "session", id: "child", cwd: "/work" }) + "\n",
  );
  writeFileSync(
    manager,
    JSON.stringify({ type: "session", id: "manager", cwd: "/work" }) + "\n",
  );
  try {
    const recovered = __test__.migrateHistoricalToolResults(
      { id: "manager" },
      "manager",
      [
        { type: "message", details: { sessionFile: child, name: "unrelated" } },
        {
          type: "custom",
          customType: "subagent_result",
          details: { sessionFile: manager, name: "manager" },
        },
        {
          type: "custom",
          customType: "subagent_result",
          details: { sessionFile: child, name: "Worker", agent: "worker" },
        },
      ],
      new Map(),
    );
    assert.deepEqual(recovered, [
      {
        managerSessionId: "manager",
        childSessionId: "child",
        name: "Worker",
        agent: "worker",
        cwd: "/work",
      },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
